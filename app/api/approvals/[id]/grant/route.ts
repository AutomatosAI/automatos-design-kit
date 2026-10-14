import { type BoardContext, forwardApproval } from "@/lib/server/board";

// Allow an approval. The backend takes no body here; a question is answered, never granted.

export async function POST(request: Request, context: BoardContext): Promise<Response> {
  return forwardApproval(request, context, { suffix: "/grant" });
}
