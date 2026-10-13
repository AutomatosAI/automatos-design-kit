import { forwardToBackend } from "@/lib/server/forward";

// The browser calls this once at start-up and sends the id as X-Workspace-ID from then on.

export async function GET(request: Request): Promise<Response> {
  return forwardToBackend(request, { path: "/api/workspaces/current" });
}
