// The Mission shapes Play uses, camelCase, from skills/build-automatos-interface/references/missions.md
// (orchestrator/api/missions.py: MissionResponse, TaskResponse, EventResponse, MissionStatsResponse,
// MissionCostResponse). Parsers are in lib/missions/parse.ts.

type Json = Readonly<Record<string, unknown>>;

export const MISSION_STATES = [
  "pending",
  "planning",
  "awaiting_approval",
  "running",
  "paused",
  "replanning",
  "verifying",
  "awaiting_human",
  "completed",
  "failed",
  "cancelled",
] as const;

export type MissionState = (typeof MISSION_STATES)[number];

/** A task's ended states are verified, failed and skipped. completed is not one of them. */
export const TASK_STATES = [
  "pending",
  "queued",
  "assigned",
  "running",
  "completed",
  "verifying",
  "verified",
  "failed",
  "skipped",
  "stalled",
  "retrying",
] as const;

export type TaskState = (typeof TASK_STATES)[number];

export type Mission = {
  readonly id: string;
  readonly goal: string;
  /** A MissionState, kept as the backend's own string so a newer state isn't lost. */
  readonly state: string;
  readonly config: Json | null;
  readonly plan: Json | null;
  readonly outputSummary: Json | null;
  readonly tokensUsed: number;
  readonly tokenBudgetEstimate: number | null;
  readonly replanCount: number;
  readonly complexityTier: string | null;
  readonly checkEachStep: boolean;
  /** Why the run stopped (a budget pause names the spend and the budget). */
  readonly stopReason: string | null;
  readonly stopDetail: string | null;
  readonly createdAt: string | null;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly updatedAt: string | null;
  /** Counted from the task rows. GET /api/missions/{id} carries it; list rows have none today (null). */
  readonly taskProgress: TaskProgress | null;
};

export type MissionTask = {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly sequenceNumber: number;
  readonly agentRole: string | null;
  /** A TaskState, kept as the backend's own string. */
  readonly state: string;
  /** No agent name on a task: join this against the agents list (lib/agents/names.ts). */
  readonly assignedAgentId: number | null;
  readonly dependsOn: readonly string[];
  readonly attemptNumber: number;
  readonly tokensUsed: number;
  readonly failureReasonCode: string | null;
  readonly failureDetail: string | null;
  /** Up to 500 characters of the task's output. */
  readonly outputExcerpt: string | null;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
};

export type MissionEvent = {
  readonly id: string;
  readonly eventType: string;
  readonly actorType: string;
  readonly actorId: string | null;
  readonly oldState: string | null;
  readonly newState: string | null;
  readonly taskId: string | null;
  readonly stopDetail: string | null;
  readonly createdAt: string | null;
};

/** Counted by the backend from the task rows, so the page never derives it. */
export type TaskProgress = {
  readonly total: number;
  readonly done: number;
  readonly active: number;
  readonly verified: number;
  readonly failed: number;
  readonly skipped: number;
  /** Every task has ended but the Mission hasn't caught up yet. */
  readonly allTerminal: boolean;
};

export type PermissionDenial = {
  readonly agentName: string | null;
  readonly toolName: string | null;
  readonly reason: string | null;
  readonly deniedAt: string | null;
};

export type MissionDetail = Omit<Mission, "taskProgress"> & {
  readonly tasks: readonly MissionTask[];
  /** The latest 50, newest first. */
  readonly recentEvents: readonly MissionEvent[];
  readonly taskProgress: TaskProgress;
  readonly permissionDenials: readonly PermissionDenial[];
};

export type Page = { readonly total: number; readonly limit: number; readonly offset: number };

export type MissionList = Page & { readonly missions: readonly Mission[] };

export type MissionEventPage = Page & { readonly events: readonly MissionEvent[] };

export type MissionStatsPeriod = "7d" | "30d" | "90d" | "all";

export type TopAgent = {
  readonly agentId: number;
  readonly agentName: string;
  readonly tasksCompleted: number;
  readonly avgTokensPerTask: number;
};

export type MissionStats = {
  readonly totalMissions: number;
  readonly successRate: number;
  readonly avgDurationMinutes: number | null;
  readonly avgTokensUsed: number;
  readonly avgTasksPerMission: number;
  readonly topAgents: readonly TopAgent[];
  readonly commonFailureReasons: Readonly<Record<string, number>>;
  readonly period: string;
};

export type MissionCost = {
  readonly missionId: string;
  readonly totalTokens: number;
  readonly estimatedCost: number;
  readonly costPer1kTokens: number;
  readonly tasks: readonly { readonly taskId: string; readonly title: string; readonly tokensUsed: number }[];
};

// What the browser sends (camelCase here; the client writes the backend's snake_case).

export type MissionQuery = { readonly state?: MissionState; readonly limit?: number; readonly offset?: number };

export type MissionEventQuery = { readonly eventType?: string; readonly limit?: number; readonly offset?: number };

export type NewMission = {
  /** 1-10000 characters. */
  readonly goal: string;
  readonly config?: Json;
  readonly templateId?: string;
  /** Plan, then wait for approval; never start on its own. */
  readonly planOnly?: boolean;
};

/** One task edit for PATCH /plan. Name the task by taskId, tempId or sequenceNumber. */
export type PlanEdit = {
  readonly taskId?: string;
  readonly tempId?: string;
  readonly sequenceNumber?: number;
  readonly agentId?: number;
  readonly agentRole?: string;
  readonly title?: string;
  readonly description?: string;
};

export type ResumeOptions = { readonly additionalTokens?: number; readonly additionalCost?: number };
