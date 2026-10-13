import { forwardToBackend, invalidId, pathId } from "@/lib/server/forward";

// Stops the running turn. The backend takes no body here.

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context): Promise<Response> {
  const id = pathId((await context.params).id);
  if (!id) return invalidId();
  return forwardToBackend(request, { path: `/api/chat/${id}/cancel` });
}
