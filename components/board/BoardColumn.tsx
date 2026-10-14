"use client";

// A column on the board (B-003): its name and count, its Task cards, and, while a card
// is being dragged, whether it takes the drop. A column the move rules refuse is
// visibly disabled and says why (the sentence is also its tooltip); only an allowed
// column accepts the drop. The Other column (Failed, Cancelled, Closed) starts collapsed
// and takes no drops: Cancel is the way there.

import { type DragEvent, useId, useState } from "react";

import { moveRefusal } from "@/lib/board/moves";
import type { BoardColumn as Column, BoardTask } from "@/lib/board/types";

import styles from "./board.module.css";
import { type TaskCardActions, TaskCard } from "./TaskCard";

export const OTHER = "other";
export type ColumnKey = Column | typeof OTHER;

export const EMPTY_COLUMN = "Nothing here.";
export const DROP_HERE = "Drop to move it here.";

export type DropState = "none" | "allowed" | "refused";

export interface BoardColumnProps {
  readonly column: ColumnKey;
  readonly label: string;
  readonly tasks: readonly BoardTask[];
  /** The column the phone switcher shows; the others hide on phones. */
  readonly current: boolean;
  /** The Task being dragged, if any. */
  readonly dragging: BoardTask | null;
  readonly now: Date;
  readonly busyId: number | null;
  readonly glyphOf: (task: BoardTask) => string | null;
  readonly actions: TaskCardActions;
}

/** Whether this column takes the dragged Task, and why not. */
function dropOf(column: ColumnKey, dragging: BoardTask | null, now: Date): { state: DropState; refusal: string | null } {
  if (!dragging || column === OTHER || dragging.status === column) return { state: "none", refusal: null };
  const refusal = moveRefusal(dragging, column, now);
  return refusal === null ? { state: "allowed", refusal: null } : { state: "refused", refusal };
}

export function BoardColumn({ column, label, tasks, current, dragging, now, busyId, glyphOf, actions }: BoardColumnProps) {
  const headingId = useId();
  const listId = useId();
  const [expanded, setExpanded] = useState(column !== OTHER);
  const drop = dropOf(column, dragging, now);

  const over = (event: DragEvent<HTMLElement>) => {
    if (drop.state !== "allowed") return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  };

  const dropped = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (drop.state === "allowed" && dragging && column !== OTHER) actions.onMove(dragging, column);
    actions.onDragEnd();
  };

  return (
    <section
      className={styles.column}
      aria-labelledby={headingId}
      data-column={column}
      data-current={current}
      data-drop={drop.state}
      title={drop.refusal ?? undefined}
      onDragOver={over}
      onDrop={dropped}
    >
      <ColumnHeading
        column={column}
        label={label}
        count={tasks.length}
        headingId={headingId}
        listId={listId}
        expanded={expanded}
        onToggle={() => setExpanded((open) => !open)}
      />
      {drop.state === "refused" && <p className={styles.dropRefused}>{drop.refusal}</p>}
      {drop.state === "allowed" && <p className={styles.dropAllowed}>{DROP_HERE}</p>}
      {expanded && (
        <ul id={listId} className={styles.taskList}>
          {tasks.length === 0 && <li className={styles.emptyColumn}>{EMPTY_COLUMN}</li>}
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              agentGlyph={glyphOf(task)}
              now={now}
              busy={busyId === task.id}
              {...actions}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

interface ColumnHeadingProps {
  readonly column: ColumnKey;
  readonly label: string;
  readonly count: number;
  readonly headingId: string;
  readonly listId: string;
  readonly expanded: boolean;
  readonly onToggle: () => void;
}

/** The column's name and count; the Other column's heading is the button that opens it. */
function ColumnHeading({ column, label, count, headingId, listId, expanded, onToggle }: ColumnHeadingProps) {
  if (column !== OTHER) {
    return (
      <h2 id={headingId} className={styles.columnTitle}>
        {label} <span className={styles.columnCount}>{count}</span>
      </h2>
    );
  }
  return (
    <h2 id={headingId} className={styles.columnTitle}>
      <button
        type="button"
        className={styles.columnToggle}
        aria-expanded={expanded}
        aria-controls={listId}
        onClick={onToggle}
      >
        {label} <span className={styles.columnCount}>{count}</span>
      </button>
    </h2>
  );
}
