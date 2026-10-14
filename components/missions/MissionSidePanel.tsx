"use client";

// The run page's side panel: what the Mission has cost (GET /cost), when it started and
// finished, why it stopped when the backend says, and the Deliverables it made, as shelf cards.

import { ShelfCard } from "@/components/deliverables/ShelfCard";
import type { MissionSide } from "@/hooks/useMissionSide";
import type { ApiClient } from "@/lib/client/api";
import { costFigures, whenWords } from "@/lib/missions/run";
import type { MissionDetail } from "@/lib/missions/types";

import pageStyles from "../page/page.module.css";
import styles from "./run.module.css";

export const SIDE_LABEL = "About this Mission";
export const COST = "Cost";
export const TIMES = "Times";
export const STOPPED = "Why it stopped";
export const DELIVERABLES = "Deliverables";
export const DELIVERABLES_LABEL = "This Mission's Deliverables";
export const NO_DELIVERABLES = "No Deliverables yet.";
export const NOT_YET = "Not yet";

export interface MissionSidePanelProps {
  readonly mission: MissionDetail;
  readonly side: MissionSide;
  readonly client: ApiClient;
  readonly now: Date;
}

export function MissionSidePanel({ mission, side, client, now }: MissionSidePanelProps) {
  return (
    <>
      <CostSection side={side} />
      <section className={styles.sideSection} aria-label={TIMES}>
        <h2 className={pageStyles.sectionLabel}>{TIMES}</h2>
        <dl className={styles.facts}>
          <Fact label="Started" iso={mission.startedAt} />
          <Fact label="Finished" iso={mission.completedAt} />
        </dl>
      </section>
      {mission.stopDetail && (
        <section className={styles.sideSection} aria-label={STOPPED}>
          <h2 className={pageStyles.sectionLabel}>{STOPPED}</h2>
          <p className={styles.note}>{mission.stopDetail}</p>
        </section>
      )}
      <DeliverablesSection side={side} client={client} now={now} />
    </>
  );
}

function Fact({ label, iso }: { readonly label: string; readonly iso: string | null }) {
  const when = whenWords(iso);
  return (
    <>
      <dt className={styles.factLabel}>{label}</dt>
      <dd className={styles.factValue}>{when ? <time dateTime={iso ?? undefined}>{when}</time> : NOT_YET}</dd>
    </>
  );
}

function Retry({ error, retry }: { readonly error: string; readonly retry: () => void }) {
  return (
    <>
      <p className={styles.alert}>{error}</p>
      <button type="button" className={pageStyles.secondary} onClick={retry}>
        Try again
      </button>
    </>
  );
}

function CostSection({ side }: { readonly side: MissionSide }) {
  const { value, error, retry } = side.cost;
  const figures = value ? costFigures(value) : null;
  return (
    <section className={styles.sideSection} aria-label={COST}>
      <h2 className={pageStyles.sectionLabel}>{COST}</h2>
      {figures && (
        <dl className={styles.facts}>
          <dt className={styles.factLabel}>Tokens</dt>
          <dd className={styles.factValue}>{figures.tokens}</dd>
          <dt className={styles.factLabel}>Estimate</dt>
          <dd className={styles.factValue}>{figures.estimate}</dd>
        </dl>
      )}
      {error && <Retry error={error} retry={retry} />}
      {!figures && !error && <p className={styles.note}>Loading…</p>}
    </section>
  );
}

function DeliverablesSection({ side, client, now }: Omit<MissionSidePanelProps, "mission">) {
  const { value, error, retry } = side.deliverables;
  return (
    <section className={styles.sideSection} aria-label={DELIVERABLES}>
      <h2 className={pageStyles.sectionLabel}>{DELIVERABLES}</h2>
      {value && value.length > 0 && (
        <ul className={styles.deliverables} aria-label={DELIVERABLES_LABEL}>
          {value.map((deliverable) => (
            <ShelfCard key={deliverable.id} deliverable={deliverable} client={client} now={now} newest={false} />
          ))}
        </ul>
      )}
      {value && value.length === 0 && <p className={styles.note}>{NO_DELIVERABLES}</p>}
      {error && <Retry error={error} retry={retry} />}
      {!value && !error && <p className={styles.note}>Loading…</p>}
    </section>
  );
}
