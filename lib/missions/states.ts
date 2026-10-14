import type { StateChipProps, StateTone } from "@/components/page/StateChip";
import { MISSION_STATES, type MissionState, type TaskState } from "@/lib/missions/types";

// What a Mission's state means on screen and what the user may do from it
// (missions.md, "States", checked against orchestrator/api/missions.py). Pure.

export type MissionAction = "edit-plan" | "approve" | "reject" | "pause" | "resume" | "cancel" | "replan" | "delete";

const CHIPS: Readonly<Record<MissionState, StateChipProps>> = {
  pending: { tone: "queued", label: "Starting" },
  planning: { tone: "running", label: "Planning" },
  replanning: { tone: "running", label: "Replanning" },
  awaiting_approval: { tone: "needs-you", label: "Needs approval" },
  running: { tone: "running", label: "Running" },
  verifying: { tone: "running", label: "Checking" },
  paused: { tone: "paused", label: "Paused" },
  awaiting_human: { tone: "needs-you", label: "Waiting for a person" },
  completed: { tone: "done", label: "Done" },
  failed: { tone: "failed", label: "Failed" },
  cancelled: { tone: "idle", label: "Cancelled" },
};

// The core allows pause only from running (not verifying), and resume from paused or
// failed (a failed Mission is retried). Cancel from any state that hasn't ended.
const ACTIONS: Readonly<Record<MissionState, readonly MissionAction[]>> = {
  pending: ["cancel"],
  planning: ["cancel"],
  replanning: ["cancel"],
  awaiting_approval: ["edit-plan", "approve", "reject", "cancel"],
  running: ["pause", "cancel"],
  verifying: ["cancel"],
  paused: ["resume", "cancel"],
  // No action route for a person's review any more: Cancel is all there is.
  awaiting_human: ["cancel"],
  completed: ["delete"],
  failed: ["replan", "resume", "delete"],
  cancelled: ["delete"],
};

const ENDED_MISSION: ReadonlySet<string> = new Set<MissionState>(["completed", "failed", "cancelled"]);
const ENDED_TASK: ReadonlySet<string> = new Set<TaskState>(["verified", "failed", "skipped"]);

export function isMissionState(state: string): state is MissionState {
  return (MISSION_STATES as readonly string[]).includes(state);
}

/** "awaiting_human" -> "Awaiting human", for a state this build doesn't know yet. */
function stateWords(state: string): string {
  const words = state.replace(/_/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Unknown";
}

export function stateChip(state: string): StateChipProps {
  return isMissionState(state) ? CHIPS[state] : { tone: "idle", label: stateWords(state) };
}

export function stateTone(state: string): StateTone {
  return stateChip(state).tone;
}

/** The actions the backend allows from this state, in button order. None for an unknown state. */
export function actionsFor(state: string): readonly MissionAction[] {
  return isMissionState(state) ? ACTIONS[state] : [];
}

/** completed, failed or cancelled: stop polling. */
export function isEnded(state: string): boolean {
  return ENDED_MISSION.has(state);
}

/** verified, failed or skipped. A completed task still has to be verified, so it hasn't ended. */
export function taskEnded(taskState: string): boolean {
  return ENDED_TASK.has(taskState);
}

// "This Mission <state phrase>, so <action phrase>."
const STATE_PHRASES: Readonly<Record<MissionState, string>> = {
  pending: "hasn't started yet",
  planning: "is still being planned",
  replanning: "is being replanned",
  awaiting_approval: "is waiting for your approval",
  running: "is already running",
  verifying: "is being checked",
  paused: "is paused",
  awaiting_human: "is waiting for a person",
  completed: "has already finished",
  failed: "has failed",
  cancelled: "was cancelled",
};

const ACTION_PHRASES: Readonly<Record<MissionAction, string>> = {
  "edit-plan": "its plan can't be changed",
  approve: "it can't be approved",
  reject: "it can't be rejected",
  pause: "it can't be paused",
  resume: "it can't be resumed",
  cancel: "it can't be cancelled",
  replan: "it can't be replanned",
  delete: "it can't be deleted",
};

const CHANGED_MEANWHILE = "This Mission changed just now. Try again once it has refreshed.";

export function refusalSentence(action: MissionAction, state: MissionState): string {
  return `This Mission ${STATE_PHRASES[state]}, so ${ACTION_PHRASES[action]}.`;
}

/**
 * The Mission's state named in a backend refusal: "Mission is in 'running' state, expected
 * 'paused'", "already in terminal state 'completed'", "Invalid run transition: running → paused".
 * The first state named is the current one.
 */
export function stateInDetail(detail: string): MissionState | null {
  const transition = /transition:\s*([a-z_]+)\s*→/.exec(detail)?.[1];
  if (transition && isMissionState(transition)) return transition;
  for (const match of detail.matchAll(/'([a-z_]+)'/g)) {
    const named = match[1];
    if (named && isMissionState(named)) return named;
  }
  return null;
}

/**
 * A refused move in words, or null to keep the backend's own message. The core checks the
 * state first and answers 400 naming it; a move that loses a race answers 409.
 */
export function missionRefusal(action: MissionAction, status: number, detail: string): string | null {
  if (status !== 409 && status !== 400) return null;
  const state = stateInDetail(detail);
  if (state) return refusalSentence(action, state);
  return status === 409 ? CHANGED_MEANWHILE : null;
}
