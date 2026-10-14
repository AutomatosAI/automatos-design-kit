// The Conversations page's list: GET /api/chat/history, newest activity first.

import { useCallback } from "react";

import type { ApiClient } from "@/lib/client/api";
import type { ChatSummary } from "@/lib/client/types";

import { type Loaded, useLoad } from "./useLoad";

/** The history's page size; the search filters what was loaded. */
export const CONVERSATION_LIMIT = 50;
export const LIST_FAILED = "Play couldn't load your conversations.";

export function useConversations(client: ApiClient): Loaded<readonly ChatSummary[]> {
  const load = useCallback(() => client.listChats(CONVERSATION_LIMIT), [client]);
  return useLoad(load, LIST_FAILED, "conversations");
}
