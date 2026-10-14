// Pure updates of the chat message model: (message, event) => message. No React,
// no fetch. Spec: skills/build-automatos-interface/references/chat-stream.md, and
// Studio's handling in automatos-ai/frontend/lib/chat/hooks.ts (narration, progress).

import type { ChatTurnRequest } from "@/lib/client/types";
import type { NarrationEvent, StreamEvent, ToolEndEvent, ToolStartEvent } from "@/lib/stream/types";

import { deliverablesFromReceipts, withDeliverables, withToolData } from "./deliverables";
import type { ActivityLine, AutoMessage, ChatMessage, ToolLine, ToolStatus, TurnStatus, UserMessage } from "./types";

/** Studio keeps the newest six narration and progress lines per reply. */
export const ACTIVITY_LINES_KEPT = 6;

export function userMessage(id: string, text: string): UserMessage {
  return { id, role: "user", text };
}

export function autoMessage(id: string): AutoMessage {
  return {
    id,
    role: "assistant",
    text: "",
    reasoning: "",
    tools: [],
    receipts: [],
    above: [],
    activity: [],
    notices: [],
    errors: [],
    missionSuggestion: null,
    deliverables: [],
    status: "streaming",
  };
}

/** The request body in chat-stream.md: id "" on the first message, the chat-id after. */
export function turnRequest(chatId: string, text: string): ChatTurnRequest {
  return {
    id: chatId,
    message: { role: "user", parts: [{ type: "text", text }] },
    selectedVisibilityType: "private",
  };
}

/** The message with this id passed through update; the others unchanged. */
export function updateMessage(
  messages: readonly ChatMessage[],
  id: string,
  update: (message: AutoMessage) => AutoMessage,
): readonly ChatMessage[] {
  return messages.map((message) => (message.id === id && message.role === "assistant" ? update(message) : message));
}

/** text without the last occurrence of said: the round the narration event just marked. */
export function withoutNarration(text: string, said: string): string {
  if (!said) return text;
  const at = text.lastIndexOf(said);
  return at < 0 ? text : text.slice(0, at) + text.slice(at + said.length);
}

function withActivity(message: AutoMessage, line: ActivityLine): AutoMessage {
  return { ...message, activity: [...message.activity.slice(-(ACTIVITY_LINES_KEPT - 1)), line] };
}

function onNarration(message: AutoMessage, event: NarrationEvent): AutoMessage {
  const moved = { ...message, text: withoutNarration(message.text, event.text) };
  // A retracted round is replaced by its retry, so it leaves no trail.
  return event.retracted ? moved : withActivity(moved, { kind: "narration", text: event.text });
}

function onToolStart(message: AutoMessage, event: ToolStartEvent): AutoMessage {
  const line: ToolLine = {
    toolCallId: event.toolCallId,
    toolName: event.toolName,
    input: event.input,
    status: "running",
    success: null,
    durationMs: null,
    summary: null,
    error: null,
  };
  return { ...message, tools: [...message.tools, line] };
}

function endedStatus(event: ToolEndEvent): ToolStatus {
  if (event.waiting) return "waiting";
  if (event.skipped) return "skipped";
  return event.success ? "done" : "failed";
}

function onToolEnd(message: AutoMessage, event: ToolEndEvent): AutoMessage {
  const ended = {
    status: endedStatus(event),
    success: event.success,
    durationMs: event.durationMs,
    summary: event.summary,
    error: event.error,
  };
  const known = message.tools.some((tool) => tool.toolCallId === event.toolCallId);
  const tools = known
    ? message.tools.map((tool) => (tool.toolCallId === event.toolCallId ? { ...tool, ...ended } : tool))
    : [...message.tools, { toolCallId: event.toolCallId, toolName: event.toolName, input: {}, ...ended }];
  return { ...message, tools };
}

/** Tools still running when the turn ends: done on a finish (Studio does the same), else stopped. */
function closeTools(tools: readonly ToolLine[], status: TurnStatus): readonly ToolLine[] {
  if (!tools.some((tool) => tool.status === "running")) return tools;
  const closed: ToolStatus = status === "done" ? "done" : "stopped";
  return tools.map((tool) => (tool.status === "running" ? { ...tool, status: closed } : tool));
}

/** The turn is over. The first ending wins: a failed turn stays failed when a finish or the body's end follows. */
export function endTurn(message: AutoMessage, status: TurnStatus): AutoMessage {
  const outcome = message.status === "streaming" ? status : message.status;
  return { ...message, status: outcome, tools: closeTools(message.tools, outcome) };
}

export function failTurn(message: AutoMessage, error: string): AutoMessage {
  return endTurn({ ...message, errors: [...message.errors, error] }, "failed");
}

export function withNotice(message: AutoMessage, notice: string): AutoMessage {
  return { ...message, notices: [...message.notices, notice] };
}

/** One stream event applied to the reply it belongs to. Unknown and bookkeeping events change nothing. */
export function applyStreamEvent(message: AutoMessage, event: StreamEvent): AutoMessage {
  switch (event.type) {
    case "text":
      return { ...message, text: message.text + event.text };
    case "reasoning":
      return { ...message, reasoning: message.reasoning + event.delta };
    case "narration":
      return onNarration(message, event);
    case "progress":
      return withActivity(message, { kind: "progress", text: event.text });
    case "tool-start":
      return onToolStart(message, event);
    case "tool-end":
      return onToolEnd(message, event);
    case "tool-data":
      return withToolData(message, event.data);
    case "receipts":
      return withDeliverables(
        { ...message, receipts: event.receipts, above: event.above },
        deliverablesFromReceipts(event.receipts),
      );
    case "mission-suggestion":
      return { ...message, missionSuggestion: { goal: event.goal, complexity: event.complexity } };
    case "limit_reached":
      return withNotice(message, event.message);
    case "withdraw_offer":
      return event.message ? withNotice(message, event.message) : message;
    case "tool-permission-denied":
      return { ...message, errors: [...message.errors, `Auto wasn't allowed to use ${event.toolName}.`] };
    case "attachment_unavailable":
      return { ...message, errors: [...message.errors, "Auto couldn't read an attachment."] };
    case "error":
      return failTurn(message, event.message);
    case "finish":
      return endTurn(message, "done");
    default:
      return message;
  }
}
