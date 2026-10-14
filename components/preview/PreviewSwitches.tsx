"use client";

// The gallery's switches: the base (Studio / Classic), the tone (Light / Dark) and "Compare with
// Studio". They change only what the gallery shows, never the draft.

import { BASE_LABELS, TONE_LABELS } from "@/components/skins/ColourRow";
import { BASES, TONES, type SkinBase, type Tone } from "@/lib/skins/format";

import { COMPARE_LABEL } from "./content";
import styles from "./screen.module.css";

export interface GalleryOptions {
  readonly base: SkinBase;
  readonly tone: Tone;
  readonly compare: boolean;
}

export interface PreviewSwitchesProps {
  readonly options: GalleryOptions;
  readonly onChange: (next: GalleryOptions) => void;
}

export function PreviewSwitches({ options, onChange }: PreviewSwitchesProps) {
  return (
    <div className={styles.switches}>
      <div className={styles.switchGroup} role="group" aria-label="Base">
        <span className={styles.switchLabel}>Base</span>
        {BASES.map((base) => (
          <button
            key={base}
            type="button"
            className={styles.switch}
            aria-pressed={options.base === base}
            onClick={() => onChange({ ...options, base })}
          >
            {BASE_LABELS[base]}
          </button>
        ))}
      </div>
      <div className={styles.switchGroup} role="group" aria-label="Tone">
        <span className={styles.switchLabel}>Tone</span>
        {TONES.map((tone) => (
          <button
            key={tone}
            type="button"
            className={styles.switch}
            aria-pressed={options.tone === tone}
            onClick={() => onChange({ ...options, tone })}
          >
            {TONE_LABELS[tone]}
          </button>
        ))}
      </div>
      <button
        type="button"
        className={styles.switch}
        aria-pressed={options.compare}
        onClick={() => onChange({ ...options, compare: !options.compare })}
      >
        {COMPARE_LABEL}
      </button>
    </div>
  );
}
