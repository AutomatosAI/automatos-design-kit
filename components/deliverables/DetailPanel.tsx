// The side panel on a Deliverable's page (mock 05): Ask Auto about this (a new chat
// with the message box filled in), Download when it has a file, About this
// Deliverable, and Sources when it carries any.

import Link from "next/link";
import { useId } from "react";

import { draftHref } from "@/lib/chat/params";
import { deliverableFileHref } from "@/lib/client/api";
import type { Deliverable } from "@/lib/client/types";
import { askAboutText, hasFile, madeBy } from "@/lib/deliverables/detail";
import { typeLabel } from "@/lib/deliverables/shelf";

import styles from "./detail.module.css";

export const ASK_AUTO = "Ask Auto about this";
export const ABOUT = "About this Deliverable";

export interface DetailPanelProps {
  readonly deliverable: Deliverable;
  readonly kind: string;
  readonly title: string;
  /** "Today, 15:42", or "" when unknown. */
  readonly date: string;
}

export function DetailPanel({ deliverable, kind, title, date }: DetailPanelProps) {
  const aboutId = useId();
  const sourcesId = useId();
  const { sources } = deliverable;

  return (
    <aside className={styles.panel} aria-label={ABOUT}>
      <div className={styles.actions}>
        <Link href={draftHref(askAboutText(title))} className={styles.primary}>
          {ASK_AUTO}
        </Link>
        {hasFile(deliverable) && (
          <a href={deliverableFileHref(deliverable.id)} download={deliverable.fileName ?? ""} className={styles.secondary}>
            Download
          </a>
        )}
      </div>
      <section className={styles.panelSection} aria-labelledby={aboutId}>
        <h2 id={aboutId} className={styles.panelLabel}>
          {ABOUT}
        </h2>
        <dl className={styles.facts}>
          <div className={styles.fact}>
            <dt>Type</dt>
            <dd>{typeLabel(kind)}</dd>
          </div>
          {date && (
            <div className={styles.fact}>
              <dt>Made</dt>
              <dd>{date}</dd>
            </div>
          )}
          <div className={styles.fact}>
            <dt>Made by</dt>
            <dd>{madeBy(deliverable.agentName)}</dd>
          </div>
        </dl>
      </section>
      {sources.length > 0 && (
        <section className={styles.panelSection} aria-labelledby={sourcesId}>
          <h2 id={sourcesId} className={styles.panelLabel}>
            Sources · {sources.length}
          </h2>
          <ul className={styles.sources}>
            {sources.map((source, index) => (
              <li key={`${index}-${source}`}>{source}</li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}
