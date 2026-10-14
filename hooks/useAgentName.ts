// The name of the agent a chat talks to (P-008's "Chat with <name>"), for the chat's
// "Talking to" line. null while it loads, and when it can't: the console has the detail
// and the chat says the agent's number instead.

import { useEffect, useState } from "react";

import type { ApiClient } from "@/lib/client/api";

type Named = { readonly id: number; readonly name: string };

export function useAgentName(client: ApiClient, agentId: number | undefined): string | null {
  const [named, setNamed] = useState<Named | null>(null);

  useEffect(() => {
    if (agentId === undefined) return;
    let live = true;
    client.getAgent(agentId).then(
      (agent) => {
        const name = agent.name.trim();
        if (live && name) setNamed({ id: agentId, name });
      },
      (error: unknown) => console.error(`[chat] Play couldn't load the name of agent ${agentId}`, error),
    );
    return () => {
      live = false;
    };
  }, [client, agentId]);

  return named && named.id === agentId ? named.name : null;
}
