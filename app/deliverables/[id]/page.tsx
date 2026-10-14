import { notFound } from "next/navigation";

import { DeliverableScreen } from "@/components/deliverables/DeliverableScreen";
import { isDeliverableId } from "@/lib/chat/deliverables";

export default async function DeliverablePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Next hands the segment over decoded; an id the API couldn't take is no page at all.
  if (!isDeliverableId(id)) notFound();
  return <DeliverableScreen key={id} id={id} />;
}
