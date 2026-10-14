"use client";

// The Editor (PRD-004 K-004): design a skin with live feedback. Where to start, the details,
// the colours (light and dark side by side, with live contrast), and the shape; beside them,
// Undo and Redo and a live preview with the skin applied through skinToCss. The draft is kept
// in this browser and survives a reload.

import { useId } from "react";

import { browserStorage, type StorageSource } from "@/lib/looks/storage";

import { ColourGroups } from "./ColourGroups";
import { MetaFields } from "./MetaFields";
import { PREVIEW_HEADING, SkinPreviewStrip } from "./SkinPreviewStrip";
import { ShapeSliders } from "./ShapeSliders";
import { StartOptions } from "./StartOptions";
import styles from "./editor.module.css";
import { useSkinEditor } from "./useSkinEditor";

export const EDITOR_HEADING = "Make a skin.";
export const KEPT_STATUS = "Your draft is kept in this browser.";
export const NOT_KEPT_STATUS = "This browser won't keep your draft, so it goes when you reload.";

export interface SkinEditorProps {
  /** Tests pass their own (or one that throws, for blocked storage). */
  readonly storage?: StorageSource;
}

export function SkinEditor({ storage = browserStorage }: SkinEditorProps) {
  const editor = useSkinEditor(storage);
  const { draft, edit, endGroup } = editor;
  const previewId = useId();

  return (
    <div className={styles.screen}>
      <main className={styles.main}>
        <header className={styles.header}>
          <h1 className={styles.heading}>{EDITOR_HEADING}</h1>
          <p className={styles.lead}>Start from Studio&apos;s own look, change what you like, and watch it live.</p>
          <p className={styles.status} role="status">
            {editor.kept ? KEPT_STATUS : NOT_KEPT_STATUS}
          </p>
        </header>
        <StartOptions onStart={(next) => edit(() => next)} />
        <MetaFields draft={draft} onEdit={edit} onEndGroup={endGroup} />
        <ColourGroups draft={draft} onEdit={edit} onEndGroup={endGroup} />
        <ShapeSliders draft={draft} onEdit={edit} onEndGroup={endGroup} />
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
        <SkinPreviewStrip draft={draft} loaded={editor.loaded} />
      </aside>
    </div>
  );
}
