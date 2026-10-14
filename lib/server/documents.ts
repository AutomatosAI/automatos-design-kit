import { isDocumentId } from "@/lib/documents/rules";
import { type BodyCheck, forwardToBackend, invalidId } from "@/lib/server/forward";

// The JSON document routes under /api/documents/[id] (knowledge.md). Document ids are
// integers in the core, checked before they touch a path. The upload and the download
// aren't plain JSON and have their own helpers (upload.ts, download.ts).

export type DocumentContext = { params: Promise<{ id: string }> };

export type DocumentForward = {
  /** What follows /api/documents/{id}: "" for the document itself, "/content", "/delete-impact". */
  readonly suffix: string;
  readonly query?: readonly string[];
};

/** What the list forwards (documents.py list_documents); team and provenance scopes stay out. */
export const DOCUMENT_LIST_QUERY = ["skip", "limit", "status", "file_type", "search"] as const;

/** The search body keys Play sends (SemanticSearchRequest); anything else is dropped. */
const SEARCH_KEYS = ["query", "limit", "min_similarity", "document_ids"] as const;

/** The id as a backend path segment, or null when it isn't a whole number. */
export function documentPathId(raw: string): string | null {
  return isDocumentId(raw) ? raw : null;
}

/**
 * Keeps the search fields and drops the rest. A missing query is forwarded on purpose:
 * the backend answers 422 and the page shows that answer.
 */
export function searchBody(body: Readonly<Record<string, unknown>>): BodyCheck {
  const kept = SEARCH_KEYS.flatMap((key) => (key in body ? [[key, body[key]] as const] : []));
  return { ok: true, value: Object.fromEntries(kept) };
}

export async function forwardDocument(
  request: Request,
  context: DocumentContext,
  options: DocumentForward,
): Promise<Response> {
  const id = documentPathId((await context.params).id);
  if (!id) return invalidId();
  return forwardToBackend(request, { path: `/api/documents/${id}${options.suffix}`, query: options.query });
}
