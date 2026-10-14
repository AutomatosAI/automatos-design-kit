import { forwardMission, type MissionContext } from "@/lib/server/missions";

// {additional_tokens?, additional_cost?}, {} for a plain resume. Also retries a failed Mission.

export async function POST(request: Request, context: MissionContext): Promise<Response> {
  return forwardMission(request, context, { suffix: "/resume", jsonBody: true });
}
