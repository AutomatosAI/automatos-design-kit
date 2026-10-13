import {
  backendUnreachable,
  getBackendUrl,
  jsonError,
  readJsonObject,
  rejectCrossSite,
  workspaceHeader,
} from "@/lib/server/backend";

// The one forwarding helper every proxy route uses. It sends the method, the query
// parameters the route allows, the JSON body (when the route takes one) and
// X-Workspace-ID, never any other incoming header, and hands the backend body back as-is: never read, never
// buffered, so the chat stream and the thumbnail bytes both pass straight through.

const CLIENT_CLOSED = 499;
const DEFAULT_ACCEPT = "application/json";
const NO_CACHE = "no-cache, no-transform";
const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export type ForwardOptions = {
  /** Backend path without the query string, e.g. "/api/chat/history". Build ids in with pathId. */
  readonly path: string;
  /**
   * The query parameters this route forwards, in the order the browser sent them.
   * Default: none. An allowlist, because the backend reads ?workspace_id= when no
   * X-Workspace-ID header is sent.
   */
  readonly query?: readonly string[];
  /** Read the request body as a JSON object and forward it. Default: no body is sent. */
  readonly jsonBody?: boolean;
  /** What the route expects back. Default: application/json. */
  readonly accept?: string;
};

/** A route param that is safe to put in a backend path, encoded; null when it isn't. */
export function pathId(raw: string): string | null {
  return ID_PATTERN.test(raw) ? encodeURIComponent(raw) : null;
}

export function invalidId(): Response {
  return jsonError(400, "That id is not valid");
}

function forwardedSearch(request: Request, allowed: readonly string[] = []): string {
  const kept = [...new URL(request.url).searchParams].filter(([key]) => allowed.includes(key));
  return kept.length ? `?${new URLSearchParams(kept).toString()}` : "";
}

export async function forwardToBackend(request: Request, options: ForwardOptions): Promise<Response> {
  const refused = rejectCrossSite(request);
  if (refused) return refused;

  const workspace = workspaceHeader(request);
  if (!workspace.ok) return jsonError(400, "The workspace id is not valid");

  const body = options.jsonBody ? await readJsonObject(request) : null;
  if (body && !body.ok) return jsonError(400, "The message must be a JSON object");

  let backendUrl: string;
  try {
    backendUrl = getBackendUrl();
  } catch (error) {
    console.error("[proxy] bad backend config:", error);
    return jsonError(500, "Play's AUTOMATOS_BACKEND_URL setting is not a valid URL");
  }

  const target = `${backendUrl}${options.path}${forwardedSearch(request, options.query)}`;
  const headers: Record<string, string> = {
    Accept: options.accept ?? DEFAULT_ACCEPT,
    ...(body ? { "Content-Type": "application/json" } : {}),
    ...workspace.headers,
  };

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: body && body.ok ? JSON.stringify(body.value) : undefined,
      cache: "no-store",
      signal: request.signal,
    });
    return passThrough(upstream);
  } catch (error) {
    if (request.signal.aborted) return new Response(null, { status: CLIENT_CLOSED });
    console.error(`[proxy] ${request.method} ${target} failed:`, error);
    return backendUnreachable(backendUrl);
  }
}

/** The backend's status, body and content-type, unchanged. */
function passThrough(upstream: Response): Response {
  const contentType = upstream.headers.get("content-type");
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      ...(contentType ? { "Content-Type": contentType } : {}),
      "Cache-Control": upstream.headers.get("cache-control") ?? NO_CACHE,
      "X-Accel-Buffering": "no",
    },
  });
}
