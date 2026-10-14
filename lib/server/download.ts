import { jsonError } from "@/lib/server/backend";
import { forwardToBackend, SAFE_HEADERS } from "@/lib/server/forward";

// GET /api/documents/[id]/download (PRD-003 §7, knowledge.md). Play asks the backend for
// mode=url; the browser names only the document, never a path or a URL.
// - An absolute https: URL (S3, presigned) answers 302 to it: the browser fetches the
//   file from storage, not through Play.
// - Any other URL (http: storage such as a local MinIO, or a backend-relative path) is
//   fetched by Play's server and streamed back.
// - With no storage the backend answers the file's bytes itself (its local fallback):
//   those stream back too.
// Every streamed file goes out as an attachment with nosniff and the sandbox CSP.

const FALLBACK_TYPE = "application/octet-stream";
const KEEP = ["content-disposition"] as const;
const NO_FILE = "This document has no file Play can download";
const FILE_FAILED = "Automatos couldn't hand over that file";

export type DownloadLink = { readonly url: string; readonly filename: string | null };

/** Where the file is fetched from: a redirect for the browser, or a fetch by Play's server. */
export type DownloadTarget =
  | { readonly kind: "redirect"; readonly url: string }
  | { readonly kind: "fetch"; readonly url: string }
  | { readonly kind: "backend"; readonly path: string };

/** {url, filename} from the backend's mode=url answer; null when it has no url. */
export function downloadLink(body: unknown): DownloadLink | null {
  if (typeof body !== "object" || body === null || !("url" in body)) return null;
  if (typeof body.url !== "string" || !body.url) return null;
  const filename = "filename" in body && typeof body.filename === "string" ? body.filename : null;
  return { url: body.url, filename };
}

/** https: -> redirect, http: -> Play fetches it, "/path" -> through the backend; anything else none. */
export function downloadTarget(url: string): DownloadTarget | null {
  if (url.startsWith("/") && !url.startsWith("//")) return { kind: "backend", path: url };
  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password) return null;
    if (parsed.protocol === "https:") return { kind: "redirect", url: parsed.href };
    if (parsed.protocol === "http:") return { kind: "fetch", url: parsed.href };
    return null;
  } catch {
    // Not an absolute URL and not a backend path: nothing Play will open.
    return null;
  }
}

/** A Content-Disposition that always downloads, keeping the backend's own when it already does. */
export function attachmentHeader(upstream: string | null, filename: string | null): string {
  if (upstream && /^attachment\b/i.test(upstream)) return upstream;
  if (!filename) return "attachment";
  const plain = filename.replace(/[^\x20-\x7e]|["\\]/g, "_");
  return `attachment; filename="${plain}"; filename*=UTF-8''${extValue(filename)}`;
}

/** RFC 5987 encoding: encodeURIComponent leaves ' ( ) * alone, which the header can't carry. */
function extValue(text: string): string {
  return encodeURIComponent(text).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** The file's bytes, streamed, as a download that can't run on Play's origin. */
export function fileAnswer(upstream: Response, filename: string | null): Response {
  if (!upstream.ok) {
    console.error(`[proxy] document file answered ${upstream.status}`);
    return jsonError(502, FILE_FAILED);
  }
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? FALLBACK_TYPE,
      "Content-Disposition": attachmentHeader(upstream.headers.get("content-disposition"), filename),
      "Cache-Control": "no-store",
      ...SAFE_HEADERS,
    },
  });
}

function redirectTo(url: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: url, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", ...SAFE_HEADERS },
  });
}

async function fetchFile(request: Request, url: string, filename: string | null): Promise<Response> {
  try {
    const upstream = await fetch(url, { headers: { Accept: "*/*" }, cache: "no-store", signal: request.signal });
    return fileAnswer(upstream, filename);
  } catch (error) {
    console.error(`[proxy] fetching a document file from ${new URL(url).origin} failed:`, error);
    return jsonError(502, FILE_FAILED);
  }
}

async function readLink(answer: Response): Promise<DownloadLink | null> {
  const body: unknown = await answer.json().catch((error: unknown) => {
    console.error("[proxy] the download answer is not JSON:", error);
    return null;
  });
  return downloadLink(body);
}

async function followLink(request: Request, link: DownloadLink): Promise<Response> {
  const target = downloadTarget(link.url);
  if (!target) {
    console.error("[proxy] the download answer named a URL Play won't open");
    return jsonError(404, NO_FILE);
  }
  if (target.kind === "redirect") return redirectTo(target.url);
  if (target.kind === "fetch") return fetchFile(request, target.url, link.filename);
  const answer = await forwardToBackend(request, { path: target.path, accept: "*/*", keepHeaders: KEEP });
  return answer.ok ? fileAnswer(answer, link.filename) : answer;
}

/** The whole route, for a document id already checked by documentPathId. */
export async function downloadDocument(request: Request, id: string): Promise<Response> {
  const answer = await forwardToBackend(request, {
    path: `/api/documents/${id}/download?mode=url`,
    accept: "application/json, */*",
    keepHeaders: KEEP,
  });
  if (!answer.ok) return answer;
  const type = answer.headers.get("content-type") ?? "";
  if (!/^application\/json\b/i.test(type)) return fileAnswer(answer, null);
  const link = await readLink(answer);
  return link ? followLink(request, link) : jsonError(404, NO_FILE);
}
