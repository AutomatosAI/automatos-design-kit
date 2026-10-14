import type { StateChipProps } from "@/components/page/StateChip";
import { actionsFor, type MissionAction } from "@/lib/missions/states";
import type { MissionCost, MissionEvent, MissionTask, TaskState } from "@/lib/missions/types";

// What the Mission run page (PRD-003 P-005) says: its buttons, the confirmations, the
// steps' chips, the activity feed's lines, the times and the cost. Pure.

/** The header's buttons: every action but the plan edit, which is the plan review itself. */
export type HeaderAction = Exclude<MissionAction, "edit-plan">;

export const ACTION_LABELS: Readonly<Record<HeaderAction, string>> = {
  approve: "Approve plan",
  reject: "Reject…",
  pause: "Pause",
  resume: "Resume",
  cancel: "Cancel Mission",
  replan: "Replan",
  delete: "Delete",
};

export function headerActions(state: string): readonly HeaderAction[] {
  return actionsFor(state).filter((action): action is HeaderAction => action !== "edit-plan");
}

export type ConfirmedAction = "cancel" | "reject" | "delete";

export type Confirmation = {
  readonly question: string;
  /** The button that does it. */
  readonly confirm: string;
  /** The button that leaves things as they are. */
  readonly keep: string;
};

export const CONFIRMATIONS: Readonly<Record<ConfirmedAction, Confirmation>> = {
  cancel: { question: "Cancel this Mission? Its steps stop and it can't be started again.", confirm: "Cancel Mission", keep: "Keep it going" },
  reject: { question: "Reject this plan? Say why, so the next plan is better.", confirm: "Reject plan", keep: "Keep the plan" },
  delete: { question: "Delete this Mission? This can't be undone.", confirm: "Delete Mission", keep: "Keep it" },
};

export function needsConfirming(action: HeaderAction): action is ConfirmedAction {
  return action === "cancel" || action === "reject" || action === "delete";
}

export const REASON_LABEL = "Why are you rejecting this plan?";
export const REASON_MAX = 2000;

/** null when the reason can be sent (1-2000 characters once trimmed). */
export function reasonProblem(reason: string): string | null {
  const trimmed = reason.trim();
  if (!trimmed) return "Say why you are rejecting the plan.";
  if (trimmed.length > REASON_MAX) return `Keep the reason under ${REASON_MAX} characters.`;
  return null;
}

export const AWAITING_HUMAN_NOTE =
  "This Mission is waiting for a person to review it, but Automatos no longer has a way to give that review. There is nothing to do here except cancel it.";

// Task states as chips: a completed task still has to be checked, so it isn't done yet.
const TASK_CHIPS: Readonly<Record<TaskState, StateChipProps>> = {
  pending: { tone: "queued", label: "Waiting" },
  queued: { tone: "queued", label: "Queued" },
  assigned: { tone: "queued", label: "Assigned" },
  running: { tone: "running", label: "Running" },
  completed: { tone: "running", label: "To check" },
  verifying: { tone: "running", label: "Checking" },
  verified: { tone: "done", label: "Done" },
  failed: { tone: "failed", label: "Failed" },
  skipped: { tone: "idle", label: "Skipped" },
  stalled: { tone: "paused", label: "Stalled" },
  retrying: { tone: "running", label: "Retrying" },
};

/** "awaiting_human" -> "Awaiting human"; "" -> "Unknown". */
export function readable(words: string): string {
  const spaced = words.replace(/_/g, " ").trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : "Unknown";
}

export function taskChip(state: string): StateChipProps {
  return Object.hasOwn(TASK_CHIPS, state) ? TASK_CHIPS[state as TaskState] : { tone: "idle", label: readable(state) };
}

export function sortedTasks(tasks: readonly MissionTask[]): readonly MissionTask[] {
  return [...tasks].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
}

export const NO_AGENT = "No agent yet";

/** The agent's name from the agents list, else the task's role, else "No agent yet". */
export function taskAgent(task: MissionTask, names: ReadonlyMap<number, string>): string {
  const named = task.assignedAgentId === null ? undefined : names.get(task.assignedAgentId);
  return named ?? (task.agentRole?.trim() || NO_AGENT);
}

// Studio's activity feed words (frontend/components/missions/mission-activity-feed.tsx).
const EVENT_LABELS: Readonly<Record<string, string>> = {
  run_created: "Mission created",
  run_planning_started: "Planning started",
  run_plan_ready: "Plan ready for review",
  run_approved: "Plan approved",
  run_rejected: "Plan rejected",
  run_started: "Mission started",
  run_paused: "Mission paused",
  run_resumed: "Mission resumed",
  run_completed: "Mission completed",
  run_failed: "Mission failed",
  run_cancelled: "Mission cancelled",
  run_verifying: "Final check",
  run_awaiting_human: "Waiting for a person",
  run_replanning: "Replanning",
  run_replanned: "Mission replanned",
  task_queued: "Step queued",
  task_assigned: "Agent assigned",
  task_started: "Step started",
  task_output_submitted: "Output submitted",
  task_verification_started: "Check started",
  task_verification_passed: "Check passed",
  task_verification_failed: "Check failed",
  task_retrying: "Step retrying",
  task_failed: "Step failed",
  task_skipped: "Step skipped",
  task_stalled: "Step stalled",
  stall_detected: "Stall detected",
  model_fallback: "Model fallback",
};

export function eventLabel(eventType: string): string {
  return Object.hasOwn(EVENT_LABELS, eventType) ? (EVENT_LABELS[eventType] ?? "") : readable(eventType);
}

/** "Running → Paused", or null when the event moved no state. */
export function eventMove(event: MissionEvent): string | null {
  if (!event.oldState || !event.newState) return null;
  return `${readable(event.oldState)} → ${readable(event.newState)}`;
}

function timeOf(iso: string | null): number {
  const time = iso ? Date.parse(iso) : Number.NaN;
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}

/** Both lists merged, one row per id (the later list's row wins), newest first. */
export function mergeEvents(loaded: readonly MissionEvent[], incoming: readonly MissionEvent[]): readonly MissionEvent[] {
  const byId = new Map<string, MissionEvent>([...loaded, ...incoming].map((event) => [event.id, event]));
  return [...byId.values()].sort((a, b) => timeOf(b.createdAt) - timeOf(a.createdAt));
}

/** The detail carries the latest 50 events; older ones page from GET /events by offset. */
export const EVENTS_PAGE = 50;

const dateTime = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** "14 Oct, 10:00" in the browser's time zone; null when missing or unreadable. */
export function whenWords(iso: string | null): string | null {
  const time = timeOf(iso);
  return Number.isFinite(time) ? dateTime.format(new Date(time)) : null;
}

const numbers = new Intl.NumberFormat("en-GB");
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 });

export function tokensWords(tokens: number): string {
  return `${numbers.format(tokens)} ${tokens === 1 ? "token" : "tokens"}`;
}

export type CostFigures = { readonly tokens: string; readonly estimate: string };

/** The backend's own estimate, in US dollars as it reckons it. */
export function costFigures(cost: MissionCost): CostFigures {
  return { tokens: tokensWords(cost.totalTokens), estimate: `about ${money.format(cost.estimatedCost)}` };
}

const MISSION_ID = /^[A-Za-z0-9_-]{1,128}$/;

/** The page's id segment: anything else is no Mission at all. */
export function isMissionId(id: string): boolean {
  return MISSION_ID.test(id);
}
