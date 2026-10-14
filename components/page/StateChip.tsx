// A state as words (PRD-003 design rule 3): a glyph and a word in a pill, never colour
// alone. The colour comes from the Look (page.module.css, data-tone); the glyph is hidden
// from screen readers, which hear the word.

import styles from "./page.module.css";

export type StateTone = "running" | "needs-you" | "done" | "failed" | "paused" | "queued" | "idle";

export const STATE_TONES: Readonly<Record<StateTone, { readonly glyph: string; readonly word: string }>> = {
  running: { glyph: "●", word: "Running" },
  "needs-you": { glyph: "◆", word: "Needs you" },
  done: { glyph: "✓", word: "Done" },
  failed: { glyph: "✕", word: "Failed" },
  paused: { glyph: "‖", word: "Paused" },
  queued: { glyph: "○", word: "Queued" },
  idle: { glyph: "—", word: "Idle" },
};

export interface StateChipProps {
  readonly tone: StateTone;
  /** A more exact word for the same tone ("Planning", "Processing"); the tone's word otherwise. */
  readonly label?: string;
}

export function StateChip({ tone, label }: StateChipProps) {
  const { glyph, word } = STATE_TONES[tone];
  return (
    <span className={styles.stateChip} data-tone={tone}>
      <span className={styles.stateGlyph} aria-hidden="true">
        {glyph}
      </span>
      {label ?? word}
    </span>
  );
}
