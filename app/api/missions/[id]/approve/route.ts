import { forwardMission, type MissionContext } from "@/lib/server/missions";

// {note?}. The client always sends an object, {} when there is no note.

export async function POST(request: Request, context: MissionContext): Promise<Response> {
  return forwardMission(request, context, { suffix: "/approve", jsonBody: true });
}
