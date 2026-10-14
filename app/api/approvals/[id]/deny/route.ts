import { type BoardContext, forwardApproval } from "@/lib/server/board";

// Deny an approval, or dismiss a question (it stays unanswered). The backend takes no body here.

export async function POST(request: Request, context: BoardContext): Promise<Response> {
  return forwardApproval(request, context, { suffix: "/deny" });
}
