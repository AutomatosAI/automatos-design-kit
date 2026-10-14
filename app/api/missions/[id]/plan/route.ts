import { forwardMission, type MissionContext } from "@/lib/server/missions";

// {task_edits: [...]}, only while the Mission is awaiting approval.

export async function PATCH(request: Request, context: MissionContext): Promise<Response> {
  return forwardMission(request, context, { suffix: "/plan", jsonBody: true });
}
