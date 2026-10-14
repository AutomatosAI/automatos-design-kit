import { forwardMission, type MissionContext } from "@/lib/server/missions";

// {notes?}, {} for none. Only from failed, a limited number of times.

export async function POST(request: Request, context: MissionContext): Promise<Response> {
  return forwardMission(request, context, { suffix: "/replan", jsonBody: true });
}
