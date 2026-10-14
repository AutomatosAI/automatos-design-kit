import { isAgentId } from "@/lib/agents/types";

// The chat page's address: /?chat=<id> opens that saved conversation (from
// Conversations and the sidebar's Recent list); anything else is a new chat.
// /?draft=<text> starts a new chat with those words in the message box (a Deliverable's
// "Ask Auto about this"). /?agent=<id> starts a new chat with that agent instead of Auto
// (an agent page's "Chat with <name>").

/** The same shape the proxy routes accept for an id (lib/server/forward.ts pathId). */
const CHAT_ID = /^[A-Za-z0-9_-]{1,128}$/;
const CHAT_PARAM = "chat";
const DRAFT_PARAM = "draft";
const AGENT_PARAM = "agent";
/** Longer drafts are cut: the address is not the place for a whole message. */
export const MAX_DRAFT_CHARS = 500;

export type SearchParams = Readonly<Record<string, string | string[] | undefined>>;

export function chatHref(chatId: string): string {
  return `/?${CHAT_PARAM}=${encodeURIComponent(chatId)}`;
}

/** The conversation to open, or undefined for a new chat (also for a malformed id). */
export function chatParam(params: SearchParams): string | undefined {
  const value = params[CHAT_PARAM];
  return typeof value === "string" && CHAT_ID.test(value) ? value : undefined;
}

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/**
 * The first MAX_DRAFT_CHARS characters, never half an emoji: encodeURIComponent throws
 * on a lone surrogate (and a Deliverable's title is backend text, so it may hold one).
 */
function cutDraft(text: string): string {
  return Array.from(text.replace(LONE_SURROGATE, "\uFFFD")).slice(0, MAX_DRAFT_CHARS).join("");
}

/** A new chat with these words waiting in the message box. */
export function draftHref(text: string): string {
  return `/?${DRAFT_PARAM}=${encodeURIComponent(cutDraft(text))}`;
}

/** The words to start a new chat with, or undefined (also when a conversation is being opened). */
export function draftParam(params: SearchParams): string | undefined {
  const value = params[DRAFT_PARAM];
  if (typeof value !== "string" || !value.trim() || chatParam(params)) return undefined;
  return cutDraft(value);
}

/** A new chat with this agent: every message carries its id (chat-stream.md, agentId). */
export function agentChatHref(agentId: number): string {
  return `/?${AGENT_PARAM}=${encodeURIComponent(String(agentId))}`;
}

/** The agent a new chat talks to, or undefined for Auto (also when a conversation is being opened). */
export function agentParam(params: SearchParams): number | undefined {
  const value = params[AGENT_PARAM];
  if (typeof value !== "string" || !isAgentId(value) || chatParam(params)) return undefined;
  return Number(value);
}
