// Rules the Knowledge page and its proxy routes share (knowledge.md). No server code
// here: the page checks a file against these before sending it, the proxy again after.

/** The backend's MAX_UPLOAD_BYTES (orchestrator/api/documents.py): a fixed 50 MB, not a setting. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/**
 * The custom header every upload carries. Another site's form can post multipart with no
 * preflight; a custom header forces one it can't pass (SKILL.md, "Proxy safety").
 */
export const UPLOAD_HEADER = "X-Play-Upload";
export const UPLOAD_HEADER_VALUE = "1";

/** The core's document routes take {document_id:int}; Play takes whole numbers only. */
const DOCUMENT_ID = /^[1-9]\d{0,11}$/;

/** A page's or a route's id segment: anything else is no document at all. */
export function isDocumentId(raw: string): boolean {
  return DOCUMENT_ID.test(raw);
}
