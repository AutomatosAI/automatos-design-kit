// Auto leads the crew (PRD-003 P-007): a larger card above the grid, with the mascot
// following his fleet entry (working while he has something in hand, idle otherwise) and
// that work in words as his caption. The core leaves Auto out of the fleet today, so he
// usually reads as idle. He has no switch: Play never turns Auto off.

import Link from "next/link";
import { useId } from "react";

import { AutoMascot } from "@/components/mascot/AutoMascot";
import { StateChip } from "@/components/page/StateChip";
import {
  agentHref,
  autoMascot,
  autoWorkWords,
  costLine,
  crewStatus,
  lastActiveLine,
  modelRoute,
  RUNTIME_LABELS,
} from "@/lib/agents/crew";
import type { FleetAgent } from "@/lib/agents/fleet";
import type { AgentSummary } from "@/lib/agents/types";

import styles from "./agents.module.css";

export const AUTO_ROLE = "Leads your crew";

export interface AutoLeadCardProps {
  readonly auto: AgentSummary;
  readonly live: FleetAgent | undefined;
  readonly now: Date;
}

export function AutoLeadCard({ auto, live, now }: AutoLeadCardProps) {
  const nameId = useId();
  const route = modelRoute(auto);
  const facts = [lastActiveLine(live, now), costLine(auto.runtime, live?.cost24h)].filter(Boolean).join(" · ");
  return (
    <section className={styles.lead} aria-labelledby={nameId}>
      <div className={styles.leadMascot}>
        <AutoMascot state={autoMascot(live)} caption={autoWorkWords(live)} />
      </div>
      <div className={styles.leadBody}>
        <div className={styles.chipRow}>
          <StateChip {...crewStatus(auto, live)} />
          <span className={styles.runtime}>{RUNTIME_LABELS[auto.runtime]}</span>
        </div>
        <h2 id={nameId} className={styles.leadName}>
          <Link href={agentHref(auto.id)} className={styles.nameLink}>
            {auto.name || "Auto"}
          </Link>
        </h2>
        <p className={styles.role}>{auto.jobTitle ?? AUTO_ROLE}</p>
        {auto.description && <p className={styles.description}>{auto.description}</p>}
        {route && <p className={styles.meta}>{route}</p>}
        {facts && <p className={styles.meta}>{facts}</p>}
      </div>
    </section>
  );
}
