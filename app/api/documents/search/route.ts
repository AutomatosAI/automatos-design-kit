import { searchBody } from "@/lib/server/documents";
import { forwardToBackend } from "@/lib/server/forward";

// The search box: {query} (required: without it the backend's 422 comes back as it is).
// Results for people, not /rag/retrieve, which builds context for a model.

export async function POST(request: Request): Promise<Response> {
  return forwardToBackend(request, { path: "/api/documents/search", jsonBody: true, checkBody: searchBody });
}
