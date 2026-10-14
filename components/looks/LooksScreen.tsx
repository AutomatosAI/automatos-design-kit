"use client";

// The Looks page, "Make it yours." (PRD-002 L-004, Ember looks-01): the heading with the active
// Look's name, a live preview with Auto, the Looks row, the picked Look's actions and Import
// (L-005), and the editor. Every change goes through LookProvider's setLook, which re-themes
// the whole app at once, not only the preview.

import { useState } from "react";

import { asNewLook, baseLook, statusLine, withValues, type LookValues } from "@/lib/looks/editor";
import { PRESETS } from "@/lib/looks/presets";
import type { Look } from "@/lib/looks/types";

import { LookEditor } from "./LookEditor";
import { LookImport } from "./LookImport";
import { LookManager } from "./LookManager";
import { useLook } from "./LookProvider";
import { LookPreview } from "./LookPreview";
import { LooksRow } from "./LooksRow";
import styles from "./looks.module.css";

export const LOOKS_HEADING = "Make it yours.";

export function LooksScreen() {
  const { look, saved, setLook, saveLook } = useLook();
  const [errors, setErrors] = useState<readonly string[]>([]);

  const pick = (next: Look) => {
    setErrors([]);
    setLook(next);
  };

  const change = (values: Partial<LookValues>) => setLook(withValues(look, values));

  const saveAsNew = () => {
    const result = saveLook(asNewLook(look, saved));
    if (result.ok) {
      setErrors([]);
      setLook(result.look);
      return;
    }
    console.warn("[looks] Save as new look was refused:", result.errors);
    setErrors(result.errors);
  };

  const base = baseLook(look, saved);
  const reset = () => {
    setErrors([]);
    if (base) setLook(base);
  };

  return (
    <div className={styles.screen}>
      <main className={styles.main}>
        <div className={styles.header}>
          <div className={styles.headingText}>
            <h1 className={styles.heading}>{LOOKS_HEADING}</h1>
            <p className={styles.lead}>Pick a look, then tweak it. Auto changes with it.</p>
          </div>
          <p className={styles.status} role="status">
            {statusLine(look, saved)}
          </p>
        </div>
        <LookPreview />
        <LooksRow looks={[...PRESETS, ...saved]} activeId={look.id} onPick={pick} />
        <LookManager />
        <LookImport />
      </main>
      <LookEditor
        look={look}
        onChange={change}
        onSave={saveAsNew}
        onReset={reset}
        canReset={base !== undefined}
        errors={errors}
      />
    </div>
  );
}
