import { forwardToBackend } from "@/lib/server/forward";

// Live status for every agent in the workspace, one call (agents-playbooks.md). Polled
// every 10 s while the Agents page is visible.

export async function GET(request: Request): Promise<Response> {
  return forwardToBackend(request, { path: "/api/v1/fleet" });
}
