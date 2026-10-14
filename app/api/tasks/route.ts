import { keepFields, TASK_CREATE_FIELDS, TASK_LIST_QUERY } from "@/lib/server/board";
import { forwardToBackend } from "@/lib/server/forward";

// GET: the board's Tasks ({tasks, total}); with finished_limit, every open Task plus that
// many finished ones. POST: a new Task, {title, description?, assigned_agent_id?,
// priority?, tags?}; any other field is dropped here.

export async function GET(request: Request): Promise<Response> {
  return forwardToBackend(request, { path: "/api/v1/tasks", query: TASK_LIST_QUERY });
}

export async function POST(request: Request): Promise<Response> {
  return forwardToBackend(request, {
    path: "/api/v1/tasks",
    jsonBody: true,
    checkBody: keepFields(TASK_CREATE_FIELDS),
  });
}
