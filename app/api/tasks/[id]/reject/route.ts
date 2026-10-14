import { type BoardContext, forwardTask, keepFields, REJECT_FIELDS } from "@/lib/server/board";

// {feedback?}, {} for none. Sends the Task back to the same agent with what to fix.

export async function POST(request: Request, context: BoardContext): Promise<Response> {
  return forwardTask(request, context, { suffix: "/reject", jsonBody: true, checkBody: keepFields(REJECT_FIELDS) });
}
