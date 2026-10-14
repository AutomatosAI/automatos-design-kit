// The engine under hooks/usePoll.ts, free of React so its rules read in one place:
// calls are chained (the next is timed from the end of the last), so two never overlap;
// nothing is called while the page is hidden; stopWhen ends the chain; refresh() calls
// now unless a call is already on its way, in which case it waits for that one.
// The poller owns its timer and flags; results leave through onSettled only.

export type PollOutcome<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: unknown };

export interface PollerConfig<T> {
  readonly call: () => Promise<T>;
  readonly intervalMs: number;
  /** Call once at start (true) or wait one interval first (false). */
  readonly immediate: boolean;
  /** True while the page is hidden and polling should rest. */
  readonly isHidden: () => boolean;
  readonly stopWhen: (value: T) => boolean;
  /** Every settled call, with whether polling has stopped. */
  readonly onSettled: (outcome: PollOutcome<T>, stopped: boolean) => void;
  /** Milliseconds; tests and fake timers use Date.now. */
  readonly now?: () => number;
}

export interface Poller {
  readonly start: () => void;
  /** Rest while hidden; on visible, call at once if an interval has passed, else wait out the rest. */
  readonly visibilityChanged: () => void;
  /** Call now (even if stopped or hidden); resolves when that call has settled. */
  readonly refresh: () => Promise<void>;
  /** For good: no more calls, and a call on its way is ignored. */
  readonly dispose: () => void;
}

export function createPoller<T>(config: PollerConfig<T>): Poller {
  const now = config.now ?? (() => Date.now());
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: Promise<void> | null = null;
  let lastStart = Number.NEGATIVE_INFINITY;
  let stopped = false;
  let disposed = false;

  const clear = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };

  const schedule = (delayMs: number) => {
    clear();
    if (disposed || stopped || config.isHidden()) return;
    timer = setTimeout(() => {
      timer = undefined;
      void run();
    }, Math.max(0, delayMs));
  };

  const settle = (outcome: PollOutcome<T>) => {
    if (disposed) return;
    stopped = outcome.ok ? config.stopWhen(outcome.value) : stopped;
    config.onSettled(outcome, stopped);
    schedule(config.intervalMs);
  };

  const run = (): Promise<void> => {
    if (inFlight) return inFlight;
    clear();
    lastStart = now();
    const call = callSafely(config.call).then(settle);
    inFlight = call.finally(() => {
      inFlight = null;
    });
    return inFlight;
  };

  return {
    start: () => {
      // Hidden at start: the first call waits for visible (immediate one at once, the other an interval on).
      if (!config.immediate) lastStart = now();
      if (config.isHidden()) return;
      if (config.immediate) void run();
      else schedule(config.intervalMs);
    },
    visibilityChanged: () => {
      if (config.isHidden()) clear();
      else if (!inFlight) schedule(config.intervalMs - (now() - lastStart));
    },
    refresh: () => (disposed ? Promise.resolve() : run()),
    dispose: () => {
      disposed = true;
      clear();
    },
  };
}

/** The call's answer or its error; a call that throws before returning a promise counts too. */
async function callSafely<T>(call: () => Promise<T>): Promise<PollOutcome<T>> {
  try {
    return { ok: true, value: await call() };
  } catch (error) {
    return { ok: false, error };
  }
}
