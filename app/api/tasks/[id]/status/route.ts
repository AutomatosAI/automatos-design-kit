import { type BoardContext, forwardTask, keepFields, TASK_STATUS_FIELDS } from "@/lib/server/board";

// {status, blocked_reason?}: the board's move. The backend keeps the move rules and
// answers 409 with the reason when it refuses (lib/board/moves.ts mirrors them).

export async function PATCH(request: Request, context: BoardContext): Promise<Response> {
  return forwardTask(request, context, { suffix: "/status", jsonBody: true, checkBody: keepFields(TASK_STATUS_FIELDS) });
}
