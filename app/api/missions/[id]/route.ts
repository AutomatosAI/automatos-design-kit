import { forwardMission, type MissionContext } from "@/lib/server/missions";

// GET: the Mission with its tasks, recent events and task progress. DELETE: only once
// it has ended (204).

export async function GET(request: Request, context: MissionContext): Promise<Response> {
  return forwardMission(request, context, { suffix: "" });
}

export async function DELETE(request: Request, context: MissionContext): Promise<Response> {
  return forwardMission(request, context, { suffix: "" });
}
