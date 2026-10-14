import type { StateTone } from "@/components/page/StateChip";
import { BOARD_COLUMNS, type BoardColumn, type BoardTask, isBoardColumn, isBoardStatus, STATUS_LABELS } from "@/lib/board/types";

// The board page's words and grouping (B-003), pure. Columns hold the six main states;
// everything else (Failed, Cancelled, Closed, a state this file doesn't know) goes in
// the collapsed Other column. The Review and Blocked reasons are Studio's own words
// (frontend/components/activity/board/ticket-stage.ts), from the core's codes
// (core/services/ticket_reasons.py).

export type BoardGroups = {
  readonly columns: Readonly<Record<BoardColumn, readonly BoardTask[]>>;
  readonly other: readonly BoardTask[];
};

/** The Tasks by column, in the list's own order (newest open first). */
export function groupTasks(tasks: readonly BoardTask[]): BoardGroups {
  const columns = Object.fromEntries(
    BOARD_COLUMNS.map((column) => [column, tasks.filter((task) => task.status === column)]),
  ) as Record<BoardColumn, readonly BoardTask[]>;
  return { columns, other: tasks.filter((task) => !isBoardColumn(task.status)) };
}

/** "Failed", or the backend's own word for a state Play doesn't know. */
export function statusLabel(status: string): string {
  return isBoardStatus(status) ? STATUS_LABELS[status] : status.replace(/_/g, " ");
}

export const PRIORITIES = ["urgent", "high", "medium", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];
export const DEFAULT_PRIORITY: Priority = "medium";

const PRIORITY_LABELS: Readonly<Record<Priority, string>> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function priorityLabel(priority: string | null): string | null {
  if (!priority) return null;
  return (PRIORITIES as readonly string[]).includes(priority) ? PRIORITY_LABELS[priority as Priority] : priority;
}

export type StageReason = {
  readonly tone: StateTone;
  /** The chip's word ("Question", "Plan to approve"). */
  readonly label: string;
  /** The sentence behind it (a tooltip on the card, the drawer's line). */
  readonly says: string;
};

const REVIEW_REASONS: Readonly<Record<string, StageReason>> = {
  mission_checking: { tone: "running", label: "Mission checking", says: "Its Mission is checking this step. Nothing here needs you." },
  mission_plan: { tone: "needs-you", label: "Plan to approve", says: "Its Mission waits for you to approve its plan." },
  file_missing: { tone: "needs-you", label: "File missing", says: "The file it named is not in the workspace. Check the result before you approve it." },
  nothing_done: { tone: "needs-you", label: "Did nothing", says: "It finished without doing anything: its tool calls were skipped, or the result is empty." },
  says_not_done: { tone: "needs-you", label: "Says not done", says: "Its own answer says the work is not done." },
  held_command: { tone: "needs-you", label: "Command refused", says: "A held command was refused, so the result was not checked end to end." },
  retries_used_up: { tone: "needs-you", label: "Out of retries", says: "It ran out of attempts. Whatever it produced is on the Task." },
  approval_action: { tone: "needs-you", label: "Your OK", says: "It is ready and waits for your OK to run its action." },
  stopped_with_work: { tone: "needs-you", label: "Stopped part-way", says: "The Playbook stopped after part of the work. What it finished is here." },
  moved_by_you: { tone: "needs-you", label: "Moved by you", says: "You moved it to Review." },
  asked: { tone: "needs-you", label: "You asked", says: "You asked to review it before it closes." },
  ends_on_a_question: { tone: "needs-you", label: "Question for you", says: "It ends on a question for you. Approve to close it, or Reject with your answer to run it again." },
};
const REVIEW_UNEXPLAINED: StageReason = { tone: "needs-you", label: "Review", says: "Waiting for your verdict." };

const BLOCKED_REASONS: Readonly<Record<string, StageReason>> = {
  question: { tone: "needs-you", label: "Question", says: "Waiting for your answer to its question." },
  approval: { tone: "needs-you", label: "Approval", says: "Waiting for your approval before it runs." },
  owner_check: { tone: "needs-you", label: "Your check", says: "Its Mission waits for you to check a step." },
  spend_ceiling: { tone: "paused", label: "Spend ceiling", says: "Held: this window's spend is over its ceiling. It goes back to Assigned on its own when the ceiling is raised or the window rolls over." },
  mission_paused: { tone: "paused", label: "Mission paused", says: "Its Mission is paused. Resume it from the Mission." },
  step_failed: { tone: "failed", label: "Step failed", says: "This step failed. Its Mission decides what happens next." },
  stopped_by_you: { tone: "paused", label: "Stopped by you", says: "You stopped it. Move it to In progress, or use Run now, to start it again." },
};
const BLOCKED_WAITING: StageReason = { tone: "paused", label: "Blocked", says: "Waiting: see the reason on the Task." };

/** Why a Task waits in Review or Blocked, as a chip; null in any other column. */
export function stageReason(task: Pick<BoardTask, "status" | "reviewReason" | "blockedCode">): StageReason | null {
  if (task.status === "review") return REVIEW_REASONS[task.reviewReason ?? ""] ?? REVIEW_UNEXPLAINED;
  if (task.status === "blocked") return BLOCKED_REASONS[task.blockedCode ?? ""] ?? BLOCKED_WAITING;
  return null;
}

/** "3 Tasks", "1 Task". */
export function taskCount(total: number): string {
  return `${total} ${total === 1 ? "Task" : "Tasks"}`;
}

export type NewTask = {
  readonly title: string;
  readonly description: string;
  /** "" for no agent (the Task waits in the Inbox). */
  readonly agentId: string;
  readonly priority: Priority;
};

export const EMPTY_NEW_TASK: NewTask = { title: "", description: "", agentId: "", priority: DEFAULT_PRIORITY };

/** What POST /api/tasks creates (lib/client/board.ts sends it snake_case). */
export type TaskCreate = {
  readonly title: string;
  readonly description?: string;
  readonly assignedAgentId?: number;
  readonly priority?: Priority;
};

/** The draft as a new Task; null while the title is empty. */
export function newTaskOf(draft: NewTask): TaskCreate | null {
  const title = draft.title.trim();
  if (!title) return null;
  const description = draft.description.trim();
  const agentId = Number(draft.agentId);
  return {
    title,
    priority: draft.priority,
    ...(description ? { description } : {}),
    ...(draft.agentId !== "" && Number.isInteger(agentId) && agentId > 0 ? { assignedAgentId: agentId } : {}),
  };
}
