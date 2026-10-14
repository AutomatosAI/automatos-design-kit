// One agent's page data (P-008): the agent with its team, skills and tools, plus the
// workspace (to know whether it is Auto), loaded once; its performance, loaded once on
// its own so a failure there leaves the rest of the page; and the fleet, polled every
// 10 s while the tab is visible, for its live state and session line.

import { useCallback } from "react";

import { type Loaded, useLoad } from "@/hooks/useLoad";
import { type PollState, usePoll } from "@/hooks/usePoll";
import type { AgentDetail } from "@/lib/agents/detail";
import type { Fleet } from "@/lib/agents/fleet";
import type { AgentPerformance } from "@/lib/agents/performance";
import type { ApiClient } from "@/lib/client/api";
import { POLL_INTERVALS } from "@/lib/poll/intervals";

export const AGENT_FAILED = "Play couldn't load this agent.";
export const PERFORMANCE_FAILED = "Play couldn't load how this agent has done.";

export type AgentPageData = { readonly workspaceId: string; readonly agent: AgentDetail };

export interface AgentDetailState {
  readonly page: Loaded<AgentPageData>;
  readonly performance: Loaded<AgentPerformance>;
  readonly fleet: PollState<Fleet>;
}

export function useAgentDetail(
  client: ApiClient,
  id: number,
  fleetIntervalMs: number = POLL_INTERVALS.FLEET,
): AgentDetailState {
  const loadPage = useCallback(async (): Promise<AgentPageData> => {
    const [workspace, agent] = await Promise.all([client.getWorkspace(), client.getAgentDetail(id)]);
    return { workspaceId: workspace.id, agent };
  }, [client, id]);
  const page = useLoad(loadPage, AGENT_FAILED, "agent");

  const loadPerformance = useCallback(() => client.getAgentPerformance(id), [client, id]);
  const performance = useLoad(loadPerformance, PERFORMANCE_FAILED, "agent performance");

  const loadFleet = useCallback(() => client.getFleet(), [client]);
  const { state: fleet } = usePoll(loadFleet, fleetIntervalMs, { label: "fleet" });

  return { page, performance, fleet };
}
