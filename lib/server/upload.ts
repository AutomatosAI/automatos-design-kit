import { MAX_UPLOAD_BYTES, UPLOAD_HEADER, UPLOAD_HEADER_VALUE } from "@/lib/documents/rules";
import { backendUnreachable, jsonError, rejectOtherSites, workspaceHeader } from "@/lib/server/backend";
import { backendBase, passThrough } from "@/lib/server/forward";

// POST /api/documents/upload (knowledge.md, "Upload"). The one route whose body isn't
// JSON, so it can't use rejectCrossSite's JSON rule: it keeps the Host and Sec-Fetch-Site
// checks and requires X-Play-Upload instead. The multipart body is never parsed: its raw
// bytes stream to the backend with the original content-type (the boundary lives there).
// The backend chunks and embeds before it answers, so the wait is long.

/** The form's own framing (boundaries, part headers, description and tags) on top of the file. */
export const FORM_OVERHEAD_BYTES = 64 * 1024;
export const MAX_UPLOAD_BODY_BYTES = MAX_UPLOAD_BYTES + FORM_OVERHEAD_BYTES;
export const UPLOAD_TIMEOUT_MS = 5 * 60 * 1000;

const CLIENT_CLOSED = 499;
const UPLOAD_PATH = "/api/documents/upload";
const MULTIPART = /^multipart\/form-data\s*;.*\bboundary=/i;

type DuplexInit = RequestInit & { duplex: "half" };

function declaredLength(request: Request): number | null {
  const raw = request.headers.get("content-length");
  return raw !== null && /^\d{1,15}$/.test(raw) ? Number(raw) : null;
}

/** Every refusal that needs no byte of the body read. Null: the upload may go ahead. */
export function checkUpload(request: Request): Response | null {
  const otherSite = rejectOtherSites(request);
  if (otherSite) return otherSite;
  if (request.headers.get(UPLOAD_HEADER) !== UPLOAD_HEADER_VALUE) {
    return jsonError(403, "Uploads must come from Play's Knowledge page");
  }
  if (!MULTIPART.test(request.headers.get("content-type") ?? "")) {
    return jsonError(415, "Send the file as multipart/form-data");
  }
  const length = declaredLength(request);
  if (length === null) return jsonError(411, "The upload must say how big it is");
  if (length > MAX_UPLOAD_BODY_BYTES) return jsonError(413, "That file is over 50 MB, the most Automatos takes");
  if (request.body === null) return jsonError(400, "Choose a file to upload");
  return null;
}

export async function forwardUpload(request: Request, timeoutMs: number = UPLOAD_TIMEOUT_MS): Promise<Response> {
  const refused = checkUpload(request);
  if (refused) return refused;

  const workspace = workspaceHeader(request);
  if (!workspace.ok) return jsonError(400, "The workspace id is not valid");
  const base = backendBase();
  if (!base.ok) return base.response;

  const timeout = AbortSignal.timeout(timeoutMs);
  const init: DuplexInit = {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": request.headers.get("content-type") ?? "",
      ...workspace.headers,
    },
    body: request.body,
    duplex: "half",
    cache: "no-store",
    signal: AbortSignal.any([request.signal, timeout]),
  };

  try {
    return passThrough(await fetch(`${base.url}${UPLOAD_PATH}`, init));
  } catch (error) {
    if (request.signal.aborted) return new Response(null, { status: CLIENT_CLOSED });
    if (timeout.aborted) {
      console.error(`[proxy] upload gave up after ${timeoutMs} ms:`, error);
      return jsonError(504, "Automatos took too long to read that file");
    }
    console.error(`[proxy] POST ${base.url}${UPLOAD_PATH} failed:`, error);
    return backendUnreachable(base.url);
  }
}
