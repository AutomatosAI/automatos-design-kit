import { notFound } from "next/navigation";

import { AgentDetailScreen } from "@/components/agents/AgentDetailScreen";
import { isAgentId } from "@/lib/agents/types";

export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Agent ids are whole numbers; anything else is no page at all.
  if (!isAgentId(id)) notFound();
  return <AgentDetailScreen key={id} id={Number(id)} />;
}
