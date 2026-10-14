import { ApiError, failure, type Transport } from "@/lib/client/transport";
import {
  parseMission,
  parseMissionCost,
  parseMissionDetail,
  parseMissionEventPage,
  parseMissionList,
  parseMissionStats,
} from "@/lib/missions/parse";
import { missionRefusal, type MissionAction } from "@/lib/missions/states";
import type {
  Mission,
  MissionCost,
  MissionDetail,
  MissionEventPage,
  MissionEventQuery,
  MissionList,
  MissionQuery,
  MissionStats,
  MissionStatsPeriod,
  NewMission,
  PlanEdit,
  ResumeOptions,
} from "@/lib/missions/types";

// The Missions calls (missions.md), through Play's /api/missions routes. Actions resolve
// with nothing: the page refreshes the Mission afterwards. A refused move throws an
// ApiError whose message names the state ("This Mission is already running, so it
// can't be approved.").

const ACTION_ROUTES: Readonly<Record<MissionAction, { readonly suffix: string; readonly method: string }>> = {
  "edit-plan": { suffix: "/plan", method: "PATCH" },
  approve: { suffix: "/approve", method: "POST" },
  reject: { suffix: "/reject", method: "POST" },
  pause: { suffix: "/pause", method: "POST" },
  resume: { suffix: "/resume", method: "POST" },
  cancel: { suffix: "/cancel", method: "POST" },
  replan: { suffix: "/replan", method: "POST" },
  delete: { suffix: "", method: "DELETE" },
};

export function missionPath(id: string, suffix = ""): string {
  return `/api/missions/${encodeURIComponent(id)}${suffix}`;
}

function search(entries: readonly (readonly [string, string | number | undefined])[]): string {
  const kept = entries.filter((entry): entry is readonly [string, string | number] => entry[1] !== undefined);
  const params = new URLSearchParams(kept.map(([key, value]) => [key, String(value)]));
  const query = params.toString();
  return query ? `?${query}` : "";
}

function snakePlanEdit(edit: PlanEdit): Record<string, string | number | undefined> {
  return {
    task_id: edit.taskId,
    temp_id: edit.tempId,
    sequence_number: edit.sequenceNumber,
    agent_id: edit.agentId,
    agent_role: edit.agentRole,
    title: edit.title,
    description: edit.description,
  };
}

/** A failed action as an ApiError, with a refused move put in words. */
async function actionFailure(response: Response, path: string, action: MissionAction): Promise<ApiError> {
  const error = await failure(response, path);
  const refusal = missionRefusal(action, error.status, error.message);
  return refusal ? new ApiError(error.status, refusal) : error;
}

function missionReads({ callJson }: Transport) {
  return {
    async listMissions(query: MissionQuery = {}): Promise<MissionList> {
      const params = search([
        ["state", query.state],
        ["limit", query.limit],
        ["offset", query.offset],
      ]);
      return parseMissionList(await callJson(`/api/missions${params}`));
    },

    async missionStats(period: MissionStatsPeriod = "30d"): Promise<MissionStats> {
      return parseMissionStats(await callJson(`/api/missions/stats${search([["period", period]])}`));
    },

    /** The Mission with its tasks, recent events and task progress. */
    async getMission(id: string): Promise<MissionDetail> {
      const parsed = parseMissionDetail(await callJson(missionPath(id)));
      if (!parsed) throw new ApiError(200, "Automatos sent a Mission Play can't read");
      return parsed;
    },

    async missionEvents(id: string, query: MissionEventQuery = {}): Promise<MissionEventPage> {
      const params = search([
        ["event_type", query.eventType],
        ["limit", query.limit],
        ["offset", query.offset],
      ]);
      return parseMissionEventPage(await callJson(missionPath(id, `/events${params}`)));
    },

    async missionCost(id: string): Promise<MissionCost> {
      return parseMissionCost(await callJson(missionPath(id, "/cost")));
    },
  };
}

function missionWrites({ call, callJson }: Transport) {
  async function act(id: string, action: MissionAction, body?: unknown): Promise<void> {
    const { suffix, method } = ACTION_ROUTES[action];
    const path = missionPath(id, suffix);
    const init = body === undefined ? { method } : { method, body: JSON.stringify(body) };
    const response = await call(path, init);
    if (!response.ok) throw await actionFailure(response, path, action);
  }

  return {
    /** Starts a Mission. state begins at pending, then planning. */
    async createMission(mission: NewMission): Promise<Mission> {
      const body = {
        goal: mission.goal,
        config: mission.config,
        template_id: mission.templateId,
        plan_only: mission.planOnly,
      };
      const parsed = parseMission(await callJson("/api/missions", { method: "POST", body: JSON.stringify(body) }));
      if (!parsed) throw new ApiError(200, "Automatos started a Mission Play can't read");
      return parsed;
    },

    editMissionPlan: (id: string, edits: readonly PlanEdit[]) =>
      act(id, "edit-plan", { task_edits: edits.map(snakePlanEdit) }),
    /** Never sends `modifications` (the core refuses it): plan edits go through editMissionPlan first. */
    approveMission: (id: string, note?: string) => act(id, "approve", note ? { note } : {}),
    rejectMission: (id: string, reason: string) => act(id, "reject", { reason }),
    pauseMission: (id: string) => act(id, "pause"),
    /** From paused; from failed it retries the Mission. */
    resumeMission: (id: string, options: ResumeOptions = {}) =>
      act(id, "resume", { additional_tokens: options.additionalTokens, additional_cost: options.additionalCost }),
    cancelMission: (id: string) => act(id, "cancel"),
    replanMission: (id: string, notes?: string) => act(id, "replan", notes ? { notes } : {}),
    /** Only once the Mission has ended; the backend answers 204. */
    deleteMission: (id: string) => act(id, "delete"),
  };
}

export function missionEndpoints(transport: Transport) {
  return { ...missionReads(transport), ...missionWrites(transport) };
}
