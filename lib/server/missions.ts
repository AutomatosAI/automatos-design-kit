import { forwardToBackend, invalidId, pathId } from "@/lib/server/forward";

// The Mission routes under /api/missions/[id] (missions.md). Each checks the id before
// it touches a backend path, then forwards through the one proxy helper.

export type MissionContext = { params: Promise<{ id: string }> };

export type MissionForward = {
  /** What follows /api/missions/{id}: "" for the Mission itself, "/events", "/approve"… */
  readonly suffix: string;
  readonly query?: readonly string[];
  readonly jsonBody?: boolean;
};

export async function forwardMission(
  request: Request,
  context: MissionContext,
  { suffix, query, jsonBody }: MissionForward,
): Promise<Response> {
  const id = pathId((await context.params).id);
  if (!id) return invalidId();
  return forwardToBackend(request, { path: `/api/missions/${id}${suffix}`, query, jsonBody });
}
