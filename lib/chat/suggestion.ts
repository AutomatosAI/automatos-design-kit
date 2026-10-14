// A Mission Auto suggests in chat (a mission-suggestion frame), as the request that
// starts it. Spec: skills/build-automatos-interface/references/missions.md, "From a chat
// suggestion to a Mission", and Studio's mission-suggestion-card.tsx. Pure: no fetch.

import type { NewMission } from "@/lib/missions/types";

import type { ChatMessage } from "./types";

/** Studio sends recentMessages.slice(-5); the core mirrors it (_CONTEXT_MESSAGE_LIMIT in handlers_missions.py). */
export const CONTEXT_MESSAGES_KEPT = 5;

export type ContextMessage = { readonly role: "user" | "assistant"; readonly content: string };

/** Studio's words for two of the core's Complexity values (consumers/chatbot/auto.py); others show as sent. */
const COMPLEXITY_WORDS: Readonly<Record<string, string>> = {
  organ: "Multi-step",
  organism: "Complex, several agents",
};

/** The complexity in words; an unknown value as the backend sent it, none as null. */
export function complexityWords(complexity: string | null): string | null {
  if (!complexity) return null;
  return Object.hasOwn(COMPLEXITY_WORDS, complexity) ? COMPLEXITY_WORDS[complexity] : complexity;
}

function contentOf(message: ChatMessage): string {
  return message.text.trim();
}

/**
 * The conversation up to and including the suggesting reply, newest five as {role, content}.
 * Messages with no text (a reply that only failed) are left out, as the core does for its own path.
 */
export function contextMessages(messages: readonly ChatMessage[], replyId: string): readonly ContextMessage[] {
  const end = messages.findIndex((message) => message.id === replyId);
  const upTo = end < 0 ? messages : messages.slice(0, end + 1);
  return upTo
    .filter((message) => contentOf(message) !== "")
    .slice(-CONTEXT_MESSAGES_KEPT)
    .map((message) => ({ role: message.role, content: contentOf(message) }));
}

/**
 * POST /api/missions for the suggestion on this reply: {goal, config: {source: "chat",
 * chat_id, context_messages}}. chat_id is left out before the chat-id frame arrived.
 * Null when the reply carries no suggestion.
 */
export function suggestedMission(
  messages: readonly ChatMessage[],
  replyId: string,
  chatId: string,
): NewMission | null {
  const reply = messages.find((message) => message.id === replyId);
  if (!reply || reply.role !== "assistant" || !reply.missionSuggestion) return null;
  return {
    goal: reply.missionSuggestion.goal,
    config: {
      source: "chat",
      ...(chatId ? { chat_id: chatId } : {}),
      context_messages: contextMessages(messages, replyId),
    },
  };
}
