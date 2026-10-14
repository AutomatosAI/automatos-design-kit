// A Deliverable's file, as the backend serves it. preview_url is a backend-relative
// path: /api/workspaces/{ws}/files/raw?path=… for bytes (images, PDFs, Office files,
// videos), /files/content?path=… (JSON for a code viewer) for text files
// (_workspace_file_url in automatos-ai/orchestrator/services/deliverable_service.py).
// Only the raw route is a file Play can show or hand over. Pure: the proxy route
// (server) and the detail page (browser) both use it.

const RAW_FILE = /^\/api\/workspaces\/([A-Za-z0-9_-]{1,64})\/files\/raw$/;
/** Only for parsing a relative path; never fetched. */
const BACKEND_BASE = "http://backend.invalid";
const PATH_PARAM = "path";

/**
 * The backend path of the Deliverable's bytes, rebuilt from its preview_url, or null when
 * it has none Play can serve (no preview_url, a JSON /files/content one, an outside URL).
 */
export function rawFilePath(previewUrl: string | null): string | null {
  if (!previewUrl || !previewUrl.startsWith("/")) return null;
  let url: URL;
  try {
    url = new URL(previewUrl, BACKEND_BASE);
  } catch (error) {
    console.warn("[deliverable] a preview_url that isn't a path:", previewUrl, error);
    return null;
  }
  // "//host/…" resolves to another host: not a backend path.
  if (url.origin !== BACKEND_BASE) return null;
  const workspace = RAW_FILE.exec(url.pathname)?.[1];
  const file = url.searchParams.get(PATH_PARAM);
  if (!workspace || !file) return null;
  return `/api/workspaces/${workspace}/files/raw?${PATH_PARAM}=${encodeURIComponent(file)}`;
}
