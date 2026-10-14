import { forwardMission, type MissionContext } from "@/lib/server/missions";

export async function GET(request: Request, context: MissionContext): Promise<Response> {
  return forwardMission(request, context, { suffix: "/cost" });
}
