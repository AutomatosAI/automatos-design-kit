import { PACKAGE_MAX_BYTES } from "./format";

// Sending a packed skin to the person's own Automatos (PRD-004 K-007): what the editor and the
// kit's two proxy routes agree on. The browser posts the .autoskin as a multipart form to the
// kit's own server, never to the backend; the route checks the custom header (another site
// can't send it without a preflight this app never answers) and streams the body on.
// Pure; relative imports only.

export const SKIN_KIT_HEADER = "X-Skin-Kit";
export const SKIN_KIT_HEADER_VALUE = "1";
/** The multipart field Studio's import and submit routes read (core PRD-259 S-003, S-005). */
export const SKIN_FILE_FIELD = "file";

export const IMPORT_SKIN_ROUTE = "/api/studio/import-skin";
export const SUBMIT_SKIN_ROUTE = "/api/studio/submit-skin";

/** The form's own framing (boundary, part headers) on top of the package. */
export const FORM_OVERHEAD_BYTES = 64 * 1024;
export const MAX_SKIN_BODY_BYTES = PACKAGE_MAX_BYTES + FORM_OVERHEAD_BYTES;

/** What a backend without PRD-259 answers (404), in words. */
export const NO_SKINS_MESSAGE = "Your Automatos doesn't support skins yet (it needs PRD-259)";

/** Where Studio (the Automatos web app) runs on a local install, and its Marketplace page. */
export const DEFAULT_STUDIO_URL = "http://localhost:3000";
export const MARKETPLACE_PATH = "/marketplace";

const HTTP_URL = /^https?:\/\/[^/\s@?#]+(\/[^\s?#]*)?$/i;

/**
 * The Marketplace page of the person's Automatos: NEXT_PUBLIC_AUTOMATOS_STUDIO_URL when it is a
 * plain http(s) URL (no user, password, query or fragment), else Studio's local default.
 */
export function studioMarketplaceUrl(setting: string | undefined): string {
  const raw = setting?.trim() ?? "";
  if (raw !== "" && !HTTP_URL.test(raw)) {
    console.warn("[skins] NEXT_PUBLIC_AUTOMATOS_STUDIO_URL isn't a plain http(s) URL; using", DEFAULT_STUDIO_URL);
  }
  const base = raw !== "" && HTTP_URL.test(raw) ? raw : DEFAULT_STUDIO_URL;
  return `${base.replace(/\/+$/, "")}${MARKETPLACE_PATH}`;
}
