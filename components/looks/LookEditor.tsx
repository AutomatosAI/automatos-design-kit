// The editor panel on the Looks page (Ember looks-01). Every control changes the active Look
// at once (and so the whole app); "Save as new look" keeps a named copy, "Reset" goes back to
// the picked Look's saved values.

import type { LookValues } from "@/lib/looks/editor";
import type { Look } from "@/lib/looks/types";

import styles from "./editor.module.css";
import { AccentOptions, GlowSlider, GroundOptions, LightOptions, ShellOptions, TypeOptions } from "./LookOptions";

export const EDITOR_LABEL = "Edit the look";
export const SAVE_LABEL = "Save as new look";
export const RESET_LABEL = "Reset";

export interface LookEditorProps {
  readonly look: Look;
  readonly onChange: (values: Partial<LookValues>) => void;
  readonly onSave: () => void;
  readonly onReset: () => void;
  /** False when the active Look has no preset or saved Look to go back to. */
  readonly canReset: boolean;
  /** Why the last save failed, in plain words. */
  readonly errors: readonly string[];
}

export function LookEditor({ look, onChange, onSave, onReset, canReset, errors }: LookEditorProps) {
  return (
    <aside className={styles.editor} aria-label={EDITOR_LABEL}>
      <AccentOptions look={look} onChange={onChange} />
      <GroundOptions look={look} onChange={onChange} />
      <TypeOptions look={look} onChange={onChange} />
      <ShellOptions look={look} onChange={onChange} />
      <LightOptions look={look} onChange={onChange} />
      <GlowSlider look={look} onChange={onChange} />
      {errors.length > 0 && (
        <div className={styles.errors} role="alert">
          <p className={styles.errorTitle}>That look wasn&apos;t saved.</p>
          <ul className={styles.errorList}>
            {errors.map((error, index) => (
              <li key={`${index}-${error}`}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      <div className={styles.actions}>
        <button type="button" className={styles.save} onClick={onSave}>
          {SAVE_LABEL}
        </button>
        <button type="button" className={styles.reset} onClick={onReset} disabled={!canReset}>
          {RESET_LABEL}
        </button>
      </div>
    </aside>
  );
}
