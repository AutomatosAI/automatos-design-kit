// The Command Center board's words and shapes (board-analytics.md). A card is a Task,
// shown with its number. The backend's status stays a string on the Task: a state this
// file doesn't know still renders, with its own words.

/** The board's columns, in order. */
export const BOARD_COLUMNS = ["inbox", "assigned", "in_progress", "review", "blocked", "done"] as const;

/** States off the main columns, shown together in a collapsed "Other" column. */
export const SIDE_STATES = ["failed", "cancelled", "closed"] as const;

export type BoardColumn = (typeof BOARD_COLUMNS)[number];
export type SideState = (typeof SIDE_STATES)[number];
export type BoardStatus = BoardColumn | SideState;

export const STATUS_LABELS: Readonly<Record<BoardStatus, string>> = {
  inbox: "Inbox",
  assigned: "Assigned",
  in_progress: "In progress",
  review: "Review",
  blocked: "Blocked",
  done: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
  closed: "Closed",
};

/** Every open Task plus this many of the newest finished ones (the board's own list). */
export const FINISHED_LIMIT = 20;

/** The Task's source types that belong to a Mission: its own card and its steps. */
export const MISSION_SOURCE_TYPES: readonly string[] = ["orchestration", "orchestration_task", "mission"];

/** blocked_code when a blocked Task waits on the owner's answer to its question. */
export const BLOCKED_ON_QUESTION = "question";

/** review_reason on a Mission's own card while its plan waits for approval. */
export const MISSION_PLAN_WAITS = "mission_plan";

const STATUSES: ReadonlySet<string> = new Set<string>([...BOARD_COLUMNS, ...SIDE_STATES]);
// Task and approval grant ids are integers in the core (/{task_id:int}, /{grant_id:int}).
const WHOLE_NUMBER_ID = /^[1-9]\d{0,11}$/;

export function isBoardStatus(value: string): value is BoardStatus {
  return STATUSES.has(value);
}

export function isBoardColumn(value: string): value is BoardColumn {
  return (BOARD_COLUMNS as readonly string[]).includes(value);
}

/** The one id rule for Tasks and approval grants: pages, params and the proxy. */
export function isTaskId(raw: string): boolean {
  return WHOLE_NUMBER_ID.test(raw);
}

export type TaskAgent = {
  readonly id: number;
  readonly name: string;
  readonly icon: string | null;
};

/** A Task as the board lists it (GET /api/v1/tasks), camelCase. */
export type BoardTask = {
  readonly id: number;
  /** "#0042", or "#0051.3" for a Mission step; null on rows from before numbering. */
  readonly number: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly status: string;
  readonly priority: string | null;
  readonly assignedAgentId: number | null;
  readonly agent: TaskAgent | null;
  readonly tags: readonly string[];
  readonly result: string | null;
  readonly errorMessage: string | null;
  readonly blockedReason: string | null;
  /** What a blocked Task waits for ("question", "approval", …); null when it isn't blocked. */
  readonly blockedCode: string | null;
  /** Why a Task waits in Review; null when it isn't in Review. */
  readonly reviewReason: string | null;
  readonly timesSentBack: number;
  readonly parentTaskId: number | null;
  readonly sourceType: string | null;
  readonly sourceId: string | null;
  /** Its Mission, if any. */
  readonly orchestrationRunId: string | null;
  /** The dispatch lease a live run renews; in the future while a run holds the Task. */
  readonly leaseUntil: string | null;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
};
