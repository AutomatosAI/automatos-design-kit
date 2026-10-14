import { forwardToBackend } from "@/lib/server/forward";

// The backend's list lives at /api/agents/ (trailing slash). Without
// include_workspace_system=true, Auto is left out (agents-playbooks.md).

export async function GET(request: Request): Promise<Response> {
  return forwardToBackend(request, {
    path: "/api/agents/",
    query: ["include_workspace_system", "limit", "skip", "status", "search"],
  });
}
