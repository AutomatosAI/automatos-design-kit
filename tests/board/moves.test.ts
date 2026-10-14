import { describe, expect, it } from "vitest";
import { allowedColumns, columnMoves, isPlaybookCard, isRunning, MOVE_REFUSALS, moveRefusal, type MoveTask } from "@/lib/board/moves";
import { BOARD_COLUMNS, isBoardStatus, isTaskId, SIDE_STATES, STATUS_LABELS } from "@/lib/board/types";

// B-001: the board's move rules, mirroring the core's board_drag_rules.py.

const NOW = new Date("2026-10-14T12:00:00Z");
const LATER = "2026-10-14T12:05:00Z";
const EARLIER = "2026-10-14T11:55:00Z";

function task(overrides: Partial<MoveTask> = {}): MoveTask {
  return {
    status: "inbox",
    assignedAgentId: 7,
    result: null,
    sourceType: "user",
    sourceId: null,
    leaseUntil: null,
    blockedCode: null,
    reviewReason: null,
    ...overrides,
  };
}

describe("columns", () => {
  it("are in board order, with the side states apart", () => {
    expect(BOARD_COLUMNS).toEqual(["inbox", "assigned", "in_progress", "review", "blocked", "done"]);
    expect(SIDE_STATES).toEqual(["failed", "cancelled", "closed"]);
    expect(STATUS_LABELS.in_progress).toBe("In progress");
    expect(isBoardStatus("cancelled")).toBe(true);
    expect(isBoardStatus("archived")).toBe(false);
  });

  it("ids are whole numbers", () => {
    expect(isTaskId("42")).toBe(true);
    expect(["0", "-1", "1.5", "abc", "stream", "12345678901234"].some(isTaskId)).toBe(false);
  });
});

describe("moveRefusal", () => {
  it("review → done: use Approve", () => {
    expect(moveRefusal(task({ status: "review", result: "Done it" }), "done", NOW)).toBe(MOVE_REFUSALS.useApprove);
  });

  it("review → assigned: use Reject", () => {
    expect(moveRefusal(task({ status: "review", result: "Done it" }), "assigned", NOW)).toBe(MOVE_REFUSALS.useReject);
  });

  it("→ in progress needs an agent", () => {
    expect(moveRefusal(task({ assignedAgentId: null }), "in_progress", NOW)).toBe(MOVE_REFUSALS.noAgent);
    expect(moveRefusal(task({ assignedAgentId: 7 }), "in_progress", NOW)).toBeNull();
  });

  it("a Playbook's own card needs no agent to start", () => {
    const card = task({ assignedAgentId: null, sourceType: "recipe", sourceId: "exec-123" });

    expect(isPlaybookCard(card)).toBe(true);
    expect(moveRefusal(card, "in_progress", NOW)).toBeNull();
    expect(isPlaybookCard(task({ sourceType: "recipe", sourceId: "recipe:exec-123:2" }))).toBe(false);
  });

  it("a running Task only cancels", () => {
    const running = task({ status: "in_progress", leaseUntil: LATER, result: "Partial" });

    expect(isRunning(running, NOW)).toBe(true);
    expect(moveRefusal(running, "review", NOW)).toBe(MOVE_REFUSALS.running);
    expect(moveRefusal(running, "done", NOW)).toBe(MOVE_REFUSALS.running);
    expect(moveRefusal(running, "inbox", NOW)).toBe(MOVE_REFUSALS.running);
    expect(moveRefusal(running, "blocked", NOW)).toBe(MOVE_REFUSALS.running);
    expect(moveRefusal(running, "cancelled", NOW)).toBeNull();
  });

  it("an in-progress Task with a lapsed lease isn't running", () => {
    const stuck = task({ status: "in_progress", leaseUntil: EARLIER });

    expect(isRunning(stuck, NOW)).toBe(false);
    expect(moveRefusal(stuck, "inbox", NOW)).toBeNull();
  });

  it("done and review need a result", () => {
    expect(moveRefusal(task({ status: "inbox" }), "done", NOW)).toBe(MOVE_REFUSALS.notStarted);
    expect(moveRefusal(task({ status: "assigned", result: "  " }), "review", NOW)).toBe(MOVE_REFUSALS.notStarted);
    expect(moveRefusal(task({ status: "failed" }), "review", NOW)).toBe(MOVE_REFUSALS.failedNoResult);
    expect(moveRefusal(task({ status: "blocked" }), "done", NOW)).toBe(MOVE_REFUSALS.noResult);
    expect(moveRefusal(task({ status: "blocked", result: "The answer" }), "review", NOW)).toBeNull();
  });

  it("a Mission's own Task can't be started by hand", () => {
    const step = task({ status: "assigned", sourceType: "orchestration_task", assignedAgentId: null });
    const card = task({ status: "blocked", sourceType: "orchestration" });
    const cliStep = task({ status: "inbox", sourceType: "mission" });

    expect(moveRefusal(step, "in_progress", NOW)).toBe(MOVE_REFUSALS.missionRunsIt);
    expect(moveRefusal(card, "in_progress", NOW)).toBe(MOVE_REFUSALS.missionRunsIt);
    expect(moveRefusal(card, "assigned", NOW)).toBe(MOVE_REFUSALS.missionRunsIt);
    expect(moveRefusal(cliStep, "assigned", NOW)).toBe(MOVE_REFUSALS.missionRunsIt);
    expect(moveRefusal(step, "blocked", NOW)).toBeNull();
  });

  it("a Mission's Task still needs a result for done or review", () => {
    expect(moveRefusal(task({ status: "blocked", sourceType: "orchestration_task" }), "review", NOW)).toBe(
      MOVE_REFUSALS.missionNoResult,
    );
    expect(
      moveRefusal(task({ status: "blocked", sourceType: "orchestration_task", result: "Step done" }), "review", NOW),
    ).toBeNull();
  });

  it("a Mission's card whose plan waits starts by approving the plan", () => {
    const waiting = task({ status: "review", sourceType: "orchestration", reviewReason: "mission_plan", result: "Plan" });

    expect(moveRefusal(waiting, "in_progress", NOW)).toBeNull();
  });

  it("a Task waiting on its question is answered first", () => {
    expect(moveRefusal(task({ status: "blocked", blockedCode: "question" }), "in_progress", NOW)).toBe(
      MOVE_REFUSALS.answerFirst,
    );
    expect(moveRefusal(task({ status: "blocked", blockedCode: "approval" }), "in_progress", NOW)).toBeNull();
  });

  it("refuses its own column and anything that isn't a status", () => {
    expect(moveRefusal(task({ status: "review", result: "x" }), "review", NOW)).toBe("It's already in Review.");
    expect(moveRefusal(task(), "archived", NOW)).toBe(MOVE_REFUSALS.notAColumn);
  });

  it("lets an ordinary move through", () => {
    expect(moveRefusal(task({ status: "inbox" }), "assigned", NOW)).toBeNull();
    expect(moveRefusal(task({ status: "done", result: "x" }), "inbox", NOW)).toBeNull();
    expect(moveRefusal(task({ status: "inbox" }), "cancelled", NOW)).toBeNull();
  });
});

describe("column moves", () => {
  it("lists every other column with its refusal, and the allowed ones in board order", () => {
    const inReview = task({ status: "review", result: "Draft" });

    expect(columnMoves(inReview, NOW).map((move) => move.column)).toEqual([
      "inbox",
      "assigned",
      "in_progress",
      "blocked",
      "done",
    ]);
    expect(allowedColumns(inReview, NOW)).toEqual(["inbox", "in_progress", "blocked"]);
  });

  it("a running Task may only stay where it is among the columns", () => {
    expect(allowedColumns(task({ status: "in_progress", leaseUntil: LATER }), NOW)).toEqual([]);
  });
});
