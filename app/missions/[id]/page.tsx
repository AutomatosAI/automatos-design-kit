import { notFound } from "next/navigation";

import { MissionRunScreen } from "@/components/missions/MissionRunScreen";
import { isMissionId } from "@/lib/missions/run";

export default async function MissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Next hands the segment over decoded; an id the API couldn't take is no page at all.
  if (!isMissionId(id)) notFound();
  return <MissionRunScreen key={id} id={id} />;
}
