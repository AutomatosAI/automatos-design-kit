// One agent in the crew grid: its icon and name, job title, state, model route, runtime,
// what it is doing now and when it was last active (from the fleet), what the last 24 h
// cost, and the on/off switch. No mascot: Auto is the only one (PRD-003 design rule 4).

import Link from "next/link";
import { useId } from "react";

import { StateChip } from "@/components/page/StateChip";
import {
  agentHref,
  canSwitch,
  costLine,
  crewStatus,
  lastActiveLine,
  modelRoute,
  roleLine,
  RUNTIME_LABELS,
  workLine,
} from "@/lib/agents/crew";
import type { FleetAgent } from "@/lib/agents/fleet";
import { agentCategory } from "@/lib/agents/icons";
import type { AgentSummary, AgentSwitchState } from "@/lib/agents/types";

import styles from "./agents.module.css";
import { AgentSwitch } from "./AgentSwitch";

export interface AgentCardProps {
  readonly agent: AgentSummary;
  /** Its fleet entry; undefined until the fleet answers, or when the core leaves it out. */
  readonly live: FleetAgent | undefined;
  readonly now: Date;
  readonly onSwitch: (agent: AgentSummary, status: AgentSwitchState) => Promise<void>;
}

export function AgentCard({ agent, live, now, onSwitch }: AgentCardProps) {
  const nameId = useId();
  const category = agentCategory(agent);
  const route = modelRoute(agent);
  const work = workLine(live);
  const facts = [lastActiveLine(live, now), costLine(agent.runtime, live?.cost24h)].filter(Boolean).join(" · ");
  return (
    <li className={styles.item}>
      <article className={styles.card} aria-labelledby={nameId}>
        <div className={styles.identity}>
          <span className={styles.icon} aria-hidden="true">
            {category.glyph}
          </span>
          <div className={styles.names}>
            <h2 id={nameId} className={styles.name}>
              <Link href={agentHref(agent.id)} className={styles.nameLink}>
                {agent.name || "Unnamed agent"}
              </Link>
            </h2>
            <p className={styles.role}>{roleLine(category.label, agent.jobTitle)}</p>
          </div>
        </div>
        <div className={styles.chipRow}>
          <StateChip {...crewStatus(agent, live)} />
          <span className={styles.runtime}>{RUNTIME_LABELS[agent.runtime]}</span>
        </div>
        {route && <p className={styles.meta}>{route}</p>}
        {work && <p className={styles.work}>{work}</p>}
        {agent.unavailable && <p className={styles.note}>{agent.unavailable}</p>}
        {facts && <p className={styles.meta}>{facts}</p>}
        {canSwitch(agent) && <AgentSwitch agent={agent} onSwitch={onSwitch} />}
      </article>
    </li>
  );
}
