"use client";

// The Preview (PRD-004 K-005): the editor's draft on a gallery of Studio-shaped components,
// with its font files (K-006) registered through the FontFace API (useSkinFontFaces), coloured
// by the same CSS Studio will generate (lib/skins/preview.ts over skinToCss). The switches pick
// the base and tone the gallery shows, and "Compare with Studio" puts Studio as it ships beside
// the skin. They start from the draft's own base and first tone; a one-tone skin locks its tone,
// as Studio does (decision K4).
//
// The stylesheet is rendered only once the draft is read from storage, so the server never
// renders it.

import { useMemo, useState } from "react";

import { BASE_LABELS, TONE_LABELS } from "@/components/skins/ColourRow";
import { useSkinAssets } from "@/components/skins/useSkinAssets";
import { useSkinFontFaces } from "@/components/skins/useSkinFontFaces";
import { browserStorage, type StorageSource } from "@/lib/looks/storage";
import { browserAssetStore, type AssetStore } from "@/lib/skins/asset-store";
import type { FontHost } from "@/lib/skins/font-faces";
import type { SkinBase } from "@/lib/skins/format";
import type { SkinDraft } from "@/lib/skins/model";
import { baseScopeId, frameSkins, lockedTone, previewCss, shownTone } from "@/lib/skins/preview";

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
export function galleryNotes(draft: SkinDraft, base: SkinBase): readonly string[] {
  const baseNote =
    base === draft.base
      ? []
      : [`Your skin is built on ${BASE_LABELS[draft.base]}. This shows its colours over ${BASE_LABELS[base]}.`];
  const locked = lockedTone(draft.tones);
  const toneNote =
    locked === null ? [] : [`Your skin is ${TONE_LABELS[locked]} only, so Studio locks ${TONE_LABELS[locked]} while it's on.`];
  return [...baseNote, ...toneNote];
}

export interface PreviewScreenProps {
  /** Tests pass their own (or one that throws, for blocked storage). */
  readonly storage?: StorageSource;
  /** Where the editor keeps font files; tests pass a memory store. */
  readonly assetStore?: AssetStore;
  /** Where the draft's font files are registered (FontFace); tests pass a fake. Default: the browser's. */
  readonly fontHost?: FontHost | null;
}

export function PreviewScreen({ storage = browserStorage, assetStore = browserAssetStore, fontHost }: PreviewScreenProps) {
  const { draft, loaded } = useStoredDraft(storage);
  const { assets } = useSkinAssets(assetStore);
  useSkinFontFaces(draft.fonts, assets, fontHost);
  const [chosen, setChosen] = useState<GalleryOptions | null>(null);
  const asked = chosen ?? initialOptions(draft);
  const locked = lockedTone(draft.tones);
  const options: GalleryOptions = { ...asked, tone: shownTone(draft.tones, asked.tone) };
  const { base, tone, compare } = options;
  const css = useMemo(() => previewCss(draft, base), [draft, base]);
  const notes = galleryNotes(draft, base);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.heading}>{GALLERY_HEADING}</h1>
        <p className={styles.lead}>{GALLERY_LEAD}</p>
      </header>
      <PreviewSwitches options={options} locked={locked} onChange={setChosen} />
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
