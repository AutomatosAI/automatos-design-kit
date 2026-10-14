import { type DocumentContext, forwardDocument } from "@/lib/server/documents";

// The full text, rebuilt from the chunks on every call: asked for only when a document is opened.

export async function GET(request: Request, context: DocumentContext): Promise<Response> {
  return forwardDocument(request, context, { suffix: "/content" });
}
