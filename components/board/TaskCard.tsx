"use client";

// One Task on the board (B-003): its number, priority, title, agent (glyph and name),
// tags, and why it waits when it is in Review or Blocked. It drags to another column
// (native HTML5 drag events); "Move to…" does the same from the keyboard or a phone.

import type { DragEvent } from "react";

import { StateChip } from "@/components/page/StateChip";
import type { CardActions } from "@/hooks/useBoardActions";
import { priorityLabel, stageReason } from "@/lib/board/board";
import type { BoardTask } from "@/lib/board/types";

import styles from "./board.module.css";
import { MoveMenu } from "./MoveMenu";
import { ReviewActions } from "./ReviewActions";

export const NO_AGENT = "No agent";

/** The drag's payload type: the Task's id, as text. */
export const TASK_DRAG_TYPE = "text/plain";

export type TaskCardActions = CardActions;

export interface TaskCardProps extends TaskCardActions {
  readonly task: BoardTask;
  /** The agent's glyph (lib/agents/icons.ts), when the agents list knows them. */
  readonly agentGlyph: string | null;
  readonly now: Date;
  /** An action on this Task is on its way. */
  readonly busy: boolean;
}

export function TaskCard({ task, agentGlyph, now, busy, ...actions }: TaskCardProps) {
  const reason = stageReason(task);
  const priority = priorityLabel(task.priority);

  const startDrag = (event: DragEvent<HTMLLIElement>) => {
    event.dataTransfer?.setData(TASK_DRAG_TYPE, String(task.id));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    actions.onDragStart(task);
  };

  return (
    <li
      className={styles.task}
      draggable={!busy}
      aria-busy={busy}
      onDragStart={startDrag}
      onDragEnd={actions.onDragEnd}
    >
      <article className={styles.taskCard} aria-label={task.title}>
        <div className={styles.taskTop}>
          {task.number && <span className={styles.taskNumber}>{task.number}</span>}
          {priority && <span className={styles.priority} data-priority={task.priority}>{priority}</span>}
        </div>
        <h3 className={styles.taskTitle}>{task.title}</h3>
        <p className={styles.agent}>
          {task.agent && agentGlyph && <span aria-hidden="true">{agentGlyph} </span>}
          {task.agent?.name ?? NO_AGENT}
        </p>
        {task.tags.length > 0 && (
          <ul className={styles.tags} aria-label="Tags">
            {task.tags.map((tag, index) => (
              <li key={`${index}-${tag}`} className={styles.tag}>
                {tag}
              </li>
            ))}
          </ul>
        )}
        {reason && (
          <div className={styles.reason} title={reason.says}>
            <StateChip tone={reason.tone} label={reason.label} />
          </div>
        )}
        {task.status === "review" && (
          <ReviewActions task={task} busy={busy} onApprove={actions.onApprove} onReject={actions.onReject} />
        )}
        <MoveMenu task={task} now={now} busy={busy} onMove={actions.onMove} />
      </article>
    </li>
  );
}
