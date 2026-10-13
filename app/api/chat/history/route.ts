import { forwardToBackend } from "@/lib/server/forward";

export async function GET(request: Request): Promise<Response> {
  return forwardToBackend(request, { path: "/api/chat/history", query: ["limit"] });
}
