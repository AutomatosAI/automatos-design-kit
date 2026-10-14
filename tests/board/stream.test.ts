// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  INITIAL_SSE,
  isBoardChange,
  parseSseChunk,
  reconnectDelay,
  RECONNECT_MAX_MS,
  RECONNECT_MIN_MS,
  type SseFrame,
  type SseState,
} from "@/lib/board/stream";

import { boardChanged, HEARTBEAT, sseFrame, WORKSPACE } from "./stream-helpers";

// The board stream's SSE parser (B-002): frames as the backend's services/board_events.py
// writes them, split anywhere, plus the reconnect backoff.

const encoder = new TextEncoder();

/** Feeds the chunks in order; returns every frame and the final state. */
function feed(chunks: readonly (string | Uint8Array)[], start: SseState = INITIAL_SSE) {
  return chunks.reduce<{ state: SseState; frames: readonly SseFrame[] }>(
    (acc, chunk) => {
      const step = parseSseChunk(acc.state, typeof chunk === "string" ? encoder.encode(chunk) : chunk);
      return { state: step.state, frames: [...acc.frames, ...step.frames] };
    },
    { state: start, frames: [] },
  );
}

describe("parseSseChunk", () => {
  it("reads the backend's board_changed frame", () => {
    const { frames } = feed([boardChanged(7)]);
    expect(frames).toEqual([
      { event: "board_changed", data: JSON.stringify({ workspace_id: WORKSPACE.id, task_id: 7, status: "review" }) },
    ]);
    expect(frames.every(isBoardChange)).toBe(true);
  });

  it("gives no frame for a heartbeat comment", () => {
    expect(feed([HEARTBEAT, ":hb\n\n", HEARTBEAT]).frames).toEqual([]);
  });

  it("keeps a frame split across chunks until its blank line", () => {
    const text = boardChanged(3);
    const first = feed([text.slice(0, 9)]);
    expect(first.frames).toEqual([]);
    const second = feed([text.slice(9, -1)], first.state);
    expect(second.frames).toEqual([]);
    expect(feed(["\n"], second.state).frames).toHaveLength(1);
  });

  it("reads several frames in one chunk, in order, with heartbeats between", () => {
    const { frames } = feed([boardChanged(1) + HEARTBEAT + sseFrame("chat_changed", { chat_id: "c" }) + boardChanged(2)]);
    expect(frames.map((frame) => frame.event)).toEqual(["board_changed", "chat_changed", "board_changed"]);
    expect(frames.map(isBoardChange)).toEqual([true, false, true]);
  });

  it("joins data lines, takes CRLF line ends, and names an unnamed frame 'message'", () => {
    expect(feed(["data: one\r\ndata:two\r\n\r\n"]).frames).toEqual([{ event: "message", data: "one\ntwo" }]);
  });

  it("ignores unknown fields and a blank line with nothing before it", () => {
    expect(feed(["\n\nid: 4\nretry: 100\n\n"]).frames).toEqual([]);
    expect(feed(["id: 4\nevent: board_changed\n\n"]).frames).toEqual([{ event: "board_changed", data: "" }]);
  });

  it("survives a chunk boundary inside a multi-byte character", () => {
    const bytes = encoder.encode(sseFrame("board_changed", { title: "Café" }));
    const cut = bytes.indexOf(0xc3) + 1;
    const { frames } = feed([bytes.slice(0, cut), bytes.slice(cut)]);
    expect(frames).toEqual([{ event: "board_changed", data: JSON.stringify({ title: "Café" }) }]);
  });

  it("never changes the state it was given", () => {
    const { state } = feed(["event: board_changed\n"]);
    const before = JSON.stringify({ event: state.event, data: state.data });
    parseSseChunk(state, encoder.encode("data: {}\n\n"));
    expect(JSON.stringify({ event: state.event, data: state.data })).toBe(before);
  });
});

describe("reconnectDelay", () => {
  it("starts at 1 s and doubles up to 30 s", () => {
    expect(RECONNECT_MIN_MS).toBe(1_000);
    expect(RECONNECT_MAX_MS).toBe(30_000);
    expect([0, 1, 2, 3, 4, 5, 6, 12].map(reconnectDelay)).toEqual([
      1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000, 30_000,
    ]);
  });
});
