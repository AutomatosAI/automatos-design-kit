import { type BoardContext, forwardTask } from "@/lib/server/board";

// The backend takes no body here. In the local edition, Run now counts as the owner's approval.

export async function POST(request: Request, context: BoardContext): Promise<Response> {
  return forwardTask(request, context, { suffix: "/run-now" });
}
