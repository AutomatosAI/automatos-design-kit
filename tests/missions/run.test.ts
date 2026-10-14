// @vitest-environment node
import { describe, expect, it } from "vitest";

import { missionCaption, missionMascot } from "@/lib/missions/mascot";
import { forTasks, hasChanges, NO_CHANGES, planEdits, planProblem, TITLE_MAX, titleOf, withAgent, withTitle } from "@/lib/missions/plan";
import {
  costFigures,
  eventLabel,
  eventMove,
  headerActions,
  isMissionId,
  mergeEvents,
  needsConfirming,
  reasonProblem,
  taskAgent,
  taskChip,
} from "@/lib/missions/run";
import type { MissionEvent, MissionTask } from "@/lib/missions/types";

// The run page's pure rules (P-005): buttons, chips, the feed, the plan edits and Auto.

function task(id: string, fields: Partial<MissionTask> = {}): MissionTask {
  return {
    id,
    title: `Task ${id}`,
    description: null,
    sequenceNumber: 1,
    agentRole: null,
    state: "pending",
    assignedAgentId: null,
    dependsOn: [],
    attemptNumber: 0,
    tokensUsed: 0,
    failureReasonCode: null,
    failureDetail: null,
    outputExcerpt: null,
    startedAt: null,
    completedAt: null,
    ...fields,
  };
}

function event(id: string, createdAt: string | null, fields: Partial<MissionEvent> = {}): MissionEvent {
  return {
    id,
    eventType: "task_started",
    actorType: "system",
    actorId: null,
    oldState: null,
    newState: null,
    taskId: null,
    stopDetail: null,
    createdAt,
    ...fields,
  };
}

describe("the header's actions", () => {
  it("leaves the plan edit to the plan review and confirms only Cancel, Reject and Delete", () => {
    expect(headerActions("awaiting_approval")).toEqual(["approve", "reject", "cancel"]);
    expect(headerActions("failed")).toEqual(["replan", "resume", "delete"]);
    expect(headerActions("someday")).toEqual([]);
    expect((["cancel", "reject", "delete"] as const).every((action) => needsConfirming(action))).toBe(true);
    expect(needsConfirming("pause")).toBe(false);
    expect(needsConfirming("approve")).toBe(false);
  });

  it("needs a reason of 1-2000 characters to reject", () => {
    expect(reasonProblem("   ")).toBe("Say why you are rejecting the plan.");
    expect(reasonProblem("x".repeat(2001))).toMatch(/under 2000/);
    expect(reasonProblem(" Too many channels ")).toBeNull();
  });
});

describe("steps", () => {
  it("names each task state in words; a completed task is still to be checked", () => {
    expect(taskChip("verified")).toEqual({ tone: "done", label: "Done" });
    expect(taskChip("completed")).toEqual({ tone: "running", label: "To check" });
    expect(taskChip("failed").tone).toBe("failed");
    expect(taskChip("brand_new")).toEqual({ tone: "idle", label: "Brand new" });
    expect(taskChip("constructor")).toEqual({ tone: "idle", label: "Constructor" });
  });

  it("names the agent from the agents list, else the role, else no one yet", () => {
    const names = new Map([[7, "Researcher Rae"]]);
    expect(taskAgent(task("a", { assignedAgentId: 7, agentRole: "researcher" }), names)).toBe("Researcher Rae");
    expect(taskAgent(task("b", { assignedAgentId: 8, agentRole: "writer" }), names)).toBe("writer");
    expect(taskAgent(task("c", { agentRole: "  " }), names)).toBe("No agent yet");
  });
});

describe("the activity feed", () => {
  it("uses Studio's words, and readable ones for an event it doesn't know", () => {
    expect(eventLabel("run_plan_ready")).toBe("Plan ready for review");
    expect(eventLabel("run_teleported")).toBe("Run teleported");
    expect(eventLabel("toString")).toBe("ToString");
    expect(eventMove(event("e", null, { oldState: "running", newState: "paused" }))).toBe("Running → Paused");
    expect(eventMove(event("e", null))).toBeNull();
  });

  it("merges pages by id, newest first, the later copy winning", () => {
    const loaded = [event("b", "2026-10-14T09:00:00Z"), event("a", "2026-10-14T08:00:00Z")];
    const incoming = [event("c", "2026-10-14T10:00:00Z"), event("b", "2026-10-14T09:00:00Z", { stopDetail: "fresh" })];
    const merged = mergeEvents(loaded, incoming);
    expect(merged.map((row) => row.id)).toEqual(["c", "b", "a"]);
    expect(merged[1]?.stopDetail).toBe("fresh");
    expect(loaded.map((row) => row.id)).toEqual(["b", "a"]);
  });
});

describe("plan edits", () => {
  const first = task("t1", { title: "Research", assignedAgentId: 7 });
  const second = task("t2", { title: "Draft", assignedAgentId: 9 });

  it("keeps only what differs from the plan, one edit per task", () => {
    const changes = withAgent(withTitle(NO_CHANGES, second, "Draft it"), first, 9);
    expect(planEdits(changes)).toEqual([
      { taskId: "t2", title: "Draft it" },
      { taskId: "t1", agentId: 9 },
    ]);
    expect(titleOf(changes, second)).toBe("Draft it");
    const undone = withAgent(withTitle(changes, second, "Draft"), first, 7);
    expect(hasChanges(undone)).toBe(false);
    expect(NO_CHANGES).toEqual({});
  });

  it("drops edits for tasks a replan replaced", () => {
    const changes = withTitle(withTitle(NO_CHANGES, first, "Research it"), second, "Draft it");
    expect(Object.keys(forTasks(changes, [second]))).toEqual(["t2"]);
    expect(forTasks(changes, [first, second])).toBe(changes);
  });

  it("trims titles and refuses blank or too long ones", () => {
    expect(planEdits(withTitle(NO_CHANGES, first, "  New  "))).toEqual([{ taskId: "t1", title: "New" }]);
    expect(planProblem(withTitle(NO_CHANGES, first, "  "))).toBe("Every step needs a title.");
    expect(planProblem(withTitle(NO_CHANGES, first, "x".repeat(TITLE_MAX + 1)))).toMatch(/under 500/);
    expect(planProblem(withTitle(NO_CHANGES, first, "Fine"))).toBeNull();
  });
});

describe("Auto on a Mission", () => {
  it.each([
    ["planning", "thinking"],
    ["replanning", "thinking"],
    ["running", "working"],
    ["verifying", "working"],
    ["awaiting_approval", "listening"],
    ["awaiting_human", "listening"],
    ["paused", "idle"],
    ["completed", "celebrate"],
    ["failed", "oops"],
    ["cancelled", "idle"],
    ["someday", "idle"],
  ])("%s -> %s", (state, mascot) => {
    expect(missionMascot(state, false)).toBe(mascot);
  });

  it("celebrates a completed Mission once, then idles", () => {
    expect(missionMascot("completed", true)).toBe("idle");
    expect(missionMascot("failed", true)).toBe("oops");
    expect(missionCaption("awaiting_approval")).toBe("Your plan is ready to look over");
    expect(missionCaption("someday")).toBeUndefined();
  });
});

describe("the rest", () => {
  it("states the cost in tokens and the backend's own estimate", () => {
    const figures = costFigures({ missionId: "m", totalTokens: 5400, estimatedCost: 0.0162, costPer1kTokens: 0.003, tasks: [] });
    expect(figures).toEqual({ tokens: "5,400 tokens", estimate: "about $0.0162" });
  });

  it("accepts only ids the API can take", () => {
    expect(isMissionId("3f1c2a9e-5b7d-4e2f-9a1b-0c8d6e4f2a10")).toBe(true);
    expect(isMissionId("../etc")).toBe(false);
    expect(isMissionId("")).toBe(false);
  });
});
