"use client";

// The Preview (PRD-004 K-005): the editor's draft on a gallery of Studio-shaped components,
// coloured by the same CSS Studio will generate (lib/skins/preview.ts over skinToCss). The
// switches pick the base and tone the gallery shows, and "Compare with Studio" puts Studio as it
// ships beside the skin. They start from the draft's own base and first tone.
//
// The stylesheet is rendered only once the draft is read from storage, so the server never
// renders it.

import { useMemo, useState } from "react";

import { BASE_LABELS, TONE_LABELS } from "@/components/skins/ColourRow";
import { browserStorage, type StorageSource } from "@/lib/looks/storage";
import type { SkinBase, Tone } from "@/lib/skins/format";
import type { SkinDraft } from "@/lib/skins/model";
import { baseScopeId, frameSkins, previewCss } from "@/lib/skins/preview";

import { GALLERY_CSS_TEST_ID, GALLERY_HEADING, GALLERY_LEAD, SKIN_FRAME_LABEL } from "./content";
import { GalleryFrame } from "./GalleryFrame";
import { PreviewSwitches, type GalleryOptions } from "./PreviewSwitches";
import styles from "./screen.module.css";
import { useStoredDraft } from "./useStoredDraft";

export function initialOptions(draft: SkinDraft): GalleryOptions {
  return { base: draft.base, tone: draft.tones[0] ?? "light", compare: false };
}

/** The frame name for Studio's own palette, e.g. "Studio as it ships". */
export function shippedLabel(base: SkinBase): string {
  return `${BASE_LABELS[base]} as it ships`;
}

/** What the gallery shows that the skin itself doesn't say, in plain words (none when they agree). */
export function galleryNotes(draft: SkinDraft, base: SkinBase, tone: Tone): readonly string[] {
  const baseNote =
    base === draft.base
      ? []
      : [`Your skin is built on ${BASE_LABELS[draft.base]}. This shows its colours over ${BASE_LABELS[base]}.`];
  const toneNote = draft.tones.includes(tone)
    ? []
    : [`Your skin has no ${TONE_LABELS[tone]} colours, so ${TONE_LABELS[tone]} shows ${BASE_LABELS[base]}'s own.`];
  return [...baseNote, ...toneNote];
}

export interface PreviewScreenProps {
  /** Tests pass their own (or one that throws, for blocked storage). */
  readonly storage?: StorageSource;
}

export function PreviewScreen({ storage = browserStorage }: PreviewScreenProps) {
  const { draft, loaded } = useStoredDraft(storage);
  const [chosen, setChosen] = useState<GalleryOptions | null>(null);
  const options = chosen ?? initialOptions(draft);
  const { base, tone, compare } = options;
  const css = useMemo(() => previewCss(draft, base), [draft, base]);
  const notes = galleryNotes(draft, base, tone);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.heading}>{GALLERY_HEADING}</h1>
        <p className={styles.lead}>{GALLERY_LEAD}</p>
      </header>
      <PreviewSwitches options={options} onChange={setChosen} />
      {notes.map((note) => (
        <p key={note} className={styles.note}>
          {note}
        </p>
      ))}
      {loaded && <style data-testid={GALLERY_CSS_TEST_ID}>{css}</style>}
      <div className={compare ? styles.framesCompare : styles.frames}>
        {compare && <GalleryFrame label={shippedLabel(base)} skins={baseScopeId(base)} base={base} tone={tone} />}
        <GalleryFrame label={SKIN_FRAME_LABEL} skins={frameSkins(base)} base={base} tone={tone} />
      </div>
    </main>
  );
}
