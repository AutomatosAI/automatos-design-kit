import { forwardMission, type MissionContext } from "@/lib/server/missions";

// Newest first, paged with offset (there is no cursor).

export async function GET(request: Request, context: MissionContext): Promise<Response> {
  return forwardMission(request, context, { suffix: "/events", query: ["event_type", "limit", "offset"] });
}
