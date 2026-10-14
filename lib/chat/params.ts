// The chat page's address: /?chat=<id> opens that saved conversation (from
// Conversations and the sidebar's Recent list); anything else is a new chat.

/** The same shape the proxy routes accept for an id (lib/server/forward.ts pathId). */
const CHAT_ID = /^[A-Za-z0-9_-]{1,128}$/;
const CHAT_PARAM = "chat";

export type SearchParams = Readonly<Record<string, string | string[] | undefined>>;

export function chatHref(chatId: string): string {
  return `/?${CHAT_PARAM}=${encodeURIComponent(chatId)}`;
}

/** The conversation to open, or undefined for a new chat (also for a malformed id). */
export function chatParam(params: SearchParams): string | undefined {
  const value = params[CHAT_PARAM];
  return typeof value === "string" && CHAT_ID.test(value) ? value : undefined;
}
