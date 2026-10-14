import { count, idOf, isRecord, listOf, text } from "@/lib/client/types";
import type {
  Mission,
  MissionCost,
  MissionDetail,
  MissionEvent,
  MissionEventPage,
  MissionList,
  MissionStats,
  MissionTask,
  PermissionDenial,
  TaskProgress,
  TopAgent,
} from "@/lib/missions/types";

// Backend Mission JSON -> the shapes in lib/missions/types.ts. Untrusted: a row with no
// id is dropped, a missing or mistyped field becomes null, 0 or empty.

type Json = Readonly<Record<string, unknown>>;

function record(value: unknown): Json | null {
  return isRecord(value) ? value : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function strings(value: unknown): readonly string[] {
  return listOf(value, text);
}

export function parseMission(value: unknown): Mission | null {
  if (!isRecord(value)) return null;
  const id = idOf(value.id);
  if (!id) return null;
  return {
    id,
    goal: text(value.goal) ?? "",
    state: text(value.state) ?? "",
    config: record(value.config),
    plan: record(value.plan),
    outputSummary: record(value.output_summary),
    tokensUsed: count(value.tokens_used, 0),
    tokenBudgetEstimate: numberOrNull(value.token_budget_estimate),
    replanCount: count(value.replan_count, 0),
    complexityTier: text(value.complexity_tier),
    checkEachStep: value.check_each_step === true,
    stopReason: text(value.stop_reason),
    stopDetail: text(value.stop_detail),
    createdAt: text(value.created_at),
    startedAt: text(value.started_at),
    completedAt: text(value.completed_at),
    updatedAt: text(value.updated_at),
  };
}

export function parseMissionTask(value: unknown): MissionTask | null {
  if (!isRecord(value)) return null;
  const id = idOf(value.id);
  if (!id) return null;
  return {
    id,
    title: text(value.title) ?? "",
    description: text(value.description),
    sequenceNumber: count(value.sequence_number, 0),
    agentRole: text(value.agent_role),
    state: text(value.state) ?? "",
    assignedAgentId: numberOrNull(value.assigned_agent_id),
    dependsOn: strings(value.depends_on),
    attemptNumber: count(value.attempt_number, 0),
    tokensUsed: count(value.tokens_used, 0),
    failureReasonCode: text(value.failure_reason_code),
    failureDetail: text(value.failure_detail),
    outputExcerpt: text(value.output_excerpt),
    startedAt: text(value.started_at),
    completedAt: text(value.completed_at),
  };
}

export function parseMissionEvent(value: unknown): MissionEvent | null {
  if (!isRecord(value)) return null;
  const id = idOf(value.id);
  if (!id) return null;
  return {
    id,
    eventType: text(value.event_type) ?? "",
    actorType: text(value.actor_type) ?? "",
    actorId: text(value.actor_id),
    oldState: text(value.old_state),
    newState: text(value.new_state),
    taskId: text(value.task_id),
    stopDetail: text(value.stop_detail),
    createdAt: text(value.created_at),
  };
}

function parseTaskProgress(value: unknown, tasks: readonly MissionTask[]): TaskProgress {
  const progress: Json = record(value) ?? {};
  return {
    total: count(progress.total, tasks.length),
    done: count(progress.done, 0),
    active: count(progress.active, 0),
    verified: count(progress.verified, 0),
    failed: count(progress.failed, 0),
    skipped: count(progress.skipped, 0),
    allTerminal: progress.all_terminal === true,
  };
}

function parsePermissionDenial(value: unknown): PermissionDenial | null {
  if (!isRecord(value)) return null;
  return {
    agentName: text(value.agent_name),
    toolName: text(value.tool_name),
    reason: text(value.reason),
    deniedAt: text(value.denied_at),
  };
}

export function parseMissionDetail(value: unknown): MissionDetail | null {
  const mission = parseMission(value);
  if (!mission || !isRecord(value)) return null;
  const tasks = listOf(value.tasks, parseMissionTask);
  return {
    ...mission,
    tasks,
    recentEvents: listOf(value.recent_events, parseMissionEvent),
    taskProgress: parseTaskProgress(value.task_progress, tasks),
    permissionDenials: listOf(value.permission_denials, parsePermissionDenial),
  };
}

export function parseMissionList(value: unknown): MissionList {
  const body: Json = record(value) ?? {};
  const missions = listOf(body.missions, parseMission);
  return {
    missions,
    total: count(body.total, missions.length),
    limit: count(body.limit, missions.length),
    offset: count(body.offset, 0),
  };
}

export function parseMissionEventPage(value: unknown): MissionEventPage {
  const body: Json = record(value) ?? {};
  const events = listOf(body.events, parseMissionEvent);
  return {
    events,
    total: count(body.total, events.length),
    limit: count(body.limit, events.length),
    offset: count(body.offset, 0),
  };
}

function parseTopAgent(value: unknown): TopAgent | null {
  if (!isRecord(value)) return null;
  const agentId = numberOrNull(value.agent_id);
  if (agentId === null) return null;
  return {
    agentId,
    agentName: text(value.agent_name) ?? "",
    tasksCompleted: count(value.tasks_completed, 0),
    avgTokensPerTask: count(value.avg_tokens_per_task, 0),
  };
}

function failureCounts(value: unknown): Readonly<Record<string, number>> {
  const reasons: Json = record(value) ?? {};
  return Object.fromEntries(
    Object.entries(reasons).filter((entry): entry is [string, number] => numberOrNull(entry[1]) !== null),
  );
}

export function parseMissionStats(value: unknown): MissionStats {
  const body: Json = record(value) ?? {};
  return {
    totalMissions: count(body.total_missions, 0),
    successRate: count(body.success_rate, 0),
    avgDurationMinutes: numberOrNull(body.avg_duration_minutes),
    avgTokensUsed: count(body.avg_tokens_used, 0),
    avgTasksPerMission: count(body.avg_tasks_per_mission, 0),
    topAgents: listOf(body.top_agents, parseTopAgent),
    commonFailureReasons: failureCounts(body.common_failure_reasons),
    period: text(body.period) ?? "",
  };
}

function parseTaskCost(value: unknown): MissionCost["tasks"][number] | null {
  if (!isRecord(value)) return null;
  const taskId = idOf(value.task_id);
  if (!taskId) return null;
  return { taskId, title: text(value.title) ?? "", tokensUsed: count(value.tokens_used, 0) };
}

export function parseMissionCost(value: unknown): MissionCost {
  const body: Json = record(value) ?? {};
  return {
    missionId: idOf(body.mission_id) ?? "",
    totalTokens: count(body.total_tokens, 0),
    estimatedCost: count(body.estimated_cost, 0),
    costPer1kTokens: count(body.cost_per_1k_tokens, 0),
    tasks: listOf(body.tasks, parseTaskCost),
  };
}
