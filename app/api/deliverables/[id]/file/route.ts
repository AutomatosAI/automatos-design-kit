import { rawFilePath } from "@/lib/deliverables/file";
import { jsonError } from "@/lib/server/backend";
import { forwardToBackend, invalidId, pathId } from "@/lib/server/forward";

// A Deliverable's bytes (an image to show, a file to download). The browser names only
// the Deliverable: the file path comes from the backend's own row, so this route can't
// be pointed at any other workspace file. The bytes pass through with the backend's
// content-type and the proxy's nosniff + sandbox headers.

type Context = { params: Promise<{ id: string }> };

const NO_FILE = "This Deliverable has no file Play can open";

async function previewUrlOf(answer: Response): Promise<string | null> {
  const body: unknown = await answer.json().catch((error: unknown) => {
    console.error("[proxy] the Deliverable answer is not JSON:", error);
    return null;
  });
  if (typeof body !== "object" || body === null || !("deliverable" in body)) return null;
  const { deliverable } = body;
  if (typeof deliverable !== "object" || deliverable === null || !("preview_url" in deliverable)) return null;
  return typeof deliverable.preview_url === "string" ? deliverable.preview_url : null;
}

export async function GET(request: Request, context: Context): Promise<Response> {
  const id = pathId((await context.params).id);
  if (!id) return invalidId();

  const row = await forwardToBackend(request, { path: `/api/deliverables/${id}` });
  if (!row.ok) return row;

  const filePath = rawFilePath(await previewUrlOf(row));
  if (!filePath) return jsonError(404, NO_FILE);
  return forwardToBackend(request, { path: filePath, accept: "*/*" });
}
