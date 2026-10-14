import { describe, expect, it } from "vitest";
import {
  parseMissionCost,
  parseMissionDetail,
  parseMissionEventPage,
  parseMissionList,
  parseMissionStats,
} from "@/lib/missions/parse";

// Shapes from orchestrator/api/missions.py (_run_to_response, _task_to_response,
// _event_to_response, _task_progress).

const MISSION = {
  id: "m1",
  workspace_id: "ws",
  goal: "Write the launch post",
  state: "running",
  state_type: "active",
  plan: { tasks: [] },
  config: { source: "chat", chat_id: "c1" },
  check_each_step: false,
  output_summary: null,
  token_budget_estimate: 48000,
  tokens_used: 1200,
  replan_count: 0,
  complexity_tier: "simple",
  created_by: "local",
  stop_reason: null,
  stop_detail: null,
  started_at: "2026-10-14T09:00:00Z",
  completed_at: null,
  created_at: "2026-10-14T08:59:00Z",
  updated_at: "2026-10-14T09:01:00Z",
};

const TASK = {
  id: "t1",
  title: "Draft",
  description: "Draft the post",
  sequence_number: 1,
  agent_role: "writer",
  state: "completed",
  assigned_agent_id: 4,
  depends_on: ["t0", 7],
  attempt_number: 1,
  tokens_used: 900,
  failure_reason_code: null,
  failure_detail: null,
  output_excerpt: "Here is the draft",
  started_at: "2026-10-14T09:00:10Z",
  completed_at: null,
};

const EVENT = {
  id: "e1",
  event_type: "state_changed",
  actor_type: "system",
  actor_id: null,
  old_state: "awaiting_approval",
  new_state: "running",
  task_id: null,
  stop_detail: null,
  created_at: "2026-10-14T09:00:00Z",
};

describe("parseMissionDetail", () => {
  it("reads the Mission, its tasks, events and progress in camelCase", () => {
    const detail = parseMissionDetail({
      ...MISSION,
      tasks: [TASK, { title: "no id" }],
      recent_events: [EVENT],
      task_progress: { total: 1, done: 0, active: 1, verified: 0, failed: 0, skipped: 0, all_terminal: false },
      permission_denials: [{ agent_name: "Writer", tool_name: "web_search", reason: "off", denied_at: null }],
    });

    expect(detail).toMatchObject({
      id: "m1",
      goal: "Write the launch post",
      state: "running",
      tokensUsed: 1200,
      tokenBudgetEstimate: 48000,
      config: { source: "chat", chat_id: "c1" },
      taskProgress: { total: 1, active: 1, allTerminal: false },
      permissionDenials: [{ agentName: "Writer", toolName: "web_search", reason: "off", deniedAt: null }],
    });
    expect(detail?.tasks).toEqual([
      {
        id: "t1",
        title: "Draft",
        description: "Draft the post",
        sequenceNumber: 1,
        agentRole: "writer",
        state: "completed",
        assignedAgentId: 4,
        dependsOn: ["t0"],
        attemptNumber: 1,
        tokensUsed: 900,
        failureReasonCode: null,
        failureDetail: null,
        outputExcerpt: "Here is the draft",
        startedAt: "2026-10-14T09:00:10Z",
        completedAt: null,
      },
    ]);
    expect(detail?.recentEvents[0]).toMatchObject({ eventType: "state_changed", newState: "running" });
  });

  it("refuses an answer with no id, and fills what's missing", () => {
    expect(parseMissionDetail({ goal: "x" })).toBeNull();
    expect(parseMissionDetail("nope")).toBeNull();
    const bare = parseMissionDetail({ id: "m2" });
    expect(bare).toMatchObject({ goal: "", state: "", tasks: [], recentEvents: [], tokensUsed: 0 });
    expect(bare?.taskProgress).toEqual({
      total: 0,
      done: 0,
      active: 0,
      verified: 0,
      failed: 0,
      skipped: 0,
      allTerminal: false,
    });
  });
});

describe("the Mission lists and figures", () => {
  it("reads a page of Missions", () => {
    const list = parseMissionList({ missions: [MISSION, null], total: 41, limit: 20, offset: 20 });

    expect(list.missions.map((mission) => mission.id)).toEqual(["m1"]);
    expect(list).toMatchObject({ total: 41, limit: 20, offset: 20 });
    expect(parseMissionList(null)).toEqual({ missions: [], total: 0, limit: 0, offset: 0 });
  });

  it("reads a list row's task progress only when the row carries it", () => {
    const progress = { total: 3, done: 2, active: 1, verified: 2, failed: 0, skipped: 0, all_terminal: false };
    const list = parseMissionList({ missions: [MISSION, { ...MISSION, id: "m9", task_progress: progress }] });

    expect(list.missions[0]?.taskProgress).toBeNull();
    expect(list.missions[1]?.taskProgress).toMatchObject({ total: 3, done: 2, allTerminal: false });
  });

  it("reads a page of events", () => {
    const page = parseMissionEventPage({ events: [EVENT], total: 120, limit: 50, offset: 50 });

    expect(page.events).toHaveLength(1);
    expect(page).toMatchObject({ total: 120, limit: 50, offset: 50 });
  });

  it("reads the stats, keeping only numeric failure counts", () => {
    const stats = parseMissionStats({
      total_missions: 12,
      success_rate: 0.75,
      avg_duration_minutes: null,
      avg_tokens_used: 5000,
      avg_tasks_per_mission: 3.5,
      top_agents: [{ agent_id: 4, agent_name: "Writer", tasks_completed: 9, avg_tokens_per_task: 800 }, { agent_name: "x" }],
      common_failure_reasons: { timeout: 2, odd: "many" },
      period: "30d",
    });

    expect(stats).toEqual({
      totalMissions: 12,
      successRate: 0.75,
      avgDurationMinutes: null,
      avgTokensUsed: 5000,
      avgTasksPerMission: 3.5,
      topAgents: [{ agentId: 4, agentName: "Writer", tasksCompleted: 9, avgTokensPerTask: 800 }],
      commonFailureReasons: { timeout: 2 },
      period: "30d",
    });
  });

  it("reads the cost", () => {
    expect(
      parseMissionCost({
        mission_id: "m1",
        total_tokens: 1200,
        estimated_cost: 0.02,
        cost_per_1k_tokens: 0.015,
        tasks: [{ task_id: "t1", title: "Draft", tokens_used: 900 }],
      }),
    ).toEqual({
      missionId: "m1",
      totalTokens: 1200,
      estimatedCost: 0.02,
      costPer1kTokens: 0.015,
      tasks: [{ taskId: "t1", title: "Draft", tokensUsed: 900 }],
    });
  });
});
