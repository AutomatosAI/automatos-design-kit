import { type BoardContext, forwardTask, keepFields, TASK_EDIT_FIELDS } from "@/lib/server/board";

// GET: one Task, with its cost block. PATCH: an edit of title, description, priority,
// assigned_agent_id, tags, or a note ({note} is a comment); any other field (a status
// above all) is dropped here. DELETE: the Task.

export async function GET(request: Request, context: BoardContext): Promise<Response> {
  return forwardTask(request, context, { suffix: "" });
}

export async function PATCH(request: Request, context: BoardContext): Promise<Response> {
  return forwardTask(request, context, { suffix: "", jsonBody: true, checkBody: keepFields(TASK_EDIT_FIELDS) });
}

export async function DELETE(request: Request, context: BoardContext): Promise<Response> {
  return forwardTask(request, context, { suffix: "" });
}
