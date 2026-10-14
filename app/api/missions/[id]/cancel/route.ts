import { forwardMission, type MissionContext } from "@/lib/server/missions";

// The backend takes no body here.

export async function POST(request: Request, context: MissionContext): Promise<Response> {
  return forwardMission(request, context, { suffix: "/cancel" });
}
