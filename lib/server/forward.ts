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
const FALLBACK_CONTENT_TYPE = "application/octet-stream";
// Play reads these answers with fetch(). Opened directly in a tab, backend or model
// content (HTML, SVG) must not run on Play's origin.
const SAFE_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; sandbox",
} as const;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const NOT_AN_OBJECT = "The message must be a JSON object";

export type BodyCheck =
  | { readonly ok: true; readonly value: Readonly<Record<string, unknown>> }
  | { readonly ok: false; readonly error: string };

type ForwardBody =
  | { readonly ok: true; readonly value: Readonly<Record<string, unknown>> | null }
  | { readonly ok: false; readonly error: string };

export type ForwardOptions = {
  /**
   * Backend path, e.g. "/api/chat/history". Build ids in with pathId. It carries a query
   * string only when the route built it itself (then leave `query` out).
   */
  readonly path: string;
  /**
   * The query parameters this route forwards, in the order the browser sent them.
   * Default: none. An allowlist, because the backend reads ?workspace_id= when no
   * X-Workspace-ID header is sent.
   */
  readonly query?: readonly string[];
  /** Read the request body as a JSON object and forward it. Default: no body is sent. */
  readonly jsonBody?: boolean;
  /**
   * With jsonBody: checks the object and says what to forward, or the sentence to refuse
   * it with (400). Default: the object is forwarded as it came.
   */
  readonly checkBody?: (body: Readonly<Record<string, unknown>>) => BodyCheck;
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

/** The body to forward: none, the JSON object as sent, or what checkBody kept. */
async function forwardBody(request: Request, options: ForwardOptions): Promise<ForwardBody> {
  if (!options.jsonBody) return { ok: true, value: null };
  const body = await readJsonObject(request);
  if (!body.ok) return { ok: false, error: NOT_AN_OBJECT };
  return options.checkBody ? options.checkBody(body.value) : body;
}

export async function forwardToBackend(request: Request, options: ForwardOptions): Promise<Response> {
  const refused = rejectCrossSite(request);
  if (refused) return refused;

  const workspace = workspaceHeader(request);
  if (!workspace.ok) return jsonError(400, "The workspace id is not valid");

  const body = await forwardBody(request, options);
  if (!body.ok) return jsonError(400, body.error);

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
    ...(body.value ? { "Content-Type": "application/json" } : {}),
    ...workspace.headers,
  };

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: body.value ? JSON.stringify(body.value) : undefined,
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
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? FALLBACK_CONTENT_TYPE,
      "Cache-Control": upstream.headers.get("cache-control") ?? NO_CACHE,
      "X-Accel-Buffering": "no",
      ...SAFE_HEADERS,
    },
  });
}
