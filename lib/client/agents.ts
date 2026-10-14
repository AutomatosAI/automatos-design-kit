import { parseAgentDetail, type AgentDetail } from "@/lib/agents/detail";
import { parseFleet, type Fleet } from "@/lib/agents/fleet";
import { parsePerformance, type AgentPerformance } from "@/lib/agents/performance";
import {
  parseAgentList,
  parseAgentSummary,
  type AgentQuery,
  type AgentSummary,
  type AgentSwitchState,
} from "@/lib/agents/types";
import { ApiError, type Transport } from "@/lib/client/transport";

// The agent calls (agents-playbooks.md), through Play's /api/agents and /api/fleet routes.

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

export function agentPath(id: number, suffix = ""): string {
  return `/api/agents/${encodeURIComponent(String(id))}${suffix}`;
}

function readAgent(body: unknown): AgentSummary {
  const parsed = parseAgentSummary(body);
  if (!parsed) throw new ApiError(200, "Automatos sent an agent Play can't read");
  return parsed;
}

export function agentEndpoints({ callJson }: Transport) {
  return {
    /** The workspace's agents, Auto included by default. */
    async listAgents(query: AgentQuery = {}): Promise<readonly AgentSummary[]> {
      return parseAgentList(await callJson(`/api/agents?${agentsSearch(query)}`));
    },

    async getAgent(id: number): Promise<AgentSummary> {
      return readAgent(await callJson(agentPath(id)));
    },

    /** One agent with its team, skills and tools (workspace agents only: others 404). */
    async getAgentDetail(id: number): Promise<AgentDetail> {
      const parsed = parseAgentDetail(await callJson(agentPath(id)));
      if (!parsed) throw new ApiError(200, "Automatos sent an agent Play can't read");
      return parsed;
    },

    /** Success rate, tasks, tokens and cost (lib/agents/performance.ts says which are real). */
    async getAgentPerformance(id: number): Promise<AgentPerformance> {
      return parsePerformance(await callJson(agentPath(id, "/performance")));
    },

    /** Live status for every agent, one call. The core leaves Auto out. */
    async getFleet(): Promise<Fleet> {
      return parseFleet(await callJson("/api/fleet"));
    },

    /** Switch an agent on ("active") or off ("inactive"); sends {status} and nothing else. */
    async setAgentStatus(id: number, status: AgentSwitchState): Promise<AgentSummary> {
      return readAgent(await callJson(agentPath(id), { method: "PUT", body: JSON.stringify({ status }) }));
    },
  };
}
