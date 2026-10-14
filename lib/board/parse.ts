import type { BoardTask, TaskAgent } from "@/lib/board/types";
import { count, idOf, isRecord, listOf, text } from "@/lib/client/types";

// The board's answers (board-analytics.md) as BoardTask, camelCase. Untrusted: a row
// without a whole-number id or a title is dropped, anything else of the wrong type
// becomes null (or empty).

export type TaskList = {
  readonly tasks: readonly BoardTask[];
  readonly total: number;
};

function wholeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function parseAgent(value: unknown): TaskAgent | null {
  if (!isRecord(value)) return null;
  const id = wholeNumber(value.id);
  const name = text(value.name);
  return id !== null && name ? { id, name, icon: text(value.agent_icon) } : null;
}

function tagsOf(value: unknown): readonly string[] {
  return listOf(value, (tag) => (typeof tag === "string" && tag.trim() !== "" ? tag : null));
}

export function parseBoardTask(value: unknown): BoardTask | null {
  if (!isRecord(value)) return null;
  const id = wholeNumber(value.id);
  const title = text(value.title);
  const status = text(value.status);
  if (id === null || title === null || !status) return null;
  return {
    id,
    number: text(value.number),
    title,
    description: text(value.description),
    status,
    priority: text(value.priority),
    assignedAgentId: wholeNumber(value.assigned_agent_id),
    agent: parseAgent(value.agent),
    tags: tagsOf(value.tags),
    result: text(value.result),
    errorMessage: text(value.error_message),
    blockedReason: text(value.blocked_reason),
    blockedCode: text(value.blocked_code),
    reviewReason: text(value.review_reason),
    timesSentBack: count(value.times_sent_back, 0),
    parentTaskId: wholeNumber(value.parent_task_id),
    sourceType: text(value.source_type),
    sourceId: idOf(value.source_id),
    orchestrationRunId: idOf(value.orchestration_run_id),
    leaseUntil: text(value.lease_until),
    startedAt: text(value.started_at),
    completedAt: text(value.completed_at),
    createdAt: text(value.created_at),
    updatedAt: text(value.updated_at),
  };
}

/** GET /api/v1/tasks: {tasks, total}. */
export function parseTaskList(value: unknown): TaskList {
  if (!isRecord(value)) return { tasks: [], total: 0 };
  const tasks = listOf(value.tasks, parseBoardTask);
  return { tasks, total: count(value.total, tasks.length) };
}
