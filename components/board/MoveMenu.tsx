"use client";

// "Move to…" on a Task card: the keyboard and phone way to move it (B-003). It lists
// only the columns the move rules allow (lib/board/moves.ts allowedColumns); with none,
// it says why the first column is refused.

import { useId, useState } from "react";

import { columnMoves } from "@/lib/board/moves";
import { type BoardColumn, type BoardTask, STATUS_LABELS } from "@/lib/board/types";

import styles from "./board.module.css";

export const MOVE_TO = "Move to…";
export const NO_MOVES = "It can't be moved by hand right now.";

export interface MoveMenuProps {
  readonly task: BoardTask;
  readonly now: Date;
  readonly busy: boolean;
  readonly onMove: (task: BoardTask, column: BoardColumn) => void;
}

export function moveGroupLabel(task: Pick<BoardTask, "number" | "title">): string {
  return `Move ${task.number ?? task.title} to`;
}

export function MoveMenu({ task, now, busy, onMove }: MoveMenuProps) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const moves = columnMoves(task, now);
  const allowed = moves.filter((move) => move.refusal === null);
  const firstRefusal = moves.find((move) => move.refusal !== null)?.refusal ?? null;

  const choose = (column: BoardColumn) => {
    setOpen(false);
    onMove(task, column);
  };

  return (
    <div className={styles.moveMenu}>
      <button
        type="button"
        className={styles.cardButton}
        aria-expanded={open}
        aria-controls={listId}
        disabled={busy}
        onClick={() => setOpen((shown) => !shown)}
      >
        {MOVE_TO}
      </button>
      {open && (
        <div id={listId} className={styles.moveList} role="group" aria-label={moveGroupLabel(task)}>
          {allowed.length === 0 ? (
            <p className={styles.cardNote}>{firstRefusal ? `${NO_MOVES} ${firstRefusal}` : NO_MOVES}</p>
          ) : (
            allowed.map((move) => (
              <button key={move.column} type="button" className={styles.moveOption} onClick={() => choose(move.column)}>
                {STATUS_LABELS[move.column]}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
