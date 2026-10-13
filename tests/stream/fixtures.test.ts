// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { Receipt, StreamEvent } from "@/lib/stream/types";

import {
  chunkRandomly,
  fixtureBytes,
  fixtureEvents,
  FIXTURES,
  type FixtureName,
  parseChunks,
  rawUtf8Variant,
  seededRandom,
} from "./helpers";

const CHAT_ID: StreamEvent = { type: "chat-id", chatId: "6f1c2a9e-3b7d-4c8a-9e21-5d0f4b8a7c13" };
const AGENT: StreamEvent = {
  type: "agent-info",
  agent: { id: 1, name: "Auto", agentType: "assistant", skills: ["research", "writing"], isCto: false },
};
const FINISH: StreamEvent = { type: "finish", finishReason: "stop" };

const say = (text: string): StreamEvent => ({ type: "text", text });
const think = (delta: string): StreamEvent => ({ type: "reasoning", delta });
const usage = (promptTokens: number, completionTokens: number, totalTokens: number): StreamEvent => ({
  type: "usage",
  promptTokens,
  completionTokens,
  totalTokens,
});
const toolStart = (toolCallId: string, toolName: string, input: Record<string, unknown>): StreamEvent => ({
  type: "tool-start",
  toolCallId,
  toolName,
  input,
});
const toolEnd = (
  toolCallId: string,
  toolName: string,
  fields: { success: boolean; durationMs: number; summary: string; waiting?: boolean },
): StreamEvent => ({
  type: "tool-end",
  toolCallId,
  toolName,
  success: fields.success,
  error: null,
  durationMs: fields.durationMs,
  summary: fields.summary,
  skipped: false,
  waiting: fields.waiting ?? false,
});
const receipt = (action: string, kind: string, status: Receipt["status"], subject: string, effect: string): Receipt => ({
  action,
  kind,
  status,
  subject,
  effect,
  link: null,
  reason: null,
});
/** The backend sends the receipts twice: on tool-data (for Studio) and as their own frame. */
const receiptFrames = (receipts: readonly Receipt[]): readonly StreamEvent[] => [
  { type: "tool-data", data: { receipts: { receipts, model: "test-model" } } },
  { type: "receipts", receipts, model: "test-model", above: [] },
];

const WEB = receipt("platform_web_search", "read", "done", "electric bikes 2026", "looked up");
const ASK = receipt("platform_update_agent", "write", "waiting", "Scout", "card raised: change the agent 'Scout'");
const DOCS = receipt("platform_search_documents", "read", "done", "onboarding", "looked up");
const ASK_SUMMARY = "Card raised: change the agent 'Scout'. Nothing changes until the owner clicks.";

const EXPECTED: Readonly<Record<FixtureName, readonly StreamEvent[]>> = {
  "plain-answer": [
    CHAT_ID,
    AGENT,
    say("Hi! I'm Auto, "),
    say("your Automatos. What shall "),
    say("we make today? "),
    say("A report, a café menu "),
    say("— anything \u{1F389}"),
    usage(812, 21, 833),
    ...receiptFrames([]),
    FINISH,
  ],
  "web-search": [
    CHAT_ID,
    AGENT,
    toolStart("call_ws_01", "platform_web_search", { query: "electric bikes 2026" }),
    toolEnd("call_ws_01", "platform_web_search", { success: true, durationMs: 2140, summary: "3 results" }),
    say("I found three good options. "),
    say("The **Volt One** leads on range, "),
    say("and the Cargo Pro on price."),
    usage(2410, 96, 2506),
    ...receiptFrames([WEB]),
    FINISH,
  ],
  "error-turn": [
    CHAT_ID,
    AGENT,
    think("The user wants a summary."),
    {
      type: "error",
      message: "Auto's model is not available: the provider returned 503.",
      code: "model_unavailable",
    },
  ],
  "ask-waiting": [
    CHAT_ID,
    AGENT,
    toolStart("call_ask_01", "platform_update_agent", { agent_id: 7, name: "Scout" }),
    toolEnd("call_ask_01", "platform_update_agent", {
      success: false,
      durationMs: 38,
      summary: ASK_SUMMARY,
      waiting: true,
    }),
    say("I've raised a card to rename Scout. "),
    say("Nothing changes until you click it."),
    usage(1530, 40, 1570),
    ...receiptFrames([ASK]),
    FINISH,
  ],
  "reasoning-narration": [
    CHAT_ID,
    AGENT,
    think("They want the onboarding steps. "),
    think("I should check their documents."),
    say("Let me look through "),
    say("your documents first."),
    { type: "narration", text: "Let me look through your documents first.", retracted: false },
    toolStart("call_doc_01", "platform_search_documents", { query: "onboarding" }),
    { type: "progress", text: "Searching 12 documents" },
    toolEnd("call_doc_01", "platform_search_documents", { success: true, durationMs: 860, summary: "3 documents" }),
    think("Found the checklist."),
    say("Onboarding has three steps:\n\n"),
    say("1. Create the workspace\n2. Add "),
    say("an agent\n3. Start a Mission"),
    usage(3120, 180, 3300),
    ...receiptFrames([DOCS]),
    FINISH,
  ],
};

const RUNS = 150;

function hasMultiByte(bytes: Uint8Array): boolean {
  return bytes.some((byte) => byte >= 0x80);
}

describe("stream fixtures", () => {
  it.each(FIXTURES)("%s parses to the expected events", (name) => {
    expect(fixtureEvents(name)).toEqual(EXPECTED[name]);
  });

  it.each(FIXTURES)("%s gives the same events in random chunk sizes", (name) => {
    const bytes = fixtureBytes(name);
    const random = seededRandom(name.length * 7919);
    for (let run = 0; run < RUNS; run += 1) {
      const chunks = chunkRandomly(bytes, random, 1 + (run % 32));
      expect(parseChunks(chunks)).toEqual(EXPECTED[name]);
    }
  });

  it.each(FIXTURES)("%s as raw UTF-8 survives chunks split inside a character", (name) => {
    const bytes = rawUtf8Variant(fixtureBytes(name));
    const random = seededRandom(name.length * 104729);
    for (let run = 0; run < RUNS; run += 1) {
      const chunks = chunkRandomly(bytes, random, 1 + (run % 8));
      expect(parseChunks(chunks)).toEqual(EXPECTED[name]);
    }
  });

  it("splits the raw UTF-8 plain answer at every byte, including inside é, — and 🎉", () => {
    const bytes = rawUtf8Variant(fixtureBytes("plain-answer"));
    expect(hasMultiByte(bytes)).toBe(true);
    for (let at = 0; at <= bytes.length; at += 1) {
      expect(parseChunks([bytes.slice(0, at), bytes.slice(at)])).toEqual(EXPECTED["plain-answer"]);
    }
  });

  it("feeds a multi-byte character one byte at a time", () => {
    const bytes = rawUtf8Variant(fixtureBytes("plain-answer"));
    const oneByOne = Array.from(bytes, (byte) => Uint8Array.of(byte));
    expect(parseChunks(oneByOne)).toEqual(EXPECTED["plain-answer"]);
  });

  it("keeps the fixtures in the backend's ASCII-only format, each marked synthetic", () => {
    for (const name of FIXTURES) {
      const bytes = fixtureBytes(name);
      expect(hasMultiByte(bytes)).toBe(false);
      expect(new TextDecoder().decode(bytes).startsWith("# SYNTHETIC fixture")).toBe(true);
    }
  });
});
