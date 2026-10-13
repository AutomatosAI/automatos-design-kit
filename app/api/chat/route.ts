import { forwardToBackend } from "@/lib/server/forward";

// The chat turn streams as text/plain lines (chat-stream.md). forwardToBackend hands
// the backend body to the browser as-is, so streaming survives.

export async function POST(request: Request): Promise<Response> {
  return forwardToBackend(request, { path: "/api/chat", jsonBody: true, accept: "text/plain" });
}
