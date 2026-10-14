import { APPROVAL_LIST_QUERY } from "@/lib/server/board";
import { forwardToBackend } from "@/lib/server/forward";

// What waits on the owner: ?status=pending, and kind approval or question ({grants}).

export async function GET(request: Request): Promise<Response> {
  return forwardToBackend(request, { path: "/api/v1/approval-grants", query: APPROVAL_LIST_QUERY });
}
