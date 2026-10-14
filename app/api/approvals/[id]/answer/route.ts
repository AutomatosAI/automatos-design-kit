import { ANSWER_FIELDS, type BoardContext, forwardApproval, keepFields } from "@/lib/server/board";

// {answer_text?, option?}: the only way to complete a question.

export async function POST(request: Request, context: BoardContext): Promise<Response> {
  return forwardApproval(request, context, { suffix: "/answer", jsonBody: true, checkBody: keepFields(ANSWER_FIELDS) });
}
