"use client";

// Agents (PRD-003 P-007), Studio's roster in Play's look: Auto first as the lead card,
// then the crew grid with filter chips (All / API / Session) and a search by name. The
// fleet is polled every 10 s while the tab is visible; the list itself loads once.

import { useMemo, useState } from "react";

import { GridPage, type GridStatus } from "@/components/page/GridPage";
import { type Crew, useCrew } from "@/hooks/useCrew";
import { CREW_FILTERS, crewCount, crewOf, type CrewFilter, filterCrew, findAuto } from "@/lib/agents/crew";
import { fleetById } from "@/lib/agents/fleet";
import type { AgentSummary } from "@/lib/agents/types";
import { api, type ApiClient } from "@/lib/client/api";

import styles from "./agents.module.css";
import { AgentCard } from "./AgentCard";
import { AutoLeadCard } from "./AutoLeadCard";

export const TITLE = "Agents";
export const FILTER_LABEL = "Show agents by runtime";
export const SEARCH_LABEL = "Search agents by name";
export const LIST_LABEL = "Your crew";
export const LOADING_AGENTS = "Loading your agents…";
export const NO_CREW = "Auto has no crew yet. Agents are added in Studio.";
export const NO_MATCH = "No agents match.";
export const FLEET_DOWN = "Live status isn't available right now. Play keeps asking.";
export const FLEET_STALE = "Live status may be out of date. Play keeps asking.";

export interface AgentsScreenProps {
  /** Tests pass their own (createApiClient with a mock fetch). */
  readonly client?: ApiClient;
  /** What "now" is for "Last active"; tests pin it. */
  readonly now?: Date;
  /** The fleet's poll interval; POLL_INTERVALS.FLEET unless a test wants it faster. */
  readonly fleetIntervalMs?: number;
}

export function AgentsScreen({ client = api, now, fleetIntervalMs }: AgentsScreenProps) {
  const { crew, fleet, switchAgent } = useCrew(client, fleetIntervalMs);
  const [filter, setFilter] = useState<CrewFilter>("all");
  const [search, setSearch] = useState("");
  const live = useMemo(() => fleetById(fleet.status === "ready" ? fleet.value : null), [fleet]);
  const data = crew.status === "ready" ? crew.value : null;
  const auto = data ? findAuto(data.agents, data.workspaceId) : null;
  const team = data ? crewOf(data.agents, auto, data.workspaceId) : [];
  const shown = filterCrew(team, filter, search);
  const today = now ?? new Date();
  const note = fleetNote(fleet);

  return (
    <GridPage<CrewFilter>
      title={TITLE}
      count={data ? crewCount(data.agents, live) : undefined}
      lead={
        <>
          {auto && <AutoLeadCard auto={auto} live={live.get(auto.id)} now={today} />}
          {data && note && <p className={styles.fleetNote}>{note}</p>}
        </>
      }
      filters={{ label: FILTER_LABEL, options: CREW_FILTERS, selected: filter, onSelect: setFilter }}
      search={{ label: SEARCH_LABEL, value: search, onChange: setSearch }}
      status={gridStatus(crew, team, shown)}
    >
      <ul className={styles.grid} aria-label={LIST_LABEL}>
        {shown.map((agent) => (
          <AgentCard key={agent.id} agent={agent} live={live.get(agent.id)} now={today} onSwitch={switchAgent} />
        ))}
      </ul>
    </GridPage>
  );
}

function fleetNote(fleet: Crew["fleet"]): string | null {
  if (fleet.status === "failed") return FLEET_DOWN;
  if (fleet.status === "ready" && fleet.stale) return FLEET_STALE;
  return null;
}

function gridStatus(crew: Crew["crew"], team: readonly AgentSummary[], shown: readonly AgentSummary[]): GridStatus {
  if (crew.status === "loading") return { kind: "loading", text: LOADING_AGENTS };
  if (crew.status === "failed") return { kind: "failed", error: crew.error, retry: crew.retry };
  if (team.length === 0) return { kind: "empty", message: NO_CREW };
  if (shown.length === 0) return { kind: "empty", message: NO_MATCH };
  return { kind: "ready" };
}
