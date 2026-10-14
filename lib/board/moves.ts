import {
  BLOCKED_ON_QUESTION,
  BOARD_COLUMNS,
  type BoardColumn,
  type BoardTask,
  isBoardStatus,
  MISSION_PLAN_WAITS,
  MISSION_SOURCE_TYPES,
  STATUS_LABELS,
} from "@/lib/board/types";

// The board's move rules, mirroring the core's board_drag_rules.py (drag_refusal,
// move_refusal) and the start path in api/board_tasks.py (board-analytics.md). The
// backend enforces them; the board disables a refused drop target and shows this
// sentence, and still shows the backend's own message if it refuses anyway.

/** The Task fields the rules read. */
export type MoveTask = Pick<
  BoardTask,
  "status" | "assignedAgentId" | "result" | "sourceType" | "sourceId" | "leaseUntil" | "blockedCode" | "reviewReason"
>;

export const MOVE_REFUSALS = {
  notAColumn: "That isn't a column on the board.",
  useApprove: "Use Approve: a move to Done would skip its approval.",
  useReject: "Use Reject: it sends the agent what to fix.",
  noAgent: "Assign an agent first: a Task with no agent can't be in progress.",
  missionRunsIt: "Its Mission runs it, not the board: start or change it from the Mission.",
  missionNoResult: "It has no result yet, so there is nothing to check: its Mission runs it.",
  running: "It's running: wait for its result, or use Cancel to stop it first.",
  failedNoResult: "Its run failed and left nothing to check: use Run now to try again, or Cancel it.",
  notStarted: "No one has worked on it yet, so there is nothing to check: run it first, or Cancel it.",
  noResult: "It has nothing to check yet: use Run now, or Cancel it.",
  answerFirst: "It's waiting for your answer to its question: answer it, and the answer starts it again.",
} as const;

// Moves whose decision has its own button.
const DECISION_MOVES: Readonly<Record<string, string>> = {
  "review>done": MOVE_REFUSALS.useApprove,
  "review>assigned": MOVE_REFUSALS.useReject,
};
// Where a Task whose run is still going may go: Cancelled stops the run.
const WHILE_RUNNING: ReadonlySet<string> = new Set(["in_progress", "cancelled"]);
// Columns that hold finished work, so the Task must carry some.
const NEEDS_A_RESULT: ReadonlySet<string> = new Set(["done", "review"]);
const NOT_STARTED: ReadonlySet<string> = new Set(["inbox", "assigned"]);
// Statuses that start work: the board never moves a Mission's Task into them.
const STARTING: ReadonlySet<string> = new Set(["assigned", "in_progress"]);
// A Mission step the Mission engine holds: it has no board lease, but a run holds it.
const ENGINE_RUN_STEPS: ReadonlySet<string> = new Set(["orchestration", "orchestration_task"]);
const PLAYBOOK_CARD = "recipe";
const PLAYBOOK_STEP_PREFIX = "recipe:";

export function isMissionTask(task: Pick<BoardTask, "sourceType">): boolean {
  return task.sourceType !== null && MISSION_SOURCE_TYPES.includes(task.sourceType);
}

/** A Playbook run's own card: no agent by design, and a start runs its Playbook again. */
export function isPlaybookCard(task: Pick<BoardTask, "sourceType" | "sourceId">): boolean {
  const sourceId = task.sourceId ?? "";
  return task.sourceType === PLAYBOOK_CARD && sourceId !== "" && !sourceId.startsWith(PLAYBOOK_STEP_PREFIX);
}

/** Whether a run really holds the Task: in progress with a live lease (or a Mission step). */
export function isRunning(task: Pick<BoardTask, "status" | "sourceType" | "leaseUntil">, now: Date): boolean {
  if (task.status !== "in_progress") return false;
  if (task.sourceType !== null && ENGINE_RUN_STEPS.has(task.sourceType)) return true;
  const lease = task.leaseUntil ? Date.parse(task.leaseUntil) : Number.NaN;
  return Number.isFinite(lease) && lease > now.getTime();
}

function hasResult(task: MoveTask): boolean {
  return (task.result ?? "").trim() !== "";
}

/** A Mission's Task: it needs a result for Done/Review, and only its waiting plan card starts by hand. */
function missionRefusal(task: MoveTask, to: string): string | null {
  if (NEEDS_A_RESULT.has(to)) return hasResult(task) ? null : MOVE_REFUSALS.missionNoResult;
  const approvesItsPlan = to === "in_progress" && task.sourceType === "orchestration"
    && task.reviewReason === MISSION_PLAN_WAITS;
  return STARTING.has(to) && !approvesItsPlan ? MOVE_REFUSALS.missionRunsIt : null;
}

function nothingToCheck(task: MoveTask): string {
  if (task.status === "failed") return MOVE_REFUSALS.failedNoResult;
  if (NOT_STARTED.has(task.status)) return MOVE_REFUSALS.notStarted;
  return MOVE_REFUSALS.noResult;
}

/** The rules every move of a Task that isn't a Mission's keeps. */
function boardRefusal(task: MoveTask, to: string, now: Date): string | null {
  if (to === "in_progress" && !task.assignedAgentId && !isPlaybookCard(task)) return MOVE_REFUSALS.noAgent;
  if (isRunning(task, now) && !WHILE_RUNNING.has(to)) return MOVE_REFUSALS.running;
  if (NEEDS_A_RESULT.has(to) && !hasResult(task)) return nothingToCheck(task);
  if (to === "in_progress" && task.blockedCode === BLOCKED_ON_QUESTION) return MOVE_REFUSALS.answerFirst;
  return null;
}

/**
 * Why the board refuses to move `task` to `to`, as a sentence naming what to do instead;
 * null when the move goes ahead. Moving a Task to its own column is refused too.
 */
export function moveRefusal(task: MoveTask, to: string, now: Date = new Date()): string | null {
  if (!isBoardStatus(to)) return MOVE_REFUSALS.notAColumn;
  if (to === task.status) return `It's already in ${STATUS_LABELS[to]}.`;
  const decision = DECISION_MOVES[`${task.status}>${to}`];
  if (decision) return decision;
  return isMissionTask(task) ? missionRefusal(task, to) : boardRefusal(task, to, now);
}

export type ColumnMove = { readonly column: BoardColumn; readonly refusal: string | null };

/** Every other column with why it is refused (null when allowed): drop targets and "Move to…". */
export function columnMoves(task: MoveTask, now: Date = new Date()): readonly ColumnMove[] {
  return BOARD_COLUMNS.filter((column) => column !== task.status).map((column) => ({
    column,
    refusal: moveRefusal(task, column, now),
  }));
}

/** The columns the Task may move to, in board order. */
export function allowedColumns(task: MoveTask, now: Date = new Date()): readonly BoardColumn[] {
  return columnMoves(task, now).flatMap((move) => (move.refusal === null ? [move.column] : []));
}
