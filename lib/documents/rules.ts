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

/** The types Auto reads (knowledge.md, "Upload"); the backend checks the bytes match. */
export const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md", ".csv", ".html", ".json", ".xlsx"] as const;

/** The file picker's accept attribute: the same list. */
export const ACCEPT_ATTRIBUTE = ACCEPTED_EXTENSIONS.join(",");

const MEGABYTE = 1024 * 1024;

export type FileCheck = { readonly ok: true } | { readonly ok: false; readonly reason: string };

/** ".PDF" -> ".pdf"; "" when the name has no extension. */
export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot).toLowerCase() : "";
}

function isAccepted(extension: string): boolean {
  return ACCEPTED_EXTENSIONS.some((accepted) => accepted === extension);
}

/** "63 MB", rounded up so a file just over the limit never reads as 50 MB. */
function wholeMegabytes(bytes: number): string {
  return `${Math.ceil(bytes / MEGABYTE)} MB`;
}

/** The browser's check before anything is sent: the type by its name, then the size. */
export function checkFile(file: { readonly name: string; readonly size: number }): FileCheck {
  if (!isAccepted(extensionOf(file.name))) {
    return {
      ok: false,
      reason: "Auto can read PDF, Word (.docx), text, Markdown, CSV, HTML, JSON and Excel (.xlsx) files. Try one of those.",
    };
  }
  if (file.size === 0) return { ok: false, reason: "That file is empty, so there's nothing to read." };
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, reason: `That file is ${wholeMegabytes(file.size)}. Auto can read files up to 50 MB.` };
  }
  return { ok: true };
}
