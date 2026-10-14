// Server only. The proxy routes in app/api/* are the only code that knows where
// the Automatos backend is; components and lib/client never import this file.

export const DEFAULT_BACKEND_URL = "http://localhost:8000";
export const WORKSPACE_HEADER = "X-Workspace-ID";

const WORKSPACE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const LOCAL_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "[::1]"]);
const READ_ONLY_METHODS: ReadonlySet<string> = new Set(["GET", "HEAD"]);

export function getBackendUrl(): string {
  const raw = process.env.AUTOMATOS_BACKEND_URL?.trim() || DEFAULT_BACKEND_URL;
  const url = raw.replace(/\/+$/, "");
  if (!/^https?:\/\/[^/\s@]+(\/|$)/i.test(url)) {
    throw new Error("AUTOMATOS_BACKEND_URL must be an http(s) URL with no user or password");
  }
  return url;
}

export function jsonError(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

export function backendUnreachable(backendUrl: string): Response {
  return jsonError(502, `Automatos isn't running at ${backendUrl}`);
}

function allowedHosts(): ReadonlySet<string> {
  const extra = (process.env.PLAY_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...LOCAL_HOSTS, ...extra]);
}

/** Host without its port. A DNS-rebound attacker domain arrives with its own name here. */
function requestHostName(request: Request): string {
  const host = request.headers.get("host") ?? new URL(request.url).host;
  return host.replace(/:\d+$/, "").toLowerCase();
}

/**
 * The Host and Sec-Fetch-Site half of rejectCrossSite, on its own for the one route
 * that can't be JSON (the document upload), which brings its own custom-header guard.
 */
export function rejectOtherSites(request: Request): Response | null {
  const hostName = requestHostName(request);
  if (!allowedHosts().has(hostName)) {
    console.error(`[proxy] refused Host "${hostName}" (see PLAY_ALLOWED_HOSTS)`);
    return jsonError(403, "Open Play at http://localhost:3100");
  }
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    return jsonError(403, "Requests from other sites are not allowed");
  }
  return null;
}

/**
 * The local edition has no login, so another site must not be able to drive Auto
 * through these routes. The Host allowlist stops DNS rebinding; browsers send
 * Sec-Fetch-Site on every request; a JSON Content-Type forces a CORS preflight
 * that this app never answers. Every request that can change something (any method
 * but GET or HEAD) must carry it, even with no body: a bodyless cross-site POST
 * (pause, cancel) needs no preflight otherwise.
 */
export function rejectCrossSite(request: Request): Response | null {
  const otherSite = rejectOtherSites(request);
  if (otherSite) return otherSite;
  const type = request.headers.get("content-type") ?? "";
  const mayChange = !READ_ONLY_METHODS.has(request.method.toUpperCase());
  if ((mayChange || request.body !== null) && !/^application\/json\b/i.test(type)) {
    return jsonError(415, "Send the request as application/json");
  }
  return null;
}

export type WorkspaceHeader =
  | { ok: true; headers: Readonly<Record<string, string>> }
  | { ok: false };

/** The caller's X-Workspace-ID, checked, ready to forward. Absent is allowed. */
export function workspaceHeader(request: Request): WorkspaceHeader {
  const id = request.headers.get(WORKSPACE_HEADER)?.trim();
  if (!id) return { ok: true, headers: {} };
  if (!WORKSPACE_ID_PATTERN.test(id)) return { ok: false };
  return { ok: true, headers: { [WORKSPACE_HEADER]: id } };
}

export type JsonBody = { ok: true; value: Record<string, unknown> } | { ok: false };

/** Reads a JSON object body. Anything else (bad JSON, an array, a string) is rejected. */
export async function readJsonObject(request: Request): Promise<JsonBody> {
  try {
    const value: unknown = JSON.parse(await request.text());
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return { ok: false };
    }
    return { ok: true, value: value as Record<string, unknown> };
  } catch (error) {
    console.error("[proxy] request body is not JSON:", error);
    return { ok: false };
  }
}
