import { forwardToBackend, invalidId, pathId } from "@/lib/server/forward";

// The PNG passes through as bytes with the backend's content-type; 404 means no thumbnail.

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context): Promise<Response> {
  const id = pathId((await context.params).id);
  if (!id) return invalidId();
  return forwardToBackend(request, { path: `/api/deliverables/${id}/thumbnail`, accept: "image/*" });
}
