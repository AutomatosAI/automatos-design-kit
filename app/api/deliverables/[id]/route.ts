import { forwardToBackend, invalidId, pathId } from "@/lib/server/forward";

// include_content=true rides on the query string.

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context): Promise<Response> {
  const id = pathId((await context.params).id);
  if (!id) return invalidId();
  return forwardToBackend(request, { path: `/api/deliverables/${id}`, query: ["include_content"] });
}
