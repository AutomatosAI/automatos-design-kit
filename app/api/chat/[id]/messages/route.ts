import { forwardToBackend, invalidId, pathId } from "@/lib/server/forward";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context): Promise<Response> {
  const id = pathId((await context.params).id);
  if (!id) return invalidId();
  return forwardToBackend(request, { path: `/api/chat/${id}/messages` });
}
