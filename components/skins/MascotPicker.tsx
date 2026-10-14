"use client";

// Mascot (PRD-004 K-006): Off, Auto (his shell tint and light colour), or Custom (the skin's
// own 12 states × webm, mp4 and png, dropped as files or a folder; checked for names, types by
// first bytes and the 8 MB total, and kept with the draft's other files). Auto and Custom are
// previewed on the existing mascot player with a state picker.

import { useId, useState } from "react";

import { colourStyle } from "@/components/looks/swatchStyle";
import { SHELLS, SHELL_KEYS } from "@/lib/looks/catalogue";
import {
  checkMascotDrop,
  isMascotFileName,
  isMascotPath,
  mascotDropSizeProblem,
  mascotSetSummary,
  type DroppedFile,
} from "@/lib/skins/assets";
import { MASCOT_MODES, type MascotMode } from "@/lib/skins/format";
import { LIGHT_SWATCHES, MASCOT_MODE_LABELS, lightKeyOf, shellOf, withLight, withMascotMode, withShell } from "@/lib/skins/mascot";
import { setMascot, type SkinDraft } from "@/lib/skins/model";

import type { EditDraft } from "./ColourRow";
import styles from "./assets.module.css";
import editorStyles from "./editor.module.css";
import { FileDrop } from "./FileDrop";
import { MAX_DROPPED_FILES, readDropped } from "./files";
import { MascotStage } from "./MascotStage";
import type { SkinAssetsApi } from "./useSkinAssets";

export const MASCOT_HEADING = "Mascot";
export const MASCOT_READ_FAILED = "Those files couldn't be read. Try choosing them again.";
export const REMOVE_MASCOT_FILES = "Remove the mascot files";

const MODE_NOTES: Readonly<Record<MascotMode, string>> = {
  off: "No mascot: Studio's chat shows none.",
  auto: "Auto, in your tint and light. His clips play here when they are in public/auto/; otherwise you see his stand-in.",
  custom: "Your own mascot: 12 states, each as .webm, .mp4 and .png, at most 8 MB together.",
};

interface PartProps {
  readonly draft: SkinDraft;
  readonly onEdit: EditDraft;
}

function ShellChoices({ draft, onEdit }: PartProps) {
  const chosen = shellOf(draft.mascot);
  return (
    <div className={editorStyles.choiceGroup} role="group" aria-label="Shell tint">
      <span className={editorStyles.choiceLabel}>Shell tint</span>
      {SHELL_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          className={editorStyles.choice}
          aria-pressed={chosen === key}
          onClick={() => onEdit((current: SkinDraft) => setMascot(current, withShell(current.mascot, key)))}
        >
          <span className={styles.swatch} style={colourStyle(SHELLS[key].hex)} aria-hidden="true" />
          {SHELLS[key].name}
        </button>
      ))}
    </div>
  );
}

function LightChoices({ draft, onEdit }: PartProps) {
  const chosen = lightKeyOf(draft.mascot.light);
  return (
    <div className={editorStyles.choiceGroup} role="group" aria-label="Light colour">
      <span className={editorStyles.choiceLabel}>Light</span>
      {LIGHT_SWATCHES.map((swatch) => (
        <button
          key={swatch.key}
          type="button"
          className={editorStyles.choice}
          aria-pressed={chosen === swatch.key}
          onClick={() => onEdit((current: SkinDraft) => setMascot(current, withLight(current.mascot, swatch.key)))}
        >
          <span className={styles.swatch} style={colourStyle(swatch.hex)} aria-hidden="true" />
          {swatch.name}
        </button>
      ))}
    </div>
  );
}

function CustomSet({ assets }: { readonly assets: SkinAssetsApi }) {
  const [problems, setProblems] = useState<readonly string[]>([]);
  const stored = [...assets.assets.values()].filter((asset) => isMascotPath(asset.path));
  const paths = new Set(stored.map((asset) => asset.path));

  const takeFiles = (chosen: readonly File[]) => {
    const files = chosen.slice(0, MAX_DROPPED_FILES);
    // Only the clips are read; other files are named as unused, never loaded.
    const clips = files.filter((file) => isMascotFileName(file.name));
    const others: readonly DroppedFile[] = files
      .filter((file) => !isMascotFileName(file.name))
      .map((file) => ({ name: file.name, bytes: new Uint8Array(0) }));
    const tooBig = mascotDropSizeProblem(clips.reduce((sum, file) => sum + file.size, 0));
    if (tooBig !== null) {
      setProblems([tooBig]);
      return;
    }
    readDropped(clips)
      .then((read) => {
        const result = checkMascotDrop(stored, [...read, ...others]);
        setProblems(result.problems);
        return result.accepted.length > 0 ? assets.add(result.accepted) : undefined;
      })
      .catch((error: unknown) => {
        console.error("[skins] the mascot files couldn't be read:", error);
        setProblems([MASCOT_READ_FAILED]);
      });
  };
  const removeAll = () => {
    setProblems([]);
    void assets.remove([...paths]);
  };

  return (
    <div className={styles.custom}>
      <FileDrop
        label="Choose mascot files"
        folderLabel="Choose a folder"
        hint="Drop the files or their folder here: hello.webm, hello.mp4, hello.png and so on for each state."
        accept=".webm,.mp4,.png,video/webm,video/mp4,image/png"
        multiple
        onFiles={takeFiles}
        onFailed={(message) => setProblems([message])}
      />
      <p className={styles.summary} aria-live="polite">
        {mascotSetSummary(paths)}
      </p>
      {problems.length > 0 && (
        <ul className={styles.problems} role="alert">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
      {paths.size > 0 && (
        <button type="button" className={editorStyles.choice} onClick={removeAll}>
          {REMOVE_MASCOT_FILES}
        </button>
      )}
    </div>
  );
}

export interface MascotPickerProps extends PartProps {
  readonly assets: SkinAssetsApi;
}

export function MascotPicker({ draft, onEdit, assets }: MascotPickerProps) {
  const headingId = useId();
  const { mode } = draft.mascot;
  return (
    <section className={editorStyles.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={editorStyles.sectionTitle}>
        {MASCOT_HEADING}
      </h2>
      <div className={editorStyles.choiceGroup} role="group" aria-label="Mascot">
        {MASCOT_MODES.map((option) => (
          <button
            key={option}
            type="button"
            className={editorStyles.choice}
            aria-pressed={mode === option}
            onClick={() => onEdit((current: SkinDraft) => setMascot(current, withMascotMode(current.mascot, option)))}
          >
            {MASCOT_MODE_LABELS[option]}
          </button>
        ))}
      </div>
      <p className={editorStyles.note}>{MODE_NOTES[mode]}</p>
      {mode === "auto" && <ShellChoices draft={draft} onEdit={onEdit} />}
      {mode !== "off" && <LightChoices draft={draft} onEdit={onEdit} />}
      {mode === "custom" && <CustomSet assets={assets} />}
      {mode !== "off" && <MascotStage mascot={draft.mascot} urls={assets.urls} />}
    </section>
  );
}
