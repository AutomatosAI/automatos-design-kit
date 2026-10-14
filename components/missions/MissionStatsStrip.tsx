"use client";

// The small strip over the Missions list: how many, how many succeeded and how long they
// take, over the last 30 days (GET /api/missions/stats?period=30d). Read once per visit.

import { useCallback, useId } from "react";

import { useLoad } from "@/hooks/useLoad";
import type { ApiClient } from "@/lib/client/api";
import { statFigures } from "@/lib/missions/list";

import pageStyles from "../page/page.module.css";
import styles from "./missions.module.css";

export const STATS_TITLE = "Last 30 days";
export const STATS_FAILED = "Play couldn't load the Mission figures.";
export const STATS_PERIOD = "30d";

export function MissionStatsStrip({ client }: { readonly client: ApiClient }) {
  const load = useCallback(() => client.missionStats(STATS_PERIOD), [client]);
  const stats = useLoad(load, STATS_FAILED, "missions");
  const titleId = useId();

  return (
    <section className={styles.stats} aria-labelledby={titleId}>
      <h2 id={titleId} className={pageStyles.sectionLabel}>
        {STATS_TITLE}
      </h2>
      {stats.status === "loading" && <p className={pageStyles.status}>Loading the figures…</p>}
      {stats.status === "failed" && (
        <div className={styles.statsFailed}>
          <p className={pageStyles.error}>
            <span aria-hidden="true">✕</span> {stats.error}
          </p>
          <button type="button" className={pageStyles.secondary} onClick={stats.retry}>
            Try again
          </button>
        </div>
      )}
      {stats.status === "ready" && (
        <dl className={styles.figures}>
          {statFigures(stats.value).map((figure) => (
            <div key={figure.label} className={styles.figure}>
              <dt className={styles.figureLabel}>{figure.label}</dt>
              <dd className={styles.figureValue}>{figure.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
