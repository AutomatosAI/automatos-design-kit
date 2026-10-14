// A saved conversation (GET /api/chat/{id}/messages) as the chat's message model.
// An assistant message is saved as parts (reply_parts in automatos-ai/orchestrator/
// consumers/chatbot/narration.py): receipts, reasoning, narration, then the answer as
// the only text part. A failed turn is saved as an assistant note with
// source.origin "turn_error" (service.py _persist_turn_error). Untrusted: a part
// of the wrong shape is skipped.

import type { MessagePart, StoredMessage } from "@/lib/client/types";
import { parseReceipt } from "@/lib/stream/data-events";
import { list, str, text } from "@/lib/stream/fields";
import type { Receipt } from "@/lib/stream/types";

import { deliverablesFromReceipts } from "./deliverables";
import { autoMessage, userMessage } from "./turn";
import type { AutoMessage, ChatMessage, UserMessage } from "./types";

const TURN_ERROR_ORIGIN = "turn_error";
/** The core puts this in front of a saved turn error; the chat's error line has its own mark. */
const WARNING_PREFIX = /^\s*⚠️?\s*/u;
export const SAVED_ERROR = "This answer failed.";

function partsOfType(parts: readonly MessagePart[], type: string): readonly MessagePart[] {
  return parts.filter((part) => part.type === type);
}

function joined(parts: readonly MessagePart[], type: string, key: string, separator: string): string {
  return partsOfType(parts, type)
    .map((part) => str(part, key) ?? "")
    .filter((value) => value.length > 0)
    .join(separator);
}

function receiptsOf(parts: readonly MessagePart[]): readonly Receipt[] {
  return partsOfType(parts, "receipts")
    .flatMap((part) => list(part, "receipts"))
    .map(parseReceipt)
    .filter((receipt): receipt is Receipt => receipt !== null);
}

function isTurnError(message: StoredMessage): boolean {
  return message.source !== null && text(message.source, "origin") === TURN_ERROR_ORIGIN;
}

function storedUser(message: StoredMessage): UserMessage | null {
  const said = joined(message.parts, "text", "text", "\n\n").trim();
  return said ? userMessage(message.id, said) : null;
}

function storedTurnError(message: StoredMessage): AutoMessage {
  const said = joined(message.parts, "text", "text", " ").replace(WARNING_PREFIX, "").trim();
  return { ...autoMessage(message.id), errors: [said || SAVED_ERROR], status: "failed" };
}

function storedReply(message: StoredMessage): AutoMessage {
  if (isTurnError(message)) return storedTurnError(message);
  const narration = joined(message.parts, "narration", "narration", "\n").trim();
  const receipts = receiptsOf(message.parts);
  return {
    ...autoMessage(message.id),
    text: joined(message.parts, "text", "text", "\n\n"),
    reasoning: joined(message.parts, "reasoning", "reasoning", "\n\n"),
    activity: narration ? [{ kind: "narration", text: narration }] : [],
    receipts,
    deliverables: deliverablesFromReceipts(receipts),
    status: "done",
  };
}

/** One saved message, or null for a role the chat doesn't show (or a user message with no text). */
export function fromStoredMessage(message: StoredMessage): ChatMessage | null {
  if (message.role === "user") return storedUser(message);
  if (message.role === "assistant") return storedReply(message);
  return null;
}

export function fromStoredMessages(messages: readonly StoredMessage[]): readonly ChatMessage[] {
  return messages.map(fromStoredMessage).filter((message): message is ChatMessage => message !== null);
}
