// @vitest-environment node
import { describe, expect, it } from "vitest";

import { FALLBACK_ERROR } from "@/lib/stream/data-events";
import {
  flushLines,
  INITIAL_SPLITTER,
  parseErrorLine,
  parseLine,
  readStreamEvents,
  splitLines,
} from "@/lib/stream/parse";
import type { StreamEvent } from "@/lib/stream/types";

const encode = (text: string): Uint8Array => new TextEncoder().encode(text);

describe("splitLines", () => {
  it("returns complete lines and keeps the unfinished tail", () => {
    const first = splitLines(INITIAL_SPLITTER, encode('0:"a"\n0:"b'));
    expect(first.lines).toEqual(['0:"a"']);
    const second = splitLines(first.state, encode('"\n'));
    expect(second.lines).toEqual(['0:"b"']);
    expect(flushLines(second.state)).toEqual([]);
  });

  it("strips a trailing carriage return and flushes a last line with no newline", () => {
    const split = splitLines(INITIAL_SPLITTER, encode('0:"a"\r\n0:"b"'));
    expect(split.lines).toEqual(['0:"a"']);
    expect(flushLines(split.state)).toEqual(['0:"b"']);
  });

  it("never changes the state it is given", () => {
    const state = splitLines(INITIAL_SPLITTER, encode("0:")).state;
    const before = Array.from(state.pending);
    splitLines(state, encode('"x"\n'));
    expect(Array.from(state.pending)).toEqual(before);
    expect(INITIAL_SPLITTER.pending.length).toBe(0);
  });
});

describe("parseLine", () => {
  it("parses a text delta and skips an empty or non-string one", () => {
    expect(parseLine('0:"Hi \\u00e9"')).toEqual({ type: "text", text: "Hi é" });
    expect(parseLine('0:""')).toBeNull();
    expect(parseLine("0:42")).toBeNull();
  });

  it("skips blank, malformed and unrecognised lines without throwing", () => {
    const bad = ["", "   ", "0:not json", 'd:{"type": "tool-start"', "d:[1,2]", "d:null", 'd:{"data": {}}', "x:{}", "# a comment"];
    for (const line of bad) expect(parseLine(line)).toBeNull();
  });

  it("turns an unknown d: type into an unknown event", () => {
    expect(parseLine('d:{"type": "brand-new-thing", "data": {"x": 1}}')).toEqual({
      type: "unknown",
      eventType: "brand-new-thing",
    });
    expect(parseLine('d:{"type": "constructor"}')).toEqual({ type: "unknown", eventType: "constructor" });
  });

  it("skips a known type whose required fields are missing", () => {
    expect(parseLine('d:{"type": "tool-start", "data": {"toolName": "x"}}')).toBeNull();
    expect(parseLine('d:{"type": "reasoning", "data": {"delta": 3}}')).toBeNull();
    expect(parseLine('d:{"type": "progress"}')).toBeNull();
    expect(parseLine('d:{"type":"chat-id"}')).toBeNull();
    expect(parseLine('d:{"type": "limit_reached", "data": {"limit": "steps"}}')).toBeNull();
  });

  it("reads chat-id and finish at the top level", () => {
    expect(parseLine('d:{"type":"chat-id","chatId":"c-1"}')).toEqual({ type: "chat-id", chatId: "c-1" });
    expect(parseLine('d:{"type":"finish","finishReason":"length"}')).toEqual({
      type: "finish",
      finishReason: "length",
    });
  });

  it("reads agent-info both flat and nested under type, as the backend sends it", () => {
    const expected: StreamEvent = {
      type: "agent-info",
      agent: { id: 9, name: "Auto CTO", agentType: "cto", skills: ["a"], isCto: true },
    };
    const agent = '{"id": 9, "name": "Auto CTO", "type": "cto", "skills": ["a", 2], "is_cto": true}';
    expect(parseLine(`d:{"type": "agent-info", "agent": ${agent}}`)).toEqual(expected);
    expect(parseLine(`d:{"type": {"type": "agent-info", "agent": ${agent}}}`)).toEqual(expected);
  });

  it("reads a tool-end ask, a skipped call and a failure", () => {
    const ask = parseLine(
      'd:{"type": "tool-end", "data": {"toolCallId": "t1", "toolName": "x", "success": false, "waiting": true}}',
    );
    expect(ask).toMatchObject({ type: "tool-end", success: false, waiting: true, skipped: false });
    const skipped = parseLine('d:{"type": "tool-end", "data": {"toolCallId": "t2", "success": false, "skipped": true}}');
    expect(skipped).toMatchObject({ toolName: "tool", skipped: true, waiting: false, durationMs: null });
    const failed = parseLine(
      'd:{"type": "tool-end", "data": {"toolCallId": "t3", "toolName": "y", "success": false, "error": "boom"}}',
    );
    expect(failed).toMatchObject({ success: false, error: "boom", summary: null });
  });

  it("reads narration, retracted narration and progress", () => {
    expect(parseLine('d:{"type": "narration", "data": {"text": "x", "retracted": true}}')).toEqual({
      type: "narration",
      text: "x",
      retracted: true,
    });
    expect(parseLine('d:{"type": "progress", "data": {"text": "Step 2"}}')).toEqual({ type: "progress", text: "Step 2" });
  });

  it("keeps well-formed receipts and drops ones it can't trust", () => {
    const line =
      'd:{"type": "receipts", "data": {"receipts": [' +
      '{"action": "a", "kind": "write", "status": "refused", "subject": "s", "effect": "e", "link": null, "reason": "no"},' +
      '{"action": "b", "status": "exploded"}, {"status": "done"}, 7], "above": ["Just to be clear", 1]}}';
    expect(parseLine(line)).toEqual({
      type: "receipts",
      receipts: [{ action: "a", kind: "write", status: "refused", subject: "s", effect: "e", link: null, reason: "no" }],
      model: null,
      above: ["Just to be clear"],
    });
  });

  it("reads the other data events", () => {
    expect(parseLine('d:{"type": "limit_reached", "data": {"limit": "steps", "value": 20, "message": "Stopped"}}')).toEqual({
      type: "limit_reached",
      limit: "steps",
      value: 20,
      message: "Stopped",
    });
    expect(parseLine('d:{"type": "tool-permission-denied", "data": {"toolName": "t", "agentId": 3, "reason": "r"}}')).toEqual({
      type: "tool-permission-denied",
      toolName: "t",
      agentId: 3,
      reason: "r",
    });
    expect(parseLine('d:{"type": "workflow-update", "data": {"workflowId": "w", "status": "running"}}')).toMatchObject({
      type: "workflow-update",
      currentStep: null,
      progress: null,
    });
    expect(parseLine('d:{"type": "memory-injected", "data": {"memories": [{}], "totalMatched": 4}}')).toEqual({
      type: "memory-injected",
      memories: [{}],
      totalMatched: 4,
    });
    expect(parseLine('d:{"type": "mission-suggestion", "data": {"goal": "g", "complexity": "high", "agent_id": 2}}')).toEqual({
      type: "mission-suggestion",
      goal: "g",
      complexity: "high",
      agentId: 2,
    });
  });
});

describe("error lines", () => {
  it("reads {message, code}, a bare string, plain text and an empty line", () => {
    expect(parseLine('e:{"message": "Oh no", "code": "rate_limited"}')).toEqual({
      type: "error",
      message: "Oh no",
      code: "rate_limited",
    });
    expect(parseErrorLine('"turn died"')).toEqual({ type: "error", message: "turn died", code: null });
    expect(parseErrorLine("not json at all")).toEqual({ type: "error", message: "not json at all", code: null });
    expect(parseErrorLine("")).toEqual({ type: "error", message: FALLBACK_ERROR, code: null });
    expect(parseErrorLine("{}")).toEqual({ type: "error", message: FALLBACK_ERROR, code: null });
  });
});

describe("legacy data: lines", () => {
  it("maps text-delta, data-usage, error and done", () => {
    expect(parseLine('data: {"type": "text-delta", "delta": "hi"}')).toEqual({ type: "text", text: "hi" });
    expect(parseLine('data:{"type": "data-usage", "data": {"totalTokens": 5}}')).toEqual({
      type: "usage",
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 5,
    });
    expect(parseLine('data: {"type": "error", "error": "Trial over", "error_code": "trial_exhausted"}')).toEqual({
      type: "error",
      message: "Trial over",
      code: "trial_exhausted",
    });
    expect(parseLine('data: {"type": "done"}')).toEqual({ type: "finish", finishReason: null });
    expect(parseLine('data: {"type": "tool-data", "data": {"documents": []}}')).toEqual({
      type: "tool-data",
      data: { documents: [] },
    });
  });

  it("skips [DONE] and an unknown legacy type becomes unknown", () => {
    expect(parseLine("data: [DONE]")).toBeNull();
    expect(parseLine('data: {"type": "ping"}')).toEqual({ type: "unknown", eventType: "ping" });
  });
});

describe("readStreamEvents", () => {
  it("yields the events of a ReadableStream body in order", async () => {
    const parts = ['d:{"type":"chat-id","chatId":"c"}\n0:"He', 'llo"\nd:{"type":"finish","finishReason":"stop"}'];
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const part of parts) controller.enqueue(encode(part));
        controller.close();
      },
    });
    const events: StreamEvent[] = [];
    for await (const event of readStreamEvents(body)) events.push(event);
    expect(events).toEqual([
      { type: "chat-id", chatId: "c" },
      { type: "text", text: "Hello" },
      { type: "finish", finishReason: "stop" },
    ]);
  });

  it("throws a read error instead of swallowing it", async () => {
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error("aborted"));
      },
    });
    const seen: StreamEvent[] = [];
    const drain = async () => {
      for await (const event of readStreamEvents(body)) seen.push(event);
    };
    await expect(drain()).rejects.toThrow("aborted");
  });
});
