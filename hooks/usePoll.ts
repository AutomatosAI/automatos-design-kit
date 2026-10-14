// Gentle polling (the skill's "Poll gently"): usePoll(fn, intervalMs, options) calls fn now
// (or after one interval), then again intervalMs after each call settles, so calls never
// overlap. It rests while the tab is hidden and picks up on visible, stops for good once
// stopWhen(result) is true, and stops on unmount. Intervals come from lib/poll/intervals.ts.
// Pass a memoised fn (useCallback): a new fn starts a fresh poll; stopWhen may be inline.

import { useCallback, useEffect, useRef, useState } from "react";

import { createPoller, type Poller, type PollOutcome } from "@/lib/poll/poller";

export interface PollOptions<T> {
  /** Rest while document.visibilityState is "hidden". Default true. */
  readonly visibleOnly?: boolean;
  /** Stop polling once this is true for a result (a Mission that has ended). */
  readonly stopWhen?: (result: T) => boolean;
  /** Call at once (true, the default) or wait one interval first. */
  readonly immediate?: boolean;
  /** Names the poll in the console when a call fails. */
  readonly label?: string;
}

export type PollState<T> =
  | { readonly status: "loading" }
  /** No answer yet: the first call failed (polling carries on). */
  | { readonly status: "failed"; readonly error: unknown }
  | {
      readonly status: "ready";
      /** The latest answer. */
      readonly value: T;
      /** The latest call failed; value is the one before it. */
      readonly stale: boolean;
      /** stopWhen matched: no more calls unless refresh() is asked for. */
      readonly stopped: boolean;
    };

export interface Poll<T> {
  readonly state: PollState<T>;
  /** Call now (after an action); waits for a call already on its way instead of overlapping. */
  readonly refresh: () => Promise<void>;
}

const LOADING = { status: "loading" } as const;
const NEVER = () => false;

/** The next state from a settled call: pure, the previous state is never changed. */
export function nextPollState<T>(previous: PollState<T>, outcome: PollOutcome<T>, stopped: boolean): PollState<T> {
  if (outcome.ok) return { status: "ready", value: outcome.value, stale: false, stopped };
  if (previous.status === "ready") return { ...previous, stale: true, stopped };
  return { status: "failed", error: outcome.error };
}

function pageHidden(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

export function usePoll<T>(fn: () => Promise<T>, intervalMs: number, options: PollOptions<T> = {}): Poll<T> {
  const { visibleOnly = true, immediate = true, label = "poll" } = options;
  const [state, setState] = useState<PollState<T>>(LOADING);
  const stopWhen = useRef<(result: T) => boolean>(options.stopWhen ?? NEVER);
  const poller = useRef<Poller | null>(null);

  // Declared first, so it runs before the poll starts: the latest stopWhen without a restart.
  useEffect(() => {
    stopWhen.current = options.stopWhen ?? NEVER;
  });

  useEffect(() => {
    setState(LOADING);
    const current = createPoller<T>({
      call: fn,
      intervalMs,
      immediate,
      isHidden: () => visibleOnly && pageHidden(),
      stopWhen: (value) => stopWhen.current(value),
      onSettled: (outcome, stopped) => {
        if (!outcome.ok) console.error(`[${label}] A poll failed.`, outcome.error);
        setState((previous) => nextPollState(previous, outcome, stopped));
      },
    });
    poller.current = current;
    const onVisibility = () => current.visibilityChanged();
    document.addEventListener("visibilitychange", onVisibility);
    current.start();
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      current.dispose();
      if (poller.current === current) poller.current = null;
    };
  }, [fn, intervalMs, immediate, visibleOnly, label]);

  const refresh = useCallback(() => poller.current?.refresh() ?? Promise.resolve(), []);
  return { state, refresh };
}
