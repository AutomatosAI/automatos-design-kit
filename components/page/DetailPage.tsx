"use client";

// The detail page pattern (PRD-003 design rule 2): a back link, the header (title, state
// chips, actions), the main column and a side panel, one column below 1024 px. Built on
// the Deliverable page's layout. The page decides what to show while it loads. A mascot,
// when the page has one (Auto's own agent page), goes in the mascot column.

import type { ReactNode } from "react";

import { PageColumns } from "@/components/shell/PageColumns";

import styles from "./page.module.css";
import { BackLink, type BackLinkProps } from "./parts";

export const SIDE_LABEL = "Details";

export interface DetailPageProps {
  readonly back: BackLinkProps;
  readonly title: string;
  /** StateChips and other short facts beside the title. */
  readonly chips?: ReactNode;
  /** The actions valid right now ("Pause agent"). */
  readonly actions?: ReactNode;
  /** The main column. */
  readonly children?: ReactNode;
  /** The side panel; left out, the main column takes the width. */
  readonly side?: ReactNode;
  /** Names the side panel for screen readers. */
  readonly sideLabel?: string;
  /** The mascot column (MascotColumn + AutoMascot); left out, no Auto. */
  readonly mascot?: ReactNode;
}

export function DetailPage({
  back,
  title,
  chips,
  actions,
  children,
  side,
  sideLabel = SIDE_LABEL,
  mascot,
}: DetailPageProps) {
  return (
    <PageColumns mascot={mascot}>
      <div className={styles.detailPage}>
        <BackLink {...back} />
        <header className={styles.detailHeader}>
          <div className={styles.heading}>
            <h1 className={styles.detailTitle}>{title}</h1>
            {chips && <div className={styles.chipRow}>{chips}</div>}
          </div>
          {actions && <div className={styles.headerActions}>{actions}</div>}
        </header>
        <div className={styles.detailLayout} data-side={side ? "true" : "false"}>
          <div className={styles.mainColumn}>{children}</div>
          {side && (
            <aside className={styles.sidePanel} aria-label={sideLabel}>
              {side}
            </aside>
          )}
        </div>
      </div>
    </PageColumns>
  );
}
