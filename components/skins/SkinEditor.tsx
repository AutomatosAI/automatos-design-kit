"use client";

// The Editor (PRD-004 K-004, K-006): design a skin with live feedback. Where to start, the
// details, the colours (light and dark side by side, with live contrast), the shape, the fonts
// and the mascot; beside them, Undo and Redo and a live preview with the skin applied through
// skinToCss. The draft is kept in this browser (localStorage) and its font and mascot files
// beside it (IndexedDB), so both survive a reload.

import { useEffect, useId, useRef } from "react";

import { browserStorage, type StorageSource } from "@/lib/looks/storage";
import { browserAssetStore, type AssetStore } from "@/lib/skins/asset-store";
import { FONTS_DIR, FONT_SLOTS } from "@/lib/skins/format";
import type { SkinDraft } from "@/lib/skins/model";

import { ColourGroups } from "./ColourGroups";
import { FontPickers } from "./FontPickers";
import { MascotPicker } from "./MascotPicker";
import { MetaFields } from "./MetaFields";
import { PREVIEW_HEADING, SkinPreviewStrip } from "./SkinPreviewStrip";
import { ShapeSliders } from "./ShapeSliders";
import { StartOptions } from "./StartOptions";
import styles from "./editor.module.css";
import { useSkinAssets, type SkinAssetsApi } from "./useSkinAssets";
import { useSkinEditor } from "./useSkinEditor";

export const EDITOR_HEADING = "Make a skin.";
export const KEPT_STATUS = "Your draft is kept in this browser.";
export const NOT_KEPT_STATUS = "This browser won't keep your draft, so it goes when you reload.";

export interface SkinEditorProps {
  /** Tests pass their own (or one that throws, for blocked storage). */
  readonly storage?: StorageSource;
  /** Where font and mascot files are kept; tests pass a memory store. */
  readonly assetStore?: AssetStore;
}

/** Font files the draft no longer names (a font replaced before the last reload). */
function unusedFonts(draft: SkinDraft, assets: SkinAssetsApi): readonly string[] {
  const named = new Set(FONT_SLOTS.flatMap((slot) => draft.fonts[slot] ?? []));
  return [...assets.assets.keys()].filter((path) => path.startsWith(FONTS_DIR) && !named.has(path));
}

/** Once both the draft and its files are read, drops font files nothing names (undo can't reach them). */
function usePruneFonts(draft: SkinDraft, draftLoaded: boolean, assets: SkinAssetsApi): void {
  const pruned = useRef(false);
  useEffect(() => {
    if (pruned.current || !draftLoaded || !assets.loaded) return;
    pruned.current = true;
    const unused = unusedFonts(draft, assets);
    if (unused.length > 0) void assets.remove(unused);
  }, [draft, draftLoaded, assets]);
}

export function SkinEditor({ storage = browserStorage, assetStore = browserAssetStore }: SkinEditorProps) {
  const editor = useSkinEditor(storage);
  const assets = useSkinAssets(assetStore);
  const { draft, edit, endGroup } = editor;
  const previewId = useId();
  usePruneFonts(draft, editor.loaded, assets);

  return (
    <div className={styles.screen}>
      <main className={styles.main}>
        <header className={styles.header}>
          <h1 className={styles.heading}>{EDITOR_HEADING}</h1>
          <p className={styles.lead}>Start from Studio&apos;s own look, change what you like, and watch it live.</p>
          <p className={styles.status} role="status">
            {editor.kept ? KEPT_STATUS : NOT_KEPT_STATUS}
          </p>
          {assets.notice && <p className={styles.status}>{assets.notice}</p>}
        </header>
        <StartOptions onStart={(next) => edit(() => next)} />
        <MetaFields draft={draft} onEdit={edit} onEndGroup={endGroup} />
        <ColourGroups draft={draft} onEdit={edit} onEndGroup={endGroup} />
        <ShapeSliders draft={draft} onEdit={edit} onEndGroup={endGroup} />
        <FontPickers draft={draft} onEdit={edit} assets={assets} />
        <MascotPicker draft={draft} onEdit={edit} assets={assets} />
      </main>
      <aside className={styles.side} aria-labelledby={previewId}>
        <div className={styles.sideHead}>
          <h2 id={previewId} className={styles.sectionTitle}>
            {PREVIEW_HEADING}
          </h2>
          <div className={styles.history} role="group" aria-label="History">
            <button
              type="button"
              className={styles.historyButton}
              disabled={!editor.canUndo}
              aria-keyshortcuts="Control+Z Meta+Z"
              onClick={editor.undo}
            >
              Undo
            </button>
            <button
              type="button"
              className={styles.historyButton}
              disabled={!editor.canRedo}
              aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
              onClick={editor.redo}
            >
              Redo
            </button>
          </div>
        </div>
        <SkinPreviewStrip draft={draft} loaded={editor.loaded} fontUrls={assets.urls} />
      </aside>
    </div>
  );
}
