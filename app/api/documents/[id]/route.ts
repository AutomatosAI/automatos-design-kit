import { type DocumentContext, forwardDocument } from "@/lib/server/documents";

// GET: one document with its status (the processing poll reads this, never /reprocess).
// DELETE: removes it; the page shows /delete-impact first.

export async function GET(request: Request, context: DocumentContext): Promise<Response> {
  return forwardDocument(request, context, { suffix: "" });
}

export async function DELETE(request: Request, context: DocumentContext): Promise<Response> {
  return forwardDocument(request, context, { suffix: "" });
}
