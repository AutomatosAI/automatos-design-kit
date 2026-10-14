import { forwardMission, type MissionContext } from "@/lib/server/missions";

// {reason}, required.

export async function POST(request: Request, context: MissionContext): Promise<Response> {
  return forwardMission(request, context, { suffix: "/reject", jsonBody: true });
}
