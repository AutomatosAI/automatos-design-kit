// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  ACTIVITY_LINES_KEPT,
  applyStreamEvent,
  autoMessage,
  endTurn,
  failTurn,
  turnRequest,
  updateMessage,
  userMessage,
  withoutNarration,
} from "@/lib/chat/turn";
import type { AutoMessage } from "@/lib/chat/types";
import type { StreamEvent, ToolEndEvent } from "@/lib/stream/types";

import { deepFreeze } from "../mascot/helpers";

const apply = (events: readonly StreamEvent[], from: AutoMessage = autoMessage("r1")): AutoMessage =>
  events.reduce(applyStreamEvent, deepFreeze(from));

const toolStart = (toolCallId: string, toolName = "platform_web_search"): StreamEvent => ({
  type: "tool-start",
  toolCallId,
  toolName,
  input: { query: "bikes" },
});

const toolEnd = (toolCallId: string, ended: Partial<ToolEndEvent> = {}): StreamEvent => ({
  type: "tool-end",
  toolCallId,
  toolName: "platform_web_search",
  success: true,
  error: null,
  durationMs: 2100,
  summary: "3 results",
  skipped: false,
  waiting: false,
  ...ended,
});

describe("lib/chat/turn", () => {
  it("builds the request body in chat-stream.md", () => {
    expect(turnRequest("", "hello")).toEqual({
      id: "",
      message: { role: "user", parts: [{ type: "text", text: "hello" }] },
      selectedVisibilityType: "private",
    });
    expect(turnRequest("chat-1", "again").id).toBe("chat-1");
  });

  it("joins text and reasoning deltas apart", () => {
    const reply = apply([
      { type: "reasoning", delta: "Hmm. " },
      { type: "text", text: "Hello " },
      { type: "reasoning", delta: "Done." },
      { type: "text", text: "there" },
    ]);
    expect(reply.text).toBe("Hello there");
    expect(reply.reasoning).toBe("Hmm. Done.");
  });

  it("moves narration out of the answer into activity, and drops a retracted round", () => {
    const reply = apply([
      { type: "text", text: "Let me check. " },
      { type: "narration", text: "Let me check. ", retracted: false },
      { type: "text", text: "It is done." },
      { type: "narration", text: "It is done.", retracted: true },
      { type: "text", text: "Here it is." },
    ]);
    expect(reply.text).toBe("Here it is.");
    expect(reply.activity).toEqual([{ kind: "narration", text: "Let me check. " }]);
  });

  it("removes only the last occurrence of the narrated text", () => {
    expect(withoutNarration("ok ok", "ok")).toBe("ok ");
    expect(withoutNarration("answer", "missing")).toBe("answer");
    expect(withoutNarration("answer", "")).toBe("answer");
  });

  it("keeps the newest progress and narration lines only", () => {
    const lines = Array.from({ length: ACTIVITY_LINES_KEPT + 3 }, (_, n): StreamEvent => ({
      type: "progress",
      text: `step ${n}`,
    }));
    const reply = apply(lines);
    expect(reply.activity).toHaveLength(ACTIVITY_LINES_KEPT);
    expect(reply.activity.at(-1)).toEqual({ kind: "progress", text: `step ${ACTIVITY_LINES_KEPT + 2}` });
  });

  it("tracks a tool line from start to end", () => {
    const running = apply([toolStart("t1")]);
    expect(running.tools).toEqual([
      {
        toolCallId: "t1",
        toolName: "platform_web_search",
        input: { query: "bikes" },
        status: "running",
        success: null,
        durationMs: null,
        summary: null,
        error: null,
      },
    ]);
    const ended = apply([toolEnd("t1")], running);
    expect(ended.tools[0]).toMatchObject({ status: "done", success: true, durationMs: 2100, summary: "3 results" });
  });

  it("names how a tool ended: failed, skipped, waiting", () => {
    const reply = apply([
      toolStart("a"),
      toolStart("b"),
      toolStart("c"),
      toolEnd("a", { success: false, error: "timeout" }),
      toolEnd("b", { success: false, skipped: true }),
      toolEnd("c", { success: false, waiting: true }),
    ]);
    expect(reply.tools.map((tool) => tool.status)).toEqual(["failed", "skipped", "waiting"]);
    expect(reply.tools[0]?.error).toBe("timeout");
  });

  it("adds a tool-end whose start it never saw", () => {
    const reply = apply([toolEnd("lost")]);
    expect(reply.tools).toHaveLength(1);
    expect(reply.tools[0]).toMatchObject({ toolCallId: "lost", status: "done", input: {} });
  });

  it("takes receipts and the lines above them from the receipts event, not tool-data", () => {
    const receipt = {
      action: "platform_web_search",
      kind: "read",
      status: "done",
      subject: "bikes",
      effect: "looked up",
      link: null,
      reason: null,
    } as const;
    const reply = apply([
      { type: "tool-data", data: { receipts: { receipts: [receipt] } } },
      { type: "receipts", receipts: [receipt], model: "m", above: ["Just to be clear"] },
    ]);
    expect(reply.receipts).toEqual([receipt]);
    expect(reply.above).toEqual(["Just to be clear"]);
  });

  it("ends a finished turn as done, closing tools still running", () => {
    const reply = apply([toolStart("t1"), { type: "finish", finishReason: "stop" }]);
    expect(reply.status).toBe("done");
    expect(reply.tools[0]?.status).toBe("done");
  });

  it("fails on an error line and stays failed when the body ends after it", () => {
    const failed = apply([
      toolStart("t1"),
      { type: "error", message: "The model is down.", code: "model_unavailable" },
    ]);
    expect(failed.status).toBe("failed");
    expect(failed.errors).toEqual(["The model is down."]);
    expect(failed.tools[0]?.status).toBe("stopped");
    expect(endTurn(failed, "done").status).toBe("failed");
  });

  it("keeps a finished turn done when a stop or a late error follows", () => {
    const done = apply([{ type: "finish", finishReason: "stop" }]);
    expect(endTurn(done, "stopped").status).toBe("done");
    expect(failTurn(done, "late").status).toBe("done");
  });

  it("marks a stopped turn and its running tools as stopped", () => {
    const stopped = endTurn(apply([toolStart("t1")]), "stopped");
    expect(stopped.status).toBe("stopped");
    expect(stopped.tools[0]?.status).toBe("stopped");
  });

  it("shows limits, withdrawn asks, blocked tools and request failures in words", () => {
    const reply = apply([
      { type: "limit_reached", limit: "tool_calls", value: 20, message: "Auto stopped after 20 tool calls." },
      { type: "withdraw_offer", message: "I've withdrawn that request.", requests: [] },
      { type: "tool-permission-denied", toolName: "platform_delete_agent", agentId: 1, reason: null },
      { type: "attachment_unavailable", attachments: [] },
    ]);
    expect(reply.notices).toEqual(["Auto stopped after 20 tool calls.", "I've withdrawn that request."]);
    expect(reply.errors).toEqual(["Auto wasn't allowed to use platform_delete_agent.", "Auto couldn't read an attachment."]);
    expect(failTurn(reply, "Automatos isn't running").errors.at(-1)).toBe("Automatos isn't running");
  });

  it("ignores unknown and bookkeeping events", () => {
    const start = autoMessage("r1");
    const reply = apply([{ type: "unknown", eventType: "new-thing" }, { type: "chat-id", chatId: "c" }], start);
    expect(reply).toBe(start);
  });

  it("updates only the reply with that id", () => {
    const you = userMessage("u1", "hi");
    const first = autoMessage("r1");
    const second = autoMessage("r2");
    const next = updateMessage([you, first, second], "r2", (reply) => ({ ...reply, text: "yo" }));
    expect(next[0]).toBe(you);
    expect(next[1]).toBe(first);
    expect(next[2]).toMatchObject({ id: "r2", text: "yo" });
  });
});
