// The chat stream parser: bytes in, typed events out. Spec:
// skills/build-automatos-interface/references/chat-stream.md.
//
// The splitter is pure: its state (the bytes of the unfinished last line) goes
// in and comes back out. It splits on the newline byte before decoding, and a
// newline byte never occurs inside a UTF-8 multi-byte character, so a chunk
// boundary inside a character can't corrupt it.

import { errorFromPayload, FALLBACK_ERROR, parseDataFrame, parseLegacyFrame } from "./data-events";
import { asObject, parseJson, text } from "./fields";
import type { ErrorEvent, StreamEvent } from "./types";

const NEWLINE = 0x0a;
const decoder = new TextDecoder("utf-8");

export type SplitterState = { readonly pending: Uint8Array };

export const INITIAL_SPLITTER: SplitterState = { pending: new Uint8Array(0) };

export type Split = { readonly state: SplitterState; readonly lines: readonly string[] };

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const joined = new Uint8Array(a.length + b.length);
  joined.set(a, 0);
  joined.set(b, a.length);
  return joined;
}

function decodeLine(bytes: Uint8Array): string {
  const line = decoder.decode(bytes);
  return line.endsWith("\r") ? line.slice(0, -1) : line;
}

/** The complete lines in pending + chunk, and the unfinished tail as the new state. */
export function splitLines(state: SplitterState, chunk: Uint8Array): Split {
  const bytes = concat(state.pending, chunk);
  const lines: string[] = [];
  let start = 0;
  for (let at = bytes.indexOf(NEWLINE); at >= 0; at = bytes.indexOf(NEWLINE, start)) {
    lines.push(decodeLine(bytes.subarray(start, at)));
    start = at + 1;
  }
  return { state: { pending: bytes.slice(start) }, lines };
}

/** The last line, when the stream ended without a newline. */
export function flushLines(state: SplitterState): readonly string[] {
  return state.pending.length > 0 ? [decodeLine(state.pending)] : [];
}

/** An e: line: {message, code} JSON, a bare JSON string, or plain text (Studio's parseErrorFrame). */
export function parseErrorLine(raw: string): ErrorEvent {
  const body = raw.trim();
  if (!body) return { type: "error", message: FALLBACK_ERROR, code: null };
  const value = parseJson(body);
  if (typeof value === "string") return { type: "error", message: value || FALLBACK_ERROR, code: null };
  const frame = asObject(value);
  if (frame) {
    // An e: frame names its sentence "message" first; a data payload names it "error" first.
    const message = text(frame, "message") ?? text(frame, "error") ?? FALLBACK_ERROR;
    return { ...errorFromPayload(frame), message };
  }
  return { type: "error", message: body, code: null };
}

function parseTextLine(raw: string): StreamEvent | null {
  const value = parseJson(raw);
  return typeof value === "string" && value.length > 0 ? { type: "text", text: value } : null;
}

/** One line as an event, or null for a blank, malformed or unrecognised line. Never throws. */
export function parseLine(line: string): StreamEvent | null {
  if (!line.trim()) return null;
  if (line.startsWith("0:")) return parseTextLine(line.slice(2));
  if (line.startsWith("d:")) return parseDataFrame(parseJson(line.slice(2)));
  if (line.startsWith("e:")) return parseErrorLine(line.slice(2));
  if (line.startsWith("data:")) return parseLegacyFrame(parseJson(line.slice(5).trimStart()));
  return null;
}

function toEvents(lines: readonly string[]): readonly StreamEvent[] {
  return lines.map(parseLine).filter((event): event is StreamEvent => event !== null);
}

export type ParseStep = { readonly state: SplitterState; readonly events: readonly StreamEvent[] };

/** Feed one chunk of the response body; returns the events of the lines it completed. */
export function parseChunk(state: SplitterState, chunk: Uint8Array): ParseStep {
  const split = splitLines(state, chunk);
  return { state: split.state, events: toEvents(split.lines) };
}

/** Call once the body ends: the events of a last line that had no newline. */
export function finishParse(state: SplitterState): readonly StreamEvent[] {
  return toEvents(flushLines(state));
}

/** Every event of a response body, in order. A read error (an abort) is thrown, not swallowed. */
export async function* readStreamEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<StreamEvent, void, undefined> {
  const reader = body.getReader();
  let state = INITIAL_SPLITTER;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const step = parseChunk(state, value);
      state = step.state;
      yield* step.events;
    }
    yield* finishParse(state);
  } finally {
    reader.releaseLock();
  }
}
