"use client";

// The board's live updates (board-analytics.md, "Live updates"): while mounted, keeps
// GET /api/tasks/stream open (lib/board/live.ts reads it, reconnecting with backoff) and
// calls onChange on every board_changed frame, including the one the backend sends on
// connect. As a safety net it also calls onChange every POLL_INTERVALS.BOARD_SAFETY
// while the tab is visible. Unmounting aborts the stream and stops both.
// onChange may be an inline function: the latest one is always called, without a reconnect.

import { useEffect, useRef } from "react";

import { callSafely, connectBoardStream } from "@/lib/board/live";
import { api, type ApiClient } from "@/lib/client/api";
import { POLL_INTERVALS } from "@/lib/poll/intervals";

export interface BoardStreamOptions {
  readonly client?: ApiClient;
  /** false: no stream and no safety refetch. Default true. */
  readonly enabled?: boolean;
  /** The safety refetch's interval; tests pass a short one. */
  readonly safetyMs?: number;
}

function pageHidden(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

export function useBoardStream(onChange: () => void, options: BoardStreamOptions = {}): void {
  const { client = api, enabled = true } = options;
  const safetyMs: number = options.safetyMs ?? POLL_INTERVALS.BOARD_SAFETY;
  const latest = useRef(onChange);

  // Declared first, so the stream and the timer always see the newest onChange.
  useEffect(() => {
    latest.current = onChange;
  });

  useEffect(() => {
    if (!enabled) return;
    return connectBoardStream({
      open: (signal) => client.openBoardStream(signal),
      onChange: () => latest.current(),
    });
  }, [client, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      if (!pageHidden()) callSafely(latest.current, "The board's safety refetch");
    }, safetyMs);
    return () => clearInterval(timer);
  }, [enabled, safetyMs]);
}
