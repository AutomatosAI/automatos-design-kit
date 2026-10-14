// The Agents page's data: the workspace and its agents (once), the fleet (polled every
// 10 s while the tab is visible, one workspace-wide call), and the on/off switch. A
// switched agent's answer replaces its row in the list it was switched from, so the card
// shows the backend's word for it; a fresh list (Try again) starts clean.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { type Loaded, useLoad } from "@/hooks/useLoad";
import { type PollState, usePoll } from "@/hooks/usePoll";
import type { Fleet } from "@/lib/agents/fleet";
import type { AgentSummary, AgentSwitchState } from "@/lib/agents/types";
import { ApiError, type ApiClient } from "@/lib/client/api";
import { POLL_INTERVALS } from "@/lib/poll/intervals";

export const CREW_FAILED = "Play couldn't load your agents.";
export const SWITCH_FAILED = "Play couldn't switch that agent.";

export type CrewData = { readonly workspaceId: string; readonly agents: readonly AgentSummary[] };

export interface Crew {
  readonly crew: Loaded<CrewData>;
  readonly fleet: PollState<Fleet>;
  /** Resolves once the backend has it; rejects with a friendly Error (the console has the detail). */
  readonly switchAgent: (agent: AgentSummary, status: AgentSwitchState) => Promise<void>;
}

/** Switched rows, and the list they were switched from. */
type Changes = { readonly base: CrewData | null; readonly rows: ReadonlyMap<number, AgentSummary> };

const NO_CHANGES: Changes = { base: null, rows: new Map() };

function withChanges(loaded: Loaded<CrewData>, changes: Changes): Loaded<CrewData> {
  if (loaded.status !== "ready" || changes.base !== loaded.value || changes.rows.size === 0) return loaded;
  const agents = loaded.value.agents.map((agent) => changes.rows.get(agent.id) ?? agent);
  return { status: "ready", value: { ...loaded.value, agents } };
}

/** The switched row on top of the earlier ones from the same list. */
function addChange(previous: Changes, base: CrewData | null, row: AgentSummary): Changes {
  const kept = previous.base === base ? [...previous.rows] : [];
  return { base, rows: new Map<number, AgentSummary>([...kept, [row.id, row]]) };
}

export function useCrew(client: ApiClient, fleetIntervalMs: number = POLL_INTERVALS.FLEET): Crew {
  const loadCrew = useCallback(async (): Promise<CrewData> => {
    const [workspace, agents] = await Promise.all([client.getWorkspace(), client.listAgents()]);
    return { workspaceId: workspace.id, agents };
  }, [client]);
  const loaded = useLoad(loadCrew, CREW_FAILED, "agents");
  const base = loaded.status === "ready" ? loaded.value : null;
  const latestBase = useRef(base);
  useEffect(() => {
    latestBase.current = base;
  });
  const loadFleet = useCallback(() => client.getFleet(), [client]);
  const { state: fleet } = usePoll(loadFleet, fleetIntervalMs, { label: "fleet" });
  const [changes, setChanges] = useState<Changes>(NO_CHANGES);

  const switchAgent = useCallback(
    async (agent: AgentSummary, status: AgentSwitchState): Promise<void> => {
      try {
        const updated = await client.setAgentStatus(agent.id, status);
        setChanges((previous) => addChange(previous, latestBase.current, updated));
      } catch (error) {
        console.error(`[agents] switching ${agent.id} to ${status} failed`, error);
        throw new Error(error instanceof ApiError ? `${SWITCH_FAILED} ${error.message}` : SWITCH_FAILED);
      }
    },
    [client],
  );

  const crew = useMemo(() => withChanges(loaded, changes), [loaded, changes]);
  return { crew, fleet, switchAgent };
}
