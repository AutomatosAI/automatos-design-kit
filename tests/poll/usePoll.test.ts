import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { nextPollState, usePoll, type PollState } from "@/hooks/usePoll";

// usePoll on fake timers (Date included, so "time since the last call" moves with them).
// Visibility is document.visibilityState, overridden per test and put back afterwards.

const INTERVAL = 1000;

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}

/** Lets timers due within ms fire and the promises they start settle, inside act. */
async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** Answers 1, 2, 3… one per call. */
function counter() {
  let calls = 0;
  return vi.fn(() => {
    calls += 1;
    return Promise.resolve(calls);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(document, "visibilityState");
  vi.restoreAllMocks();
});

describe("usePoll", () => {
  it("calls at once, then one interval after each call settles", async () => {
    const fn = counter();
    const { result } = renderHook(() => usePoll(fn, INTERVAL));
    expect(result.current.state).toEqual({ status: "loading" });
    expect(fn).toHaveBeenCalledTimes(1);
    await advance(0);
    expect(result.current.state).toEqual({ status: "ready", value: 1, stale: false, stopped: false });
    await advance(INTERVAL - 1);
    expect(fn).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(result.current.state).toMatchObject({ status: "ready", value: 2 });
  });

  it("waits one interval first when immediate is false", async () => {
    const fn = counter();
    renderHook(() => usePoll(fn, INTERVAL, { immediate: false }));
    await advance(INTERVAL - 1);
    expect(fn).not.toHaveBeenCalled();
    await advance(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("pauses while the page is hidden and calls again as soon as it is visible", async () => {
    const fn = counter();
    renderHook(() => usePoll(fn, INTERVAL));
    await advance(0);
    act(() => setVisibility("hidden"));
    await advance(INTERVAL * 5);
    expect(fn).toHaveBeenCalledTimes(1);
    act(() => setVisibility("visible"));
    await advance(0);
    expect(fn).toHaveBeenCalledTimes(2);
    await advance(INTERVAL);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("waits out the rest of the interval when the page comes back early", async () => {
    const fn = counter();
    renderHook(() => usePoll(fn, INTERVAL));
    await advance(400);
    act(() => setVisibility("hidden"));
    await advance(200);
    act(() => setVisibility("visible"));
    await advance(399);
    expect(fn).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("makes no call while the page starts hidden", async () => {
    setVisibility("hidden");
    const fn = counter();
    renderHook(() => usePoll(fn, INTERVAL));
    await advance(INTERVAL * 3);
    expect(fn).not.toHaveBeenCalled();
    act(() => setVisibility("visible"));
    await advance(0);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("keeps polling while hidden when visibleOnly is false", async () => {
    setVisibility("hidden");
    const fn = counter();
    renderHook(() => usePoll(fn, INTERVAL, { visibleOnly: false }));
    await advance(INTERVAL * 2);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("stops for good once stopWhen is true", async () => {
    const fn = counter();
    const { result } = renderHook(() => usePoll(fn, INTERVAL, { stopWhen: (value) => value >= 2 }));
    await advance(INTERVAL);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(result.current.state).toEqual({ status: "ready", value: 2, stale: false, stopped: true });
    await advance(INTERVAL * 5);
    act(() => setVisibility("hidden"));
    act(() => setVisibility("visible"));
    await advance(INTERVAL * 5);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("never overlaps calls: the next waits for the last, and refresh joins the one on its way", async () => {
    const first = deferred<number>();
    const fn = vi.fn<() => Promise<number>>().mockReturnValueOnce(first.promise).mockResolvedValue(2);
    const { result } = renderHook(() => usePoll(fn, INTERVAL));
    await advance(INTERVAL * 5);
    let refreshed: Promise<void> = Promise.resolve();
    act(() => {
      refreshed = result.current.refresh();
    });
    expect(fn).toHaveBeenCalledTimes(1);
    first.resolve(1);
    await act(async () => {
      await refreshed;
    });
    expect(result.current.state).toMatchObject({ status: "ready", value: 1 });
    await advance(INTERVAL - 1);
    expect(fn).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("calls now on refresh and times the next call from it", async () => {
    const fn = counter();
    const { result } = renderHook(() => usePoll(fn, INTERVAL));
    await advance(600);
    await act(async () => {
      await result.current.refresh();
    });
    expect(fn).toHaveBeenCalledTimes(2);
    await advance(INTERVAL - 1);
    expect(fn).toHaveBeenCalledTimes(2);
    await advance(1);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("reports a failed first call, keeps polling, and marks a later failure stale", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const boom = new Error("boom");
    const fn = vi.fn<() => Promise<number>>().mockRejectedValueOnce(boom).mockResolvedValueOnce(7).mockRejectedValue(boom);
    const { result } = renderHook(() => usePoll(fn, INTERVAL, { label: "missions" }));
    await advance(0);
    expect(result.current.state).toEqual({ status: "failed", error: boom });
    expect(error).toHaveBeenCalledWith("[missions] A poll failed.", boom);
    await advance(INTERVAL);
    expect(result.current.state).toEqual({ status: "ready", value: 7, stale: false, stopped: false });
    await advance(INTERVAL);
    expect(result.current.state).toEqual({ status: "ready", value: 7, stale: true, stopped: false });
  });

  it("cleans up on unmount: no more calls, and a late answer is dropped", async () => {
    const late = deferred<number>();
    const fn = vi.fn<() => Promise<number>>().mockReturnValueOnce(late.promise).mockResolvedValue(2);
    const remove = vi.spyOn(document, "removeEventListener");
    const { unmount } = renderHook(() => usePoll(fn, INTERVAL));
    unmount();
    expect(remove).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
    late.resolve(1);
    await advance(INTERVAL * 5);
    act(() => setVisibility("visible"));
    await advance(INTERVAL * 5);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("nextPollState", () => {
  it("is pure: a new state from the old one, which is left as it was", () => {
    const ready: PollState<number> = { status: "ready", value: 1, stale: false, stopped: false };
    const frozen = Object.freeze({ ...ready });
    expect(nextPollState(frozen, { ok: false, error: "x" }, false)).toEqual({ ...ready, stale: true });
    expect(frozen).toEqual(ready);
    expect(nextPollState({ status: "loading" }, { ok: true, value: 3 }, true)).toEqual({
      status: "ready",
      value: 3,
      stale: false,
      stopped: true,
    });
    expect(nextPollState({ status: "loading" }, { ok: false, error: "x" }, false)).toEqual({ status: "failed", error: "x" });
  });
});
