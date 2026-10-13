// Shared by the stream tests and, later, the mascot and chat-hook tests: load a
// fixture, chunk it, and parse it the way the browser will.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { finishParse, INITIAL_SPLITTER, parseChunk } from "@/lib/stream/parse";
import type { StreamEvent } from "@/lib/stream/types";

export const FIXTURES = [
  "plain-answer",
  "web-search",
  "error-turn",
  "ask-waiting",
  "reasoning-narration",
] as const;

export type FixtureName = (typeof FIXTURES)[number];

const FIXTURE_DIR = new URL("../fixtures/", import.meta.url);

export function fixtureBytes(name: FixtureName): Uint8Array {
  return new Uint8Array(readFileSync(fileURLToPath(new URL(`${name}.txt`, FIXTURE_DIR))));
}

/** Parse the chunks in order, as one response body. */
export function parseChunks(chunks: readonly Uint8Array[]): readonly StreamEvent[] {
  const { state, events } = chunks.reduce(
    (acc, chunk) => {
      const step = parseChunk(acc.state, chunk);
      return { state: step.state, events: [...acc.events, ...step.events] };
    },
    { state: INITIAL_SPLITTER, events: [] as readonly StreamEvent[] },
  );
  return [...events, ...finishParse(state)];
}

/** The events of a whole fixture, read in one chunk. */
export function fixtureEvents(name: FixtureName): readonly StreamEvent[] {
  return parseChunks([fixtureBytes(name)]);
}

/** A small seeded PRNG (mulberry32), so a failing chunking can be replayed. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cut bytes into chunks of 1..maxSize bytes, with no regard for lines or characters. */
export function chunkRandomly(bytes: Uint8Array, random: () => number, maxSize: number): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  for (let start = 0; start < bytes.length; ) {
    const size = 1 + Math.floor(random() * maxSize);
    chunks.push(bytes.slice(start, start + size));
    start += size;
  }
  return chunks;
}

const JSON_PREFIXES = ["0:", "d:", "e:", "data:"] as const;

function reencodeLine(line: string): string {
  const prefix = JSON_PREFIXES.find((p) => line.startsWith(p));
  if (!prefix) return line;
  try {
    return prefix + JSON.stringify(JSON.parse(line.slice(prefix.length)));
  } catch {
    // A malformed line stays as it is: the parser must skip it in both variants.
    return line;
  }
}

/**
 * The fixture with every JSON line re-serialised by JSON.stringify, which writes
 * non-ASCII characters as raw UTF-8. Python's json.dumps escapes them (\u00e9),
 * so the recorded format is pure ASCII; this variant is what puts multi-byte
 * characters on the wire for the chunk-boundary tests. Same events either way.
 */
export function rawUtf8Variant(bytes: Uint8Array): Uint8Array {
  const body = new TextDecoder().decode(bytes);
  return new TextEncoder().encode(body.split("\n").map(reencodeLine).join("\n"));
}
