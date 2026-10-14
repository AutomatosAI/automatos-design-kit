import { type DocumentContext, documentPathId } from "@/lib/server/documents";
import { downloadDocument } from "@/lib/server/download";
import { invalidId } from "@/lib/server/forward";

// The document's file: a 302 to storage, or the bytes streamed safely (lib/server/download.ts).
// The browser names the document only; any query it sends is ignored.

export async function GET(request: Request, context: DocumentContext): Promise<Response> {
  const id = documentPathId((await context.params).id);
  if (!id) return invalidId();
  return downloadDocument(request, id);
}
