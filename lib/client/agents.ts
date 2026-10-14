import type { Transport } from "@/lib/client/transport";
import { parseAgentList, type AgentQuery, type AgentSummary } from "@/lib/agents/types";

// The agent calls (agents-playbooks.md), through Play's /api/agents routes.

const DEFAULT_AGENT_LIMIT = 100;

function agentsSearch(query: AgentQuery): string {
  const params = new URLSearchParams({
    include_workspace_system: String(query.includeWorkspaceSystem ?? true),
    limit: String(query.limit ?? DEFAULT_AGENT_LIMIT),
  });
  if (query.skip !== undefined) params.set("skip", String(query.skip));
  if (query.status) params.set("status", query.status);
  if (query.search) params.set("search", query.search);
  return params.toString();
}

export function agentEndpoints({ callJson }: Transport) {
  return {
    /** The workspace's agents, Auto included by default. */
    async listAgents(query: AgentQuery = {}): Promise<readonly AgentSummary[]> {
      return parseAgentList(await callJson(`/api/agents?${agentsSearch(query)}`));
    },
  };
}
