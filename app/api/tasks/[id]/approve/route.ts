import { APPROVE_FIELDS, type BoardContext, forwardTask, keepFields } from "@/lib/server/board";

// {note?}, {} for none. Only from review; it moves the Task to done.

export async function POST(request: Request, context: BoardContext): Promise<Response> {
  return forwardTask(request, context, { suffix: "/approve", jsonBody: true, checkBody: keepFields(APPROVE_FIELDS) });
}
