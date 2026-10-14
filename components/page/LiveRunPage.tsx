"use client";

// The live run page pattern (PRD-003 design rule 2): a header with the run's StateChip and
// the actions valid in that state, a progress bar, the steps, the activity feed, Auto
// (with a caption) and a side panel. On phones Auto comes first, then the run, then the panel.

import { type ReactNode, useId } from "react";

import { PageColumns } from "@/components/shell/PageColumns";

import styles from "./page.module.css";
import { BackLink, type BackLinkProps, ProgressBar, type RunProgress } from "./parts";
import { StateChip, type StateChipProps } from "./StateChip";

export const STEPS = "Steps";
export const ACTIVITY = "Activity";
export const AUTO = "Auto";
export { PROGRESS, progressPercent, type RunProgress } from "./parts";

export interface LiveRunPageProps {
  readonly back?: BackLinkProps;
  readonly title: string;
  readonly state: StateChipProps;
  /** Only the actions valid in this state ("Approve plan", "Cancel Mission"). */
  readonly actions?: ReactNode;
  readonly progress?: RunProgress;
  readonly steps?: ReactNode;
  readonly activity?: ReactNode;
  /** Auto, driven by the run's state. */
  readonly mascot?: ReactNode;
  /** A line under Auto, read out politely when it changes. */
  readonly mascotCaption?: string;
  readonly side?: ReactNode;
  readonly sideLabel?: string;
}

export function LiveRunPage(props: LiveRunPageProps) {
  const { back, title, state, actions, progress } = props;
  return (
    <PageColumns>
      <div className={styles.runPage}>
        {back && <BackLink {...back} />}
        <header className={styles.detailHeader}>
          <div className={styles.heading}>
            <h1 className={styles.detailTitle}>{title}</h1>
            <div className={styles.chipRow}>
              <StateChip {...state} />
            </div>
          </div>
          {actions && <div className={styles.headerActions}>{actions}</div>}
        </header>
        {progress && <ProgressBar {...progress} />}
        <RunLayout {...props} />
      </div>
    </PageColumns>
  );
}

function RunLayout({ steps, activity, mascot, mascotCaption, side, sideLabel = "About this run" }: LiveRunPageProps) {
  const stepsId = useId();
  const activityId = useId();
  return (
    <div className={styles.runLayout}>
      {(mascot || mascotCaption) && (
        <aside className={styles.runMascot} aria-label={AUTO}>
          {mascot}
          {mascotCaption && (
            <p className={styles.runCaption} aria-live="polite">
              {mascotCaption}
            </p>
          )}
        </aside>
      )}
      <div className={styles.runMain}>
        {steps && (
          <section className={styles.runSection} aria-labelledby={stepsId}>
            <h2 id={stepsId} className={styles.sectionLabel}>
              {STEPS}
            </h2>
            {steps}
          </section>
        )}
        {activity && (
          <section className={styles.runSection} aria-labelledby={activityId}>
            <h2 id={activityId} className={styles.sectionLabel}>
              {ACTIVITY}
            </h2>
            {activity}
          </section>
        )}
      </div>
      {side && (
        <aside className={styles.runSide} aria-label={sideLabel}>
          {side}
        </aside>
      )}
    </div>
  );
}
