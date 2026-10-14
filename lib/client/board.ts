import type { TaskCreate } from "@/lib/board/board";
import { parseBoardTask, parseTaskList, type TaskList } from "@/lib/board/parse";
import { type BoardColumn, type BoardTask, FINISHED_LIMIT } from "@/lib/board/types";
import { ApiError, failure, type Transport } from "@/lib/client/transport";

// The board's calls (board-analytics.md), through Play's /api/tasks routes: the live
// stream, the list, a new Task, its moves and the Review decisions. A refused move
// throws an ApiError carrying the backend's own sentence (its 409 detail).

const STREAM_PATH = "/api/tasks/stream";
const TASKS_PATH = "/api/tasks";

export function taskPath(id: number, suffix = ""): string {
  return `${TASKS_PATH}/${encodeURIComponent(String(id))}${suffix}`;
}

function readTask(body: unknown): BoardTask {
  const parsed = parseBoardTask(body);
  if (!parsed) throw new ApiError(200, "Automatos sent a Task Play can't read");
  return parsed;
}

function createBody(task: TaskCreate): Readonly<Record<string, string | number>> {
  return {
    title: task.title,
    ...(task.description ? { description: task.description } : {}),
    ...(task.assignedAgentId !== undefined ? { assigned_agent_id: task.assignedAgentId } : {}),
    ...(task.priority ? { priority: task.priority } : {}),
  };
}

export function boardEndpoints({ call, callJson }: Transport) {
  async function post(path: string, body: Readonly<Record<string, unknown>> = {}): Promise<void> {
    const response = await call(path, { method: "POST", body: JSON.stringify(body) });
    if (!response.ok) throw await failure(response, path);
  }

  return {
    /** The live board stream, open; the caller reads response.body (lib/board/live.ts). */
    async openBoardStream(signal?: AbortSignal): Promise<Response> {
      const response = await call(STREAM_PATH, { signal });
      if (!response.ok) throw await failure(response, STREAM_PATH);
      return response;
    },

    /** The board: every open Task plus the newest finished ones. */
    async listTasks(finishedLimit: number = FINISHED_LIMIT): Promise<TaskList> {
      return parseTaskList(await callJson(`${TASKS_PATH}?finished_limit=${finishedLimit}`));
    },

    async createTask(task: TaskCreate): Promise<BoardTask> {
      return readTask(await callJson(TASKS_PATH, { method: "POST", body: JSON.stringify(createBody(task)) }));
    },

    /** The drag-and-drop move (PATCH /status); the backend's refusal is the error's message. */
    async moveTask(id: number, status: BoardColumn): Promise<void> {
      const path = taskPath(id, "/status");
      const response = await call(path, { method: "PATCH", body: JSON.stringify({ status }) });
      if (!response.ok) throw await failure(response, path);
    },

    /** From Review to Done. */
    async approveTask(id: number, note?: string): Promise<void> {
      await post(taskPath(id, "/approve"), note ? { note } : {});
    },

    /** Back to its agent with what to fix. */
    async rejectTask(id: number, feedback?: string): Promise<void> {
      await post(taskPath(id, "/reject"), feedback ? { feedback } : {});
    },
  };
}
