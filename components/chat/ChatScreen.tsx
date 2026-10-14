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
  /** Words waiting in a new chat's message box ("Ask Auto about this"). */
  readonly draft?: string;
  /** How long without input before Auto naps (tests shorten it). */
  readonly idleMs?: number;
  /** A new chat with this agent instead of Auto ("Chat with <name>"); ignored for a saved conversation. */
  readonly agentId?: number;
}

export function ChatScreen({ client, chatId, draft, idleMs, agentId }: ChatScreenProps) {
  if (!chatId) return <ChatView client={client} initialDraft={draft} idleMs={idleMs} agentId={agentId} />;
  return <StoredChat client={client} chatId={chatId} idleMs={idleMs} />;
}
