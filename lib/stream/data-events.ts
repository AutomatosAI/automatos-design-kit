// Turns the JSON of a d: or data: line into a typed event. A known type whose
// required fields are missing is malformed: it returns null and the line is
// skipped. An unknown type returns {type:"unknown"}. Spec: chat-stream.md.

import { asObject, bool, list, num, obj, str, strings, text } from "./fields";
import type {
  AgentInfo,
  ErrorEvent,
  JsonObject,
  Receipt,
  ReceiptStatus,
  StreamEvent,
} from "./types";

type Decoder = (frame: JsonObject) => StreamEvent | null;

export const FALLBACK_ERROR = "The reply failed. Try again.";

const RECEIPT_STATUSES: readonly ReceiptStatus[] = ["done", "refused", "skipped", "waiting"];

/** One receipt from a stream frame or a saved message's receipts part. */
export function parseReceipt(value: unknown): Receipt | null {
  const o = asObject(value);
  const action = o ? text(o, "action") : null;
  const status = o ? str(o, "status") : null;
  const known = RECEIPT_STATUSES.find((s) => s === status);
  if (!o || !action || !known) return null;
  return {
    action,
    kind: str(o, "kind") ?? "",
    status: known,
    subject: str(o, "subject") ?? "",
    effect: str(o, "effect") ?? "",
    link: text(o, "link"),
    reason: text(o, "reason"),
  };
}

function agentInfo(value: unknown): AgentInfo | null {
  const o = asObject(value);
  if (!o) return null;
  return {
    id: num(o, "id"),
    name: str(o, "name") ?? "Auto",
    agentType: str(o, "type"),
    skills: strings(o, "skills"),
    isCto: bool(o, "is_cto"),
  };
}

/** The error a data payload carries ({error|message, code|error_code}). */
export function errorFromPayload(o: JsonObject): ErrorEvent {
  return {
    type: "error",
    message: text(o, "error") ?? text(o, "message") ?? FALLBACK_ERROR,
    code: str(o, "code") ?? str(o, "error_code"),
  };
}

function usage(d: JsonObject): StreamEvent {
  return {
    type: "usage",
    promptTokens: num(d, "promptTokens") ?? 0,
    completionTokens: num(d, "completionTokens") ?? 0,
    totalTokens: num(d, "totalTokens") ?? 0,
  };
}

/** Decoders that read the payload under "data". */
const UNDER_DATA: Readonly<Record<string, (d: JsonObject) => StreamEvent | null>> = {
  "agent-assigned": (d) => ({
    type: "agent-assigned",
    agentId: num(d, "agentId"),
    agentName: str(d, "agentName") ?? "",
    routeMethod: str(d, "routeMethod"),
  }),
  reasoning: (d) => {
    const delta = str(d, "delta");
    return delta === null ? null : { type: "reasoning", delta };
  },
  progress: (d) => {
    const line = str(d, "text");
    return line === null ? null : { type: "progress", text: line };
  },
  narration: (d) => {
    const said = str(d, "text");
    return said === null ? null : { type: "narration", text: said, retracted: bool(d, "retracted") };
  },
  "tool-start": (d) => {
    const toolCallId = text(d, "toolCallId");
    if (!toolCallId) return null;
    return { type: "tool-start", toolCallId, toolName: text(d, "toolName") ?? "tool", input: obj(d, "input") };
  },
  "tool-end": (d) => {
    const toolCallId = text(d, "toolCallId");
    if (!toolCallId) return null;
    return {
      type: "tool-end",
      toolCallId,
      toolName: text(d, "toolName") ?? "tool",
      success: bool(d, "success"),
      error: text(d, "error"),
      durationMs: num(d, "durationMs"),
      summary: text(d, "summary"),
      skipped: bool(d, "skipped"),
      waiting: bool(d, "waiting"),
    };
  },
  "tool-data": (d) => ({ type: "tool-data", data: d }),
  receipts: (d) => ({
    type: "receipts",
    receipts: list(d, "receipts")
      .map(parseReceipt)
      .filter((r): r is Receipt => r !== null),
    model: text(d, "model"),
    above: strings(d, "above"),
  }),
  "mission-suggestion": (d) => {
    const goal = text(d, "goal");
    return goal ? { type: "mission-suggestion", goal, complexity: str(d, "complexity"), agentId: num(d, "agent_id") } : null;
  },
  "workflow-update": (d) => {
    const workflowId = str(d, "workflowId") ?? (num(d, "workflowId")?.toString() ?? null);
    const status = text(d, "status");
    if (!workflowId || !status) return null;
    return { type: "workflow-update", workflowId, status, currentStep: str(d, "currentStep"), progress: num(d, "progress") };
  },
  "memory-injected": (d) => ({
    type: "memory-injected",
    memories: list(d, "memories"),
    totalMatched: num(d, "totalMatched") ?? 0,
  }),
  "memory-stored": (d) => ({ type: "memory-stored", memory: obj(d, "memory"), reason: str(d, "reason") }),
  limit_reached: (d) => {
    const message = text(d, "message");
    return message ? { type: "limit_reached", limit: str(d, "limit") ?? "", value: num(d, "value") ?? 0, message } : null;
  },
  "tool-permission-denied": (d) => ({
    type: "tool-permission-denied",
    toolName: text(d, "toolName") ?? "tool",
    agentId: num(d, "agentId"),
    reason: str(d, "reason"),
  }),
  attachment_unavailable: (d) => ({ type: "attachment_unavailable", attachments: list(d, "attachments") }),
  withdraw_offer: (d) => {
    if (!Array.isArray(d["requests"])) return null;
    return { type: "withdraw_offer", message: str(d, "message") ?? "", requests: list(d, "requests") };
  },
  "budget-warning": (d) => ({
    type: "budget-warning",
    tokensUsed: num(d, "tokensUsed") ?? 0,
    tokenBudget: num(d, "tokenBudget") ?? 0,
    percentUsed: num(d, "percentUsed") ?? 0,
  }),
  usage,
};

/** Decoders for the three types that put their fields at the top level. */
const TOP_LEVEL: Readonly<Record<string, Decoder>> = {
  "chat-id": (f) => {
    const chatId = text(f, "chatId");
    return chatId ? { type: "chat-id", chatId } : null;
  },
  "agent-info": (f) => {
    const agent = agentInfo(f["agent"]);
    return agent ? { type: "agent-info", agent } : null;
  },
  finish: (f) => ({ type: "finish", finishReason: str(f, "finishReason") }),
};

/**
 * The backend sends agent-info as {"type": {"type": "agent-info", "agent": …}}
 * (service.py passes the whole dict to format_aisdk_data as the event type).
 * Unwrap that so both the nested and the documented flat shape parse.
 */
function unwrapNestedType(frame: JsonObject): JsonObject {
  const inner = asObject(frame["type"]);
  return inner && typeof inner["type"] === "string" ? inner : frame;
}

/** hasOwn, so a type like "constructor" never reaches a prototype method. */
function decode(frame: JsonObject, eventType: string): StreamEvent | null {
  if (Object.hasOwn(TOP_LEVEL, eventType)) return TOP_LEVEL[eventType](frame);
  if (!Object.hasOwn(UNDER_DATA, eventType)) return { type: "unknown", eventType };
  const data = asObject(frame["data"]);
  return data ? UNDER_DATA[eventType](data) : null;
}

/** A d: line's JSON as an event; null when malformed. */
export function parseDataFrame(value: unknown): StreamEvent | null {
  const raw = asObject(value);
  if (!raw) return null;
  const frame = unwrapNestedType(raw);
  const eventType = str(frame, "type");
  return eventType ? decode(frame, eventType) : null;
}

/** A legacy data: line's JSON as an event; null when malformed. */
export function parseLegacyFrame(value: unknown): StreamEvent | null {
  const frame = asObject(value);
  const eventType = frame ? str(frame, "type") : null;
  if (!frame || !eventType) return null;
  switch (eventType) {
    case "text-delta": {
      const delta = text(frame, "delta");
      return delta ? { type: "text", text: delta } : null;
    }
    case "tool-data":
    case "mission-suggestion":
      return decode(frame, eventType);
    case "data-usage": {
      const data = asObject(frame["data"]);
      return data ? usage(data) : null;
    }
    case "error":
      return errorFromPayload(frame);
    case "done":
      return { type: "finish", finishReason: null };
    default:
      return { type: "unknown", eventType };
  }
}
