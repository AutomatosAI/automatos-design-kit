// The sidebar's Recent list: the latest conversations from GET /api/chat/history,
// reloaded whenever the chat announces a change (lib/client/chat-events.ts).

import { useEffect, useState } from "react";

import type { RecentChat } from "@/components/shell/Sidebar";
import { api, type ApiClient } from "@/lib/client/api";
import { onChatsChanged } from "@/lib/client/chat-events";
import type { ChatSummary } from "@/lib/client/types";
import { conversationTitle } from "@/lib/conversations/list";

export const RECENT_LIMIT = 4;

function toRecent(chat: ChatSummary): RecentChat {
  return { id: chat.id, title: conversationTitle(chat) };
}

/**
 * Empty until the first answer, and kept as it was when a reload fails (the console has
 * why). Waits while ready is false (Automatos is still being asked, or is asleep).
 */
export function useRecentChats(client: ApiClient = api, ready = true): readonly RecentChat[] {
  const [recent, setRecent] = useState<readonly RecentChat[]>([]);

  useEffect(() => {
    if (!ready) return;
    let live = true;
    const load = async (): Promise<void> => {
      try {
        const chats = await client.listChats(RECENT_LIMIT);
        if (live) setRecent(chats.slice(0, RECENT_LIMIT).map(toRecent));
      } catch (error) {
        console.error("[sidebar] couldn't load the recent conversations:", error);
      }
    };
    void load();
    const unsubscribe = onChatsChanged(() => void load());
    return () => {
      live = false;
      unsubscribe();
    };
  }, [client, ready]);

  return recent;
}
