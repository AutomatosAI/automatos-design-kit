import { describe, expect, it } from "vitest";
import {
  actionsFor,
  isEnded,
  missionRefusal,
  refusalSentence,
  stateChip,
  stateInDetail,
  stateTone,
  taskEnded,
  type MissionAction,
} from "@/lib/missions/states";
import { MISSION_STATES, TASK_STATES, type MissionState } from "@/lib/missions/types";

// missions.md "States", with the core's own checks (orchestrator/api/missions.py): pause
// only from running, resume from paused or failed, cancel from anything not ended.
const EXPECTED_ACTIONS: Readonly<Record<MissionState, readonly MissionAction[]>> = {
  pending: ["cancel"],
  planning: ["cancel"],
  replanning: ["cancel"],
  awaiting_approval: ["edit-plan", "approve", "reject", "cancel"],
  running: ["pause", "cancel"],
  verifying: ["cancel"],
  paused: ["resume", "cancel"],
  awaiting_human: ["cancel"],
  completed: ["delete"],
  failed: ["replan", "resume", "delete"],
  cancelled: ["delete"],
};

describe("actionsFor", () => {
  it.each(MISSION_STATES.map((state) => [state] as const))("gives %s its allowed actions", (state) => {
    expect(actionsFor(state)).toEqual(EXPECTED_ACTIONS[state]);
  });

  it("offers Cancel exactly while the Mission hasn't ended, and Delete only once it has", () => {
    for (const state of MISSION_STATES) {
      expect({ state, cancel: actionsFor(state).includes("cancel") }).toEqual({ state, cancel: !isEnded(state) });
      expect({ state, delete: actionsFor(state).includes("delete") }).toEqual({ state, delete: isEnded(state) });
    }
  });

  it("offers nothing for a state it doesn't know", () => {
    expect(actionsFor("teleporting")).toEqual([]);
  });
});

describe("isEnded and taskEnded", () => {
  it("ends a Mission at completed, failed and cancelled only", () => {
    expect(MISSION_STATES.filter(isEnded)).toEqual(["completed", "failed", "cancelled"]);
    expect(isEnded("teleporting")).toBe(false);
  });

  it("doesn't end a task at completed: it still has to be verified", () => {
    expect(taskEnded("completed")).toBe(false);
    expect(TASK_STATES.filter(taskEnded)).toEqual(["verified", "failed", "skipped"]);
  });
});

describe("stateTone and stateChip", () => {
  it("maps every state to a tone with a word", () => {
    expect(stateTone("running")).toBe("running");
    expect(stateTone("awaiting_approval")).toBe("needs-you");
    expect(stateTone("awaiting_human")).toBe("needs-you");
    expect(stateTone("paused")).toBe("paused");
    expect(stateTone("pending")).toBe("queued");
    expect(stateTone("completed")).toBe("done");
    expect(stateTone("failed")).toBe("failed");
    expect(stateTone("cancelled")).toBe("idle");
    for (const state of MISSION_STATES) expect(stateChip(state).label).toMatch(/^[A-Z]/);
  });

  it("shows an unknown state in words, idle", () => {
    expect(stateChip("being_reviewed")).toEqual({ tone: "idle", label: "Being reviewed" });
  });
});

describe("refusals in words", () => {
  it("names the state and the action", () => {
    expect(refusalSentence("approve", "running")).toBe("This Mission is already running, so it can't be approved.");
    expect(refusalSentence("delete", "paused")).toBe("This Mission is paused, so it can't be deleted.");
    expect(refusalSentence("edit-plan", "completed")).toBe(
      "This Mission has already finished, so its plan can't be changed.",
    );
  });

  it("reads the current state from the core's details", () => {
    expect(stateInDetail("Mission is in 'running' state, expected 'awaiting_approval'")).toBe("running");
    expect(stateInDetail("Mission is already in terminal state 'completed'")).toBe("completed");
    expect(stateInDetail("Cannot delete mission in state 'paused'. Cancel it first.")).toBe("paused");
    expect(stateInDetail("Invalid run transition: verifying → paused (entity 9d2b)")).toBe("verifying");
    expect(stateInDetail("Mission has been replanned 3 times, maximum is 3")).toBeNull();
  });

  it("turns a 409 into a sentence naming the state", () => {
    expect(missionRefusal("approve", 409, "Invalid run transition: running → running (entity 9d2b)")).toBe(
      "This Mission is already running, so it can't be approved.",
    );
  });

  it("turns the core's 400 state check into the same sentence", () => {
    expect(missionRefusal("pause", 400, "Mission is in 'verifying' state, expected 'running'")).toBe(
      "This Mission is being checked, so it can't be paused.",
    );
  });

  it("says a 409 without a state plainly, and keeps any other message", () => {
    const lock = "Optimistic lock conflict on run 9d2b — another transaction modified this row";
    expect(missionRefusal("cancel", 409, lock)).toBe("This Mission changed just now. Try again once it has refreshed.");
    expect(missionRefusal("replan", 400, "Mission has been replanned 3 times, maximum is 3")).toBeNull();
    expect(missionRefusal("approve", 500, "Mission is in 'running' state")).toBeNull();
  });
});
