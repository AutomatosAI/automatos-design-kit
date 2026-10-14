import { forwardToBackend } from "@/lib/server/forward";

// The board's live updates: server-sent events (board_changed, heartbeat comments),
// passed through unbuffered and uncompressed, chunk by chunk as the backend sends them.

export async function GET(request: Request): Promise<Response> {
  return forwardToBackend(request, { path: "/api/v1/tasks/stream", accept: "text/event-stream", stream: true });
}
