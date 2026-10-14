"use client";

// Missions (PRD-003 P-004), Studio's list in Play's look: a stats strip for the last 30
// days, filter chips by state, a card per Mission, Load more, and an in-page composer
// for a new one. The list is polled every 30 s while the tab is visible. No Auto here:
// he follows a Mission on its own page, not the list (PRD-003 design rule 4).

import { useState } from "react";

import { type GridStatus, type LoadMore, GridPage } from "@/components/page/GridPage";
import { useComposerToggle } from "@/hooks/useComposerToggle";
import { type MissionListView, MORE_FAILED, useMissionList } from "@/hooks/useMissionList";
import { api, type ApiClient } from "@/lib/client/api";
import { emptyListMessage, MISSION_FILTERS, missionCount, type MissionFilter } from "@/lib/missions/list";

import pageStyles from "../page/page.module.css";
import { MissionCard } from "./MissionCard";
import { COMPOSER_TITLE, MissionComposer } from "./MissionComposer";
import styles from "./missions.module.css";
import { MissionStatsStrip } from "./MissionStatsStrip";

export const TITLE = "Missions";
export const FILTER_LABEL = "Show Missions by state";
export const LIST_LABEL = "Your Missions";
export const LOADING_MISSIONS = "Loading your Missions…";

export interface MissionsScreenProps {
  /** Tests pass their own (createApiClient with a mock fetch). */
  readonly client?: ApiClient;
  /** What "now" is for the cards' ages; tests pin it. */
  readonly now?: Date;
  /** The list's poll interval; POLL_INTERVALS.LIST unless a test wants it faster. */
  readonly intervalMs?: number;
}

export function MissionsScreen({ client = api, now, intervalMs }: MissionsScreenProps) {
  const [filter, setFilter] = useState<MissionFilter>("all");
  const list = useMissionList(client, filter, intervalMs);
  const composer = useComposerToggle();
  const today = now ?? new Date();

  return (
    <GridPage<MissionFilter>
      title={TITLE}
      count={list.status === "ready" ? missionCount(list.total) : undefined}
      actions={
        composer.open ? undefined : (
          <button type="button" ref={composer.button} className={pageStyles.primary} onClick={composer.show}>
            {COMPOSER_TITLE}
          </button>
        )
      }
      lead={
        <>
          {composer.open && <MissionComposer client={client} onClose={composer.hide} />}
          <MissionStatsStrip client={client} />
        </>
      }
      filters={{ label: FILTER_LABEL, options: MISSION_FILTERS, selected: filter, onSelect: setFilter }}
      status={gridStatus(list, filter)}
      loadMore={loadMoreOf(list)}
    >
      {list.status === "ready" && (
        <ul className={styles.grid} aria-label={LIST_LABEL}>
          {list.missions.map((mission) => (
            <MissionCard key={mission.id} mission={mission} now={today} />
          ))}
        </ul>
      )}
    </GridPage>
  );
}

function gridStatus(list: MissionListView, filter: MissionFilter): GridStatus {
  if (list.status === "loading") return { kind: "loading", text: LOADING_MISSIONS };
  if (list.status === "failed") return { kind: "failed", error: list.error, retry: list.retry };
  if (list.missions.length === 0) return { kind: "empty", message: emptyListMessage(filter) };
  return { kind: "ready" };
}

function loadMoreOf(list: MissionListView): LoadMore | undefined {
  if (list.status !== "ready" || !list.hasMore) return undefined;
  return { onLoadMore: list.loadMore, loading: list.more === "loading", error: list.more === "failed" ? MORE_FAILED : null };
}
