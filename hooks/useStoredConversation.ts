// Loads a saved conversation (GET /api/chat/{id}/messages) as the chat's message
// model, so the chat can continue it.

import { useCallback } from "react";

import { fromStoredMessages } from "@/lib/chat/stored";
import type { ChatMessage } from "@/lib/chat/types";
import type { ApiClient } from "@/lib/client/api";

import { type Loaded, useLoad } from "./useLoad";

export const LOAD_FAILED = "Play couldn't open this conversation.";

export type StoredConversation = Loaded<readonly ChatMessage[]>;

export function useStoredConversation(client: ApiClient, chatId: string): StoredConversation {
  const load = useCallback(async () => fromStoredMessages(await client.chatMessages(chatId)), [client, chatId]);
  return useLoad(load, LOAD_FAILED, "chat");
}
