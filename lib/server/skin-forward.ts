import { backendUnreachable, jsonError, rejectOtherSites, workspaceHeader } from "@/lib/server/backend";
import { backendBase, passThrough } from "@/lib/server/forward";
import { MAX_SKIN_BODY_BYTES, NO_SKINS_MESSAGE, SKIN_KIT_HEADER, SKIN_KIT_HEADER_VALUE } from "@/lib/skins/sharing";

// The two skin routes (PRD-004 K-007): Load into my Automatos (POST /api/skins/import) and
// Submit to the Marketplace (POST /api/marketplace/skins). The body is a multipart form holding
// the .autoskin, so rejectCrossSite's JSON rule can't apply: the Host and Sec-Fetch-Site checks
// stay and X-Skin-Kit: 1 is required instead. The body is never parsed: its raw bytes stream to
// the backend with the original content-type (the boundary lives there). Studio validates the
// whole package before it answers, so the wait may be long.

export const BACKEND_IMPORT_PATH = "/api/skins/import";
export const BACKEND_SUBMIT_PATH = "/api/marketplace/skins";
export const SKIN_TIMEOUT_MS = 2 * 60 * 1000;

const CLIENT_CLOSED = 499;
const MULTIPART = /^multipart\/form-data\s*;.*\bboundary=/i;

type DuplexInit = RequestInit & { duplex: "half" };

function declaredLength(request: Request): number | null {
  const raw = request.headers.get("content-length");
  return raw !== null && /^\d{1,15}$/.test(raw) ? Number(raw) : null;
}

/** Every refusal that needs no byte of the body read. Null: the skin may go ahead. */
export function checkSkinUpload(request: Request): Response | null {
  const otherSite = rejectOtherSites(request);
  if (otherSite) return otherSite;
  if (request.headers.get(SKIN_KIT_HEADER) !== SKIN_KIT_HEADER_VALUE) {
    return jsonError(403, "Skins must come from the Skin Kit's editor");
  }
  if (!MULTIPART.test(request.headers.get("content-type") ?? "")) {
    return jsonError(415, "Send the skin as multipart/form-data");
  }
  const length = declaredLength(request);
  if (length === null) return jsonError(411, "The upload must say how big it is");
  if (length > MAX_SKIN_BODY_BYTES) return jsonError(413, "That skin is over 15 MB, the most Studio takes");
  if (request.body === null) return jsonError(400, "Choose a skin to send");
  return null;
}

/** The backend's answer, except a 404: then this Automatos has no skin routes yet. */
async function answer(upstream: Response): Promise<Response> {
  if (upstream.status !== 404) return passThrough(upstream);
  await upstream.body?.cancel().catch((error: unknown) => console.warn("[proxy] closing a 404 body failed:", error));
  return jsonError(404, NO_SKINS_MESSAGE);
}

export async function forwardSkin(request: Request, path: string, timeoutMs: number = SKIN_TIMEOUT_MS): Promise<Response> {
  const refused = checkSkinUpload(request);
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
    return await answer(await fetch(`${base.url}${path}`, init));
  } catch (error) {
    if (request.signal.aborted) return new Response(null, { status: CLIENT_CLOSED });
    if (timeout.aborted) {
      console.error(`[proxy] sending a skin gave up after ${timeoutMs} ms:`, error);
      return jsonError(504, "Automatos took too long to read that skin");
    }
    console.error(`[proxy] POST ${base.url}${path} failed:`, error);
    return backendUnreachable(base.url);
  }
}
