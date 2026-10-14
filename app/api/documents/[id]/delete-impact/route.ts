import { type DocumentContext, forwardDocument } from "@/lib/server/documents";

// Chunk, embedding and reference counts, shown in the in-page confirmation before a delete.

export async function GET(request: Request, context: DocumentContext): Promise<Response> {
  return forwardDocument(request, context, { suffix: "/delete-impact" });
}
