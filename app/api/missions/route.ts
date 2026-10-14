import { forwardToBackend } from "@/lib/server/forward";

// GET lists the workspace's Missions (newest first); POST starts one from a goal.

export async function GET(request: Request): Promise<Response> {
  return forwardToBackend(request, { path: "/api/missions", query: ["state", "limit", "offset"] });
}

export async function POST(request: Request): Promise<Response> {
  return forwardToBackend(request, { path: "/api/missions", jsonBody: true });
}
