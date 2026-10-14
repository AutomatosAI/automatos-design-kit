"use client";

// The board's Tasks as render state (B-003). Loads the list on mount, and again whenever
// the live stream says board_changed (hooks/useBoardStream.ts; its 60 s safety refetch
// included). No other polling. Answers can overlap: only the newest request's answer is
// kept. A refetch that fails keeps the list on screen and says so.

import { useCallback, useEffect, useRef, useState } from "react";

import { useBoardStream } from "@/hooks/useBoardStream";
import type { TaskList } from "@/lib/board/parse";
import { api, ApiError, type ApiClient } from "@/lib/client/api";

export const BOARD_FAILED = "Play couldn't load the board.";
export const REFRESH_FAILED = "Play couldn't refresh the board; what you see may be out of date.";

export type BoardView =
  | { readonly status: "loading" }
  | { readonly status: "failed"; readonly error: string; readonly retry: () => void }
  | { readonly status: "ready"; readonly list: TaskList; readonly stale: boolean };

export interface UseBoard {
  readonly view: BoardView;
  /** Reads the list again; resolves when the answer is in (or failed). */
  readonly refresh: () => Promise<void>;
}

export interface BoardOptions {
  readonly client?: ApiClient;
  /** The stream's safety refetch interval; tests pass a short one. */
  readonly safetyMs?: number;
}

function failedSentence(error: unknown): string {
  return error instanceof ApiError ? `${BOARD_FAILED} ${error.message}` : BOARD_FAILED;
}

export function useBoard({ client = api, safetyMs }: BoardOptions = {}): UseBoard {
  const [view, setView] = useState<BoardView>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const latest = useRef(0);
  const retry = useCallback(() => setAttempt((count) => count + 1), []);
  const mounted = useRef(true);

  const refresh = useCallback(async (): Promise<void> => {
    latest.current += 1;
    const request = latest.current;
    const current = () => mounted.current && request === latest.current;
    try {
      const list = await client.listTasks();
      if (current()) setView({ status: "ready", list, stale: false });
    } catch (error) {
      console.error(`[board] ${BOARD_FAILED}`, error);
      if (!current()) return;
      setView((previous) =>
        previous.status === "ready"
          ? { ...previous, stale: true }
          : { status: "failed", error: failedSentence(error), retry },
      );
    }
  }, [client, retry]);

  // On mount, and again on Try again (from the loading state).
  useEffect(() => {
    mounted.current = true;
    if (attempt > 0) setView({ status: "loading" });
    void refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh, attempt]);

  useBoardStream(() => void refresh(), { client, safetyMs });

  return { view, refresh };
}
