import { isTaskId } from "@/lib/board/types";
import { type BodyCheck, forwardToBackend, invalidId } from "@/lib/server/forward";

// The board's routes under /api/tasks and /api/approvals (board-analytics.md). Task and
// approval grant ids are integers in the core, checked before they touch a path. Every
// body is cut down to the fields its backend route documents: an edit can't carry a
// status (a move goes through /status, where the move rules hold), and a new Task can't
// claim a source_type (the backend uses "user" when it is left out).

export type BoardContext = { params: Promise<{ id: string }> };

export type BoardForward = {
  /** What follows the id: "" for the Task itself, "/status", "/approve", "/grant"… */
  readonly suffix: string;
  readonly jsonBody?: boolean;
  readonly checkBody?: (body: Readonly<Record<string, unknown>>) => BodyCheck;
};

/** What the Task list forwards (board_tasks.py list_tasks). */
export const TASK_LIST_QUERY = ["status", "agent_id", "priority", "search", "limit", "offset", "finished_limit"] as const;

/** What the approvals list forwards (approval_grants.py list_grants). */
export const APPROVAL_LIST_QUERY = ["status", "kind"] as const;

export const TASK_EDIT_FIELDS = ["title", "description", "priority", "assigned_agent_id", "tags", "note"] as const;
export const TASK_CREATE_FIELDS = ["title", "description", "assigned_agent_id", "priority", "tags"] as const;
export const TASK_STATUS_FIELDS = ["status", "blocked_reason"] as const;
export const APPROVE_FIELDS = ["note"] as const;
export const REJECT_FIELDS = ["feedback"] as const;
export const ANSWER_FIELDS = ["answer_text", "option"] as const;

/** A body check that keeps only `fields` and drops the rest; the backend judges the values. */
export function keepFields(fields: readonly string[]): (body: Readonly<Record<string, unknown>>) => BodyCheck {
  return (body) => ({
    ok: true,
    value: Object.fromEntries(fields.flatMap((field) => (field in body ? [[field, body[field]] as const] : []))),
  });
}

/** The id as a backend path segment, or null when it isn't a whole number. */
export function boardPathId(raw: string): string | null {
  return isTaskId(raw) ? raw : null;
}

async function forwardById(
  request: Request,
  context: BoardContext,
  base: string,
  { suffix, ...rest }: BoardForward,
): Promise<Response> {
  const id = boardPathId((await context.params).id);
  if (!id) return invalidId();
  return forwardToBackend(request, { path: `${base}/${id}${suffix}`, ...rest });
}

export function forwardTask(request: Request, context: BoardContext, options: BoardForward): Promise<Response> {
  return forwardById(request, context, "/api/v1/tasks", options);
}

export function forwardApproval(request: Request, context: BoardContext, options: BoardForward): Promise<Response> {
  return forwardById(request, context, "/api/v1/approval-grants", options);
}
