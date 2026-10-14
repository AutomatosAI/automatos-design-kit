"use client";

// What a Task card can do on the board (B-003): move it (drag or "Move to…"), Approve
// or Reject it. One action at a time per card; the board is read again after each one.
// A move the rules refuse is never sent (its sentence shows instead); a refusal from the
// backend shows its own message.

import { useCallback, useMemo, useState } from "react";

import { moveRefusal } from "@/lib/board/moves";
import { type BoardColumn, type BoardTask, STATUS_LABELS } from "@/lib/board/types";
import { ApiError, type ApiClient } from "@/lib/client/api";

export type BoardNotice = { readonly text: string } | null;

export interface CardActions {
  readonly onMove: (task: BoardTask, column: BoardColumn) => void;
  readonly onApprove: (task: BoardTask) => void;
  readonly onReject: (task: BoardTask, feedback: string) => void;
  readonly onDragStart: (task: BoardTask) => void;
  readonly onDragEnd: () => void;
}

export interface BoardActions {
  /** The id of the Task being dragged. */
  readonly draggingId: number | null;
  /** The Task an action is on its way for. */
  readonly busyId: number | null;
  readonly notice: BoardNotice;
  readonly dismiss: () => void;
  readonly card: CardActions;
}

/** "#0042", or the title in quotes for a row from before numbering. */
export function taskName(task: Pick<BoardTask, "number" | "title">): string {
  return task.number ?? `“${task.title}”`;
}

function sentence(failed: string, error: unknown): string {
  return error instanceof ApiError ? `${failed} ${error.message}` : failed;
}

/** now: what "now" is for the move rules; the clock when left out (tests pin it). */
export function useBoardActions(client: ApiClient, refresh: () => Promise<void>, now?: Date): BoardActions {
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState<BoardNotice>(null);

  const run = useCallback(
    async (task: BoardTask, failed: string, act: () => Promise<void>): Promise<void> => {
      setBusyId(task.id);
      setNotice(null);
      try {
        await act();
      } catch (error) {
        console.error(`[board] ${failed}`, error);
        setNotice({ text: sentence(failed, error) });
      }
      await refresh();
      setBusyId(null);
    },
    [refresh],
  );

  const card = useMemo<CardActions>(
    () => ({
      onMove: (task, column) => {
        setDraggingId(null);
        const refusal = moveRefusal(task, column, now ?? new Date());
        if (refusal !== null) {
          setNotice({ text: `${taskName(task)} can't move to ${STATUS_LABELS[column]}. ${refusal}` });
          return;
        }
        const failed = `Play couldn't move ${taskName(task)} to ${STATUS_LABELS[column]}.`;
        void run(task, failed, () => client.moveTask(task.id, column));
      },
      onApprove: (task) => void run(task, `Play couldn't approve ${taskName(task)}.`, () => client.approveTask(task.id)),
      onReject: (task, feedback) =>
        void run(task, `Play couldn't send ${taskName(task)} back.`, () => client.rejectTask(task.id, feedback || undefined)),
      onDragStart: (task) => setDraggingId(task.id),
      onDragEnd: () => setDraggingId(null),
    }),
    [client, run, now],
  );

  const dismiss = useCallback(() => setNotice(null), []);

  return { draggingId, busyId, notice, dismiss, card };
}
