import { forwardToBackend } from "@/lib/server/forward";

// The list filters in endpoints.md ride on the query string.
const FILTERS = [
  "artifact_type",
  "source_type",
  "source_type_exclude",
  "source_id",
  "agent_id",
  "date_from",
  "date_to",
  "search",
  "tag",
  "limit",
  "offset",
] as const;

export async function GET(request: Request): Promise<Response> {
  return forwardToBackend(request, { path: "/api/deliverables", query: FILTERS });
}
