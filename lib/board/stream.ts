// The board's live stream (board-analytics.md, "Live updates"): server-sent events from
// GET /api/v1/tasks/stream. The backend sends `event: board_changed` once on connect and
// on every change, `event: chat_changed` for chats (not the board's business), and a
// `: hb` comment as a heartbeat, which never means a refetch.
//
// The parser is pure: its state (the unfinished line and the frame being read) goes in
// and comes back out. Lines are split on the newline byte before decoding, as the chat
// stream does (lib/stream/parse.ts), so a chunk boundary inside a character is safe.

import { INITIAL_SPLITTER, splitLines, type SplitterState } from "@/lib/stream/parse";

/** The frame that means "refetch the board". */
export const BOARD_CHANGED = "board_changed";

/** Reconnect backoff: 1 s, doubling up to 30 s (the skill's numbers). */
export const RECONNECT_MIN_MS = 1_000;
export const RECONNECT_MAX_MS = 30_000;

/** One dispatched SSE frame: its event name ("message" when unnamed) and its data lines joined. */
export type SseFrame = { readonly event: string; readonly data: string };

type PendingFrame = { readonly event: string | null; readonly data: readonly string[] };

export type SseState = PendingFrame & { readonly splitter: SplitterState };

const NO_FRAME: PendingFrame = { event: null, data: [] };

export const INITIAL_SSE: SseState = { ...NO_FRAME, splitter: INITIAL_SPLITTER };

export type SseStep = { readonly state: SseState; readonly frames: readonly SseFrame[] };

/** "name: value" with the one optional space after the colon removed; a bare line is a name. */
function fieldOf(line: string): { readonly name: string; readonly value: string } {
  const colon = line.indexOf(":");
  if (colon < 0) return { name: line, value: "" };
  const raw = line.slice(colon + 1);
  return { name: line.slice(0, colon), value: raw.startsWith(" ") ? raw.slice(1) : raw };
}

function dispatched(pending: PendingFrame): SseFrame | null {
  if (pending.event === null && pending.data.length === 0) return null;
  return { event: pending.event || "message", data: pending.data.join("\n") };
}

/** One line: a blank line ends the frame, a ":" line is a comment, other fields are ignored. */
function readLine(pending: PendingFrame, line: string): { readonly pending: PendingFrame; readonly frame: SseFrame | null } {
  if (line === "") return { pending: NO_FRAME, frame: dispatched(pending) };
  if (line.startsWith(":")) return { pending, frame: null };
  const { name, value } = fieldOf(line);
  if (name === "event") return { pending: { ...pending, event: value }, frame: null };
  if (name === "data") return { pending: { ...pending, data: [...pending.data, value] }, frame: null };
  return { pending, frame: null };
}

/** The frames completed by this chunk, and the state to read the next one with. */
export function parseSseChunk(state: SseState, chunk: Uint8Array): SseStep {
  const split = splitLines(state.splitter, chunk);
  const frames: SseFrame[] = [];
  let pending: PendingFrame = { event: state.event, data: state.data };
  for (const line of split.lines) {
    const next = readLine(pending, line);
    pending = next.pending;
    if (next.frame) frames.push(next.frame);
  }
  return { state: { ...pending, splitter: split.state }, frames };
}

export function isBoardChange(frame: SseFrame): boolean {
  return frame.event === BOARD_CHANGED;
}

/** The wait before reconnect number `attempt` (0 for the first): 1 s, 2 s, 4 s … 30 s. */
export function reconnectDelay(attempt: number): number {
  return Math.min(RECONNECT_MIN_MS * 2 ** Math.max(0, attempt), RECONNECT_MAX_MS);
}
