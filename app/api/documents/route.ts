import { DOCUMENT_LIST_QUERY } from "@/lib/server/documents";
import { forwardToBackend } from "@/lib/server/forward";

// The workspace's documents, newest first, with their processing status (knowledge.md).

export async function GET(request: Request): Promise<Response> {
  return forwardToBackend(request, { path: "/api/documents", query: DOCUMENT_LIST_QUERY });
}
