"use client";

// The chat page's root: a new chat, or a saved conversation loaded and continued.

import type { ApiClient } from "@/lib/client/api";

import { ChatView } from "./ChatView";
import { StoredChat } from "./StoredChat";

export interface ChatScreenProps {
  /** Tests pass their own (createApiClient with a mock fetch). */
  readonly client?: ApiClient;
  /** A saved conversation to open and continue; none starts a new one. Remount (key) to switch. */
  readonly chatId?: string;
}

export function ChatScreen({ client, chatId }: ChatScreenProps) {
  if (!chatId) return <ChatView client={client} />;
  return <StoredChat client={client} chatId={chatId} />;
}
