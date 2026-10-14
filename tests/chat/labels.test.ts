// @vitest-environment node
import { describe, expect, it } from "vitest";

import { chatCaption, ON_THE_SHELF } from "@/lib/chat/caption";
import { formatDuration, receiptLabel, toolDetail, toolLineLabel } from "@/lib/chat/labels";
import { autoMessage } from "@/lib/chat/turn";
import type { ToolLine } from "@/lib/chat/types";
import type { Receipt } from "@/lib/stream/types";

// Tool names appear only here in tests: lib/mascot/tools.ts owns them in the app.
const WEB = "platform_web_search";
const DOCS = "platform_search_documents";
const OTHER = "platform_update_agent";

function tool(overrides: Partial<ToolLine>): ToolLine {
  return {
    toolCallId: "t1",
    toolName: WEB,
    input: { query: "electric bikes 2026" },
    status: "running",
    success: null,
    durationMs: null,
    summary: null,
    error: null,
    ...overrides,
  };
}

function receipt(overrides: Partial<Receipt>): Receipt {
  return {
    action: WEB,
    kind: "read",
    status: "done",
    subject: "electric bikes 2026",
    effect: "looked up",
    link: null,
    reason: null,
    ...overrides,
  };
}

describe("tool lines", () => {
  it("running: a spinner (no mark) and the query in quotes", () => {
    expect(toolLineLabel(tool({}))).toEqual({
      mark: null,
      text: "Searching the web: 'electric bikes 2026'",
      tone: "running",
    });
  });

  it("done: the past tense, the summary and the seconds", () => {
    const done = tool({ status: "done", success: true, durationMs: 2140, summary: "3 results" });
    expect(toolLineLabel(done)).toEqual({ mark: "✓", text: "Searched the web · 3 results · 2.1 s", tone: "done" });
  });

  it("done without a summary or a duration", () => {
    expect(toolLineLabel(tool({ status: "done" })).text).toBe("Searched the web");
  });

  it("reading and other tools get words from their activity or their name", () => {
    expect(toolLineLabel(tool({ toolName: DOCS, input: {} })).text).toBe("Looking through your files");
    expect(toolLineLabel(tool({ toolName: OTHER, input: { name: "Scout" } })).text).toBe("Using update agent: 'Scout'");
    expect(toolLineLabel(tool({ toolName: OTHER, status: "done", durationMs: 38 })).text).toBe("Used update agent · 0.0 s");
  });

  it("failed: coral, with the error in words", () => {
    const failed = tool({ status: "failed", success: false, error: "The search service is down" });
    expect(toolLineLabel(failed)).toEqual({
      mark: "✕",
      text: "The web search didn't work · The search service is down",
      tone: "failed",
    });
  });

  it("waiting, skipped and stopped", () => {
    expect(toolLineLabel(tool({ status: "waiting", summary: "Card raised" }))).toMatchObject({
      text: "Waiting for you · Card raised",
      tone: "waiting",
    });
    expect(toolLineLabel(tool({ status: "skipped" }))).toMatchObject({ text: "Skipped: searching the web", tone: "muted" });
    expect(toolLineLabel(tool({ status: "stopped" }))).toMatchObject({ text: "Stopped: searching the web", tone: "muted" });
  });

  it("toolDetail picks the first useful input and shortens long ones", () => {
    expect(toolDetail({ url: "https://example.com" })).toBe("https://example.com");
    expect(toolDetail({ query: "  ", title: "Plan" })).toBe("Plan");
    expect(toolDetail({ count: 3 })).toBeNull();
    const long = toolDetail({ query: "x".repeat(200) });
    expect(long).toHaveLength(80);
    expect(long?.endsWith("…")).toBe(true);
  });

  it("formatDuration", () => {
    expect(formatDuration(2140)).toBe("2.1 s");
    expect(formatDuration(6000)).toBe("6.0 s");
    expect(formatDuration(null)).toBeNull();
  });
});

describe("receipts", () => {
  it("a done read says what was looked up", () => {
    expect(receiptLabel(receipt({}))).toEqual({
      mark: "✓",
      text: "Searched the web: electric bikes 2026",
      tone: "done",
      badge: null,
      reason: null,
    });
  });

  it("a done write gets the Done badge", () => {
    const made = receipt({ action: OTHER, kind: "write", subject: "Laptop shortlist", effect: "document made" });
    expect(receiptLabel(made)).toMatchObject({ text: "Document made: Laptop shortlist", badge: "Done" });
  });

  it("a waiting write doesn't repeat a subject its effect already names", () => {
    const ask = receipt({
      action: OTHER,
      kind: "write",
      status: "waiting",
      subject: "Scout",
      effect: "card raised: change the agent 'Scout'",
    });
    expect(receiptLabel(ask)).toMatchObject({
      mark: "…",
      text: "Card raised: change the agent 'Scout'",
      tone: "waiting",
      badge: "Waiting for you",
    });
  });

  it("refused and skipped carry their reason", () => {
    const refused = receipt({ action: OTHER, kind: "write", status: "refused", subject: "", effect: "agent set", reason: "no such agent" });
    expect(receiptLabel(refused)).toMatchObject({ mark: "✕", text: "Agent set", badge: "Not done", reason: "no such agent" });
    const skipped = receipt({ status: "skipped", reason: "the same request already ran in this reply" });
    expect(receiptLabel(skipped)).toMatchObject({ tone: "muted", badge: "Skipped", reason: "the same request already ran in this reply" });
  });

  it("the folded automatic reads read as their effect", () => {
    const folded = receipt({ action: "automatic_reads", subject: "", effect: "read your documents and the board" });
    expect(receiptLabel(folded).text).toBe("Read your documents and the board");
  });
});

describe("the caption under Auto", () => {
  it("adds the running search query while Auto searches", () => {
    const reply = { ...autoMessage("r1"), tools: [tool({})] };
    expect(chatCaption("searching", reply)).toEqual({ caption: "Searching the web", detail: "electric bikes 2026" });
  });

  it("names the Deliverable while Auto celebrates one", () => {
    const reply = { ...autoMessage("r1"), deliverables: [{ id: "d1", title: "Laptop shortlist", kind: "report" }] };
    expect(chatCaption("celebrate", reply)).toEqual({ caption: "Your report is ready", detail: ON_THE_SHELF });
  });

  it("falls back to the state's own words", () => {
    expect(chatCaption("idle", undefined)).toEqual({ caption: "Ready when you are" });
    expect(chatCaption("celebrate", autoMessage("r1"))).toEqual({ caption: "All done" });
  });
});
