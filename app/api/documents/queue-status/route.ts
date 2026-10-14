import { forwardToBackend } from "@/lib/server/forward";

// The processing queue for the whole workspace. Its "completed" means processed.

export async function GET(request: Request): Promise<Response> {
  return forwardToBackend(request, { path: "/api/documents/queue/status" });
}
