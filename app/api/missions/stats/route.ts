import { forwardToBackend } from "@/lib/server/forward";

// period = 7d, 30d, 90d or all.

export async function GET(request: Request): Promise<Response> {
  return forwardToBackend(request, { path: "/api/missions/stats", query: ["period"] });
}
