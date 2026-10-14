import { act, renderHook } from "@testing-library/react";
import { type MockInstance, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useBoardStream } from "@/hooks/useBoardStream";
import { ApiError, createApiClient } from "@/lib/client/api";
import { POLL_INTERVALS } from "@/lib/poll/intervals";

import { boardChanged, HEARTBEAT, mockStreamFetch, sseFrame, type StreamAnswer } from "./stream-helpers";

// useBoardStream on fake timers with a stream the test drives (B-002): which frames mean
// a refetch, the backoff after a drop, the 60 s safety net, and the teardown on unmount.

const SAFETY = POLL_INTERVALS.BOARD_SAFETY;

/** Lets timers due within ms fire and the promises they start settle, inside act. */
async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
}

function mount(answers: readonly StreamAnswer[] = []) {
  const mock = mockStreamFetch(answers);
  const onChange = vi.fn();
  const client = createApiClient(mock.fetch);
  const hook = renderHook(({ fn }) => useBoardStream(fn, { client }), { initialProps: { fn: onChange } });
  return { ...mock, onChange, hook };
}

let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  // Only the timers the hook uses: the fetch bodies' own plumbing keeps the real ones.
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(document, "visibilityState");
  vi.restoreAllMocks();
});

describe("useBoardStream", () => {
  it("opens /api/tasks/stream with the workspace header and refetches on board_changed", async () => {
    const { streams, streamCalls, onChange } = mount();
    await advance(0);
    expect(streamCalls()).toHaveLength(1);
    const init = streamCalls()[0]?.[1];
    expect(new Headers(init?.headers).get("X-Workspace-ID")).toBe("3f1c2a9e-5b7d-4e2f-9a1b-0c8d6e4f2a10");
    expect(init?.signal).toBeInstanceOf(AbortSignal);

    streams[0]?.push(boardChanged(4));
    await advance(0);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("doesn't refetch on a heartbeat comment or a chat_changed frame", async () => {
    const { streams, onChange } = mount();
    await advance(0);
    streams[0]?.push(HEARTBEAT);
    streams[0]?.push(sseFrame("chat_changed", { chat_id: "c1" }));
    await advance(0);
    expect(onChange).not.toHaveBeenCalled();
    streams[0]?.push(HEARTBEAT + boardChanged(1));
    await advance(0);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("reconnects a dropped stream after 1 s, then backs off 2 s, 4 s while it keeps failing", async () => {
    const { streams, streamCalls } = mount(["stream", "fail", "fail", "stream"]);
    await advance(0);
    streams[0]?.push(boardChanged());
    await advance(0);
    streams[0]?.drop();
    await advance(999);
    expect(streamCalls()).toHaveLength(1);
    await advance(1);
    expect(streamCalls()).toHaveLength(2);
    await advance(1_999);
    expect(streamCalls()).toHaveLength(2);
    await advance(1);
    expect(streamCalls()).toHaveLength(3);
    await advance(3_999);
    expect(streamCalls()).toHaveLength(3);
    await advance(1);
    expect(streamCalls()).toHaveLength(4);
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("[board stream]"), expect.any(ApiError));
  });

  it("starts the backoff over once the backend sends bytes again", async () => {
    const { streams, streamCalls } = mount(["fail", "stream", "stream"]);
    await advance(0);
    await advance(1_000);
    expect(streamCalls()).toHaveLength(2);
    streams[0]?.push(HEARTBEAT);
    await advance(0);
    streams[0]?.end();
    await advance(999);
    expect(streamCalls()).toHaveLength(2);
    await advance(1);
    expect(streamCalls()).toHaveLength(3);
  });

  it("calls the newest onChange without reconnecting", async () => {
    const { streams, streamCalls, onChange, hook } = mount();
    await advance(0);
    const next = vi.fn();
    hook.rerender({ fn: next });
    streams[0]?.push(boardChanged());
    await advance(0);
    expect(next).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
    expect(streamCalls()).toHaveLength(1);
  });

  it("refetches every 60 s as a safety net, but not while the tab is hidden", async () => {
    const { onChange } = mount();
    await advance(0);
    await advance(SAFETY - 1);
    expect(onChange).not.toHaveBeenCalled();
    await advance(1);
    expect(onChange).toHaveBeenCalledTimes(1);
    setVisibility("hidden");
    await advance(SAFETY);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("aborts the stream on unmount and neither reconnects nor refetches afterwards", async () => {
    const { streams, streamCalls, onChange, hook } = mount();
    await advance(0);
    const signal = streams[0]?.signal;
    expect(signal?.aborted).toBe(false);
    hook.unmount();
    expect(signal?.aborted).toBe(true);
    await advance(SAFETY * 2);
    expect(streamCalls()).toHaveLength(1);
    expect(onChange).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("cancels a reconnect that is waiting when it unmounts", async () => {
    const { streamCalls, hook } = mount(["fail"]);
    await advance(0);
    hook.unmount();
    await advance(5_000);
    expect(streamCalls()).toHaveLength(1);
  });
});

describe("api.openBoardStream", () => {
  it("throws the proxy's sentence when the backend isn't running", async () => {
    const { fetch } = mockStreamFetch(["fail"]);
    await expect(createApiClient(fetch).openBoardStream()).rejects.toEqual(new ApiError(502, "Automatos isn't running."));
    expect(consoleError).toHaveBeenCalledWith("[api] /api/tasks/stream failed with 502:", expect.anything());
  });
});
