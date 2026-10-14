"use client";

// Where a skin starts: Studio's own look, Classic's, or an example skin. Starting again replaces
// the draft as one step, so Undo brings the old one back.

import { useId } from "react";

import { BASES } from "@/lib/skins/format";
import { EXAMPLE_SKINS } from "@/lib/skins/examples";
import { startDraft, type SkinDraft } from "@/lib/skins/model";

import { BASE_LABELS } from "./ColourRow";
import styles from "./editor.module.css";

export const START_HEADING = "Start from";

export interface StartOptionsProps {
  readonly onStart: (draft: SkinDraft) => void;
}

export function StartOptions({ onStart }: StartOptionsProps) {
  const headingId = useId();
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.sectionTitle}>
        {START_HEADING}
      </h2>
      <div className={styles.choices}>
        {BASES.map((base) => (
          <button key={base} type="button" className={styles.choice} onClick={() => onStart(startDraft(base))}>
            Start from {BASE_LABELS[base]}
          </button>
        ))}
        {EXAMPLE_SKINS.map((example) => (
          <button key={example.slug} type="button" className={styles.choice} onClick={() => onStart(example.draft)}>
            Start from {example.name}
          </button>
        ))}
      </div>
      <p className={styles.note}>Starting again replaces your draft. Undo brings it back.</p>
    </section>
  );
}
