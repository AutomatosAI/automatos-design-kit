import {
  backendUnreachable,
  getBackendUrl,
  jsonError,
  readJsonObject,
  rejectCrossSite,
  workspaceHeader,
} from "@/lib/server/backend";

// The chat turn streams as text/plain lines (chat-stream.md). The backend body is
// handed to the browser as-is: never read, never buffered, so streaming survives.

const CLIENT_CLOSED = 499;
const FALLBACK_CONTENT_TYPE = "text/plain; charset=utf-8";

export async function POST(request: Request): Promise<Response> {
  const refused = rejectCrossSite(request);
  if (refused) return refused;

  const workspace = workspaceHeader(request);
  if (!workspace.ok) return jsonError(400, "The workspace id is not valid");

  const body = await readJsonObject(request);
  if (!body.ok) return jsonError(400, "The message must be a JSON object");

  let backendUrl: string;
  try {
    backendUrl = getBackendUrl();
  } catch (error) {
    console.error("[proxy] bad backend config:", error);
    return jsonError(500, "Play's AUTOMATOS_BACKEND_URL setting is not a valid URL");
  }

  try {
    const upstream = await fetch(`${backendUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/plain", ...workspace.headers },
      body: JSON.stringify(body.value),
      cache: "no-store",
      signal: request.signal,
    });
    return streamThrough(upstream);
  } catch (error) {
    if (request.signal.aborted) return new Response(null, { status: CLIENT_CLOSED });
    console.error(`[proxy] POST ${backendUrl}/api/chat failed:`, error);
    return backendUnreachable(backendUrl);
  }
}

function streamThrough(upstream: Response): Response {
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? FALLBACK_CONTENT_TYPE,
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
