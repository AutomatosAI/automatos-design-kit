"use client";

// The editor's side preview: a few Studio-shaped components (a nav, a card, buttons, a field,
// badges and a chart) in a frame per tone the skin keeps, drawn with Studio's own token names
// (hsl(var(--card)) and so on) and coloured by the draft's stylesheet from skinToCss, scoped to
// the frames (lib/skins/preview.ts). It's a picture: nothing in it can be focused or pressed.
//
// The stylesheet is rendered only once the draft is read from storage, so the server never
// renders it: the page's first paint is the same with or without a stored draft.

import { useMemo } from "react";

import type { Tone } from "@/lib/skins/format";
import type { SkinDraft } from "@/lib/skins/model";
import { PREVIEW_ATTRIBUTE, TONE_ATTRIBUTE, frameSkins, previewCss } from "@/lib/skins/preview";

import { TONE_LABELS } from "./ColourRow";
import styles from "./preview.module.css";

export const PREVIEW_HEADING = "Live preview";
export const SKIN_CSS_TEST_ID = "skin-css";

const BARS = [styles.bar1, styles.bar2, styles.bar3, styles.bar4, styles.bar5];

function Frame({ draft, tone }: { readonly draft: SkinDraft; readonly tone: Tone }) {
  const attributes = { [PREVIEW_ATTRIBUTE]: frameSkins(draft.base), [TONE_ATTRIBUTE]: tone };
  return (
    <figure className={styles.frame} aria-label={`${TONE_LABELS[tone]} preview`} {...attributes}>
      <figcaption className={styles.caption}>{TONE_LABELS[tone]}</figcaption>
      <div className={styles.nav} aria-hidden="true">
        <span className={styles.navActive}>Chat</span>
        <span className={styles.navItem}>Agents</span>
        <span className={styles.navItem}>Missions</span>
      </div>
      <div className={styles.card}>
        <span className={styles.cardTitle}>Weekly report</span>
        <span className={styles.cardText}>Three Deliverables are ready to read.</span>
        <div className={styles.badges}>
          <span className={styles.success}>Done</span>
          <span className={styles.warning}>Waiting</span>
          <span className={styles.info}>Running</span>
          <span className={styles.agent}>Agent</span>
        </div>
      </div>
      <div className={styles.buttons}>
        <span className={styles.primary}>New Mission</span>
        <span className={styles.secondary}>Share</span>
        <span className={styles.outline}>Cancel</span>
        <span className={styles.destructive}>Delete</span>
      </div>
      <span className={styles.field}>Message Auto</span>
      <div className={styles.chart} aria-hidden="true">
        {BARS.map((bar, index) => (
          <span key={index} className={bar} />
        ))}
      </div>
    </figure>
  );
}

export interface SkinPreviewStripProps {
  readonly draft: SkinDraft;
  /** False until storage has been read: no stylesheet before then. */
  readonly loaded: boolean;
}

export function SkinPreviewStrip({ draft, loaded }: SkinPreviewStripProps) {
  const css = useMemo(() => previewCss(draft), [draft]);
  return (
    <div className={styles.strip}>
      {loaded && <style data-testid={SKIN_CSS_TEST_ID}>{css}</style>}
      {draft.tones.map((tone) => (
        <Frame key={tone} draft={draft} tone={tone} />
      ))}
    </div>
  );
}
