import { notFound } from "next/navigation";

import { DocumentScreen } from "@/components/knowledge/DocumentScreen";
import { isDocumentId } from "@/lib/documents/rules";

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Document ids are whole numbers; anything else is no page at all.
  if (!isDocumentId(id)) notFound();
  return <DocumentScreen key={id} id={Number(id)} />;
}
