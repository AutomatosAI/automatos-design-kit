// One Mission's run page (PRD-003 P-005): the Mission polled with usePoll(MISSION_DETAIL)
// while the tab is visible, stopping once it has ended; the agents' names for its tasks;
// and the actions, each followed by a refresh. A refused move shows the client's sentence
// ("This Mission is already running, so it can't be approved.") and the Mission refreshes.

import { useCallback, useMemo, useState } from "react";

import { useLoad } from "@/hooks/useLoad";
import { type Poll, usePoll } from "@/hooks/usePoll";
import { agentNameMap } from "@/lib/agents/names";
import type { AgentSummary } from "@/lib/agents/types";
import { ApiError, type ApiClient } from "@/lib/client/api";
import { planEdits, type PlanChanges } from "@/lib/missions/plan";
import type { HeaderAction } from "@/lib/missions/run";
import { isEnded } from "@/lib/missions/states";
import type { MissionDetail } from "@/lib/missions/types";
import { POLL_INTERVALS } from "@/lib/poll/intervals";

export const MISSION_FAILED = "Play couldn't load this Mission.";
export const AGENTS_FAILED = "Play couldn't load the agents' names.";
const ACTION_FAILED = "That didn't work.";

/** What the user asked for: a header action (with the reject reason), or saving plan edits. */
export type RunRequest =
  | { readonly action: Exclude<HeaderAction, "reject" | "approve"> }
  | { readonly action: "approve"; readonly changes: PlanChanges }
  | { readonly action: "reject"; readonly reason: string }
  | { readonly action: "save-plan"; readonly changes: PlanChanges };

export type RunBusy = RunRequest["action"] | null;

export interface MissionRun {
  readonly poll: Poll<MissionDetail>;
  readonly agents: readonly AgentSummary[];
  readonly names: ReadonlyMap<number, string>;
  readonly busy: RunBusy;
  /** The last action's failure, in words. */
  readonly error: string | null;
  /** Resolves true when the action went through. */
  readonly run: (request: RunRequest) => Promise<boolean>;
}

const NO_AGENTS: readonly AgentSummary[] = [];

function friendly(error: unknown): string {
  return error instanceof ApiError ? error.message : ACTION_FAILED;
}

async function send(client: ApiClient, id: string, request: RunRequest): Promise<void> {
  switch (request.action) {
    case "save-plan":
      return client.editMissionPlan(id, planEdits(request.changes));
    case "approve": {
      const edits = planEdits(request.changes);
      if (edits.length > 0) await client.editMissionPlan(id, edits);
      return client.approveMission(id);
    }
    case "reject":
      return client.rejectMission(id, request.reason.trim());
    case "pause":
      return client.pauseMission(id);
    case "resume":
      return client.resumeMission(id);
    case "cancel":
      return client.cancelMission(id);
    case "replan":
      return client.replanMission(id);
    case "delete":
      return client.deleteMission(id);
  }
}

export function useMissionRun(client: ApiClient, id: string, intervalMs: number = POLL_INTERVALS.MISSION_DETAIL): MissionRun {
  const load = useCallback(() => client.getMission(id), [client, id]);
  const poll = usePoll(load, intervalMs, { stopWhen: (mission) => isEnded(mission.state), label: "mission" });
  const loadAgents = useCallback(() => client.listAgents(), [client]);
  const agentsLoad = useLoad(loadAgents, AGENTS_FAILED, "mission agents");
  const agents = agentsLoad.status === "ready" ? agentsLoad.value : NO_AGENTS;
  const names = useMemo(() => agentNameMap(agents), [agents]);
  const [busy, setBusy] = useState<RunBusy>(null);
  const [error, setError] = useState<string | null>(null);
  const { refresh } = poll;

  const run = useCallback(
    async (request: RunRequest): Promise<boolean> => {
      setBusy(request.action);
      setError(null);
      try {
        await send(client, id, request);
        if (request.action !== "delete") await refresh();
        return true;
      } catch (failure) {
        console.error(`[mission] ${request.action} failed`, failure);
        setError(friendly(failure));
        await refresh();
        return false;
      } finally {
        setBusy(null);
      }
    },
    [client, id, refresh],
  );

  return { poll, agents, names, busy, error, run };
}
