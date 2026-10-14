import { type BoardContext, forwardTask } from "@/lib/server/board";

// The backend takes no body here. It stops a running Task too.

export async function POST(request: Request, context: BoardContext): Promise<Response> {
  return forwardTask(request, context, { suffix: "/cancel" });
}
