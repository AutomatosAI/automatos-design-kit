"use client";

// Export and share (PRD-004 K-007): Export downloads the draft as a .autoskin (the same file as
// npm run pack), Import loads one back, Load into my Automatos and Submit to the Marketplace send
// it to the person's own Automatos through the kit's proxy. Results and refusals are text only.

import { useId } from "react";

import { LookNotice } from "@/components/looks/LookNotice";
import { MARKETPLACE_URL } from "@/lib/client/skins";
import type { SkinDraft } from "@/lib/skins/model";
import { AUTOSKIN_EXTENSION } from "@/lib/skins/pack";

import styles from "./pack.module.css";
import editorStyles from "./editor.module.css";
import type { SkinAssetsApi } from "./useSkinAssets";
import { usePackActions } from "./usePackActions";

export const PACK_HEADING = "Export and share";
export const EXPORT_LABEL = "Export .autoskin";
export const IMPORT_LABEL = "Import a .autoskin";
export const LOAD_LABEL = "Load into my Automatos";
export const SUBMIT_LABEL = "Submit to the Marketplace";
export const MARKETPLACE_LINK = "Open my Automatos Marketplace";

export interface PackPanelProps {
  readonly draft: SkinDraft;
  readonly assets: SkinAssetsApi;
  /** An imported skin replaces the draft (one undo step). */
  readonly onImport: (draft: SkinDraft) => void;
}

export function PackPanel({ draft, assets, onImport }: PackPanelProps) {
  const headingId = useId();
  const actions = usePackActions(draft, assets, onImport);
  const onChosen = (input: HTMLInputElement) => {
    const file = input.files?.[0];
    // Cleared, so choosing the same file again is a change too.
    input.value = "";
    if (file) void actions.importFile(file);
  };

  return (
    <section className={editorStyles.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={editorStyles.sectionTitle}>
        {PACK_HEADING}
      </h2>
      <p className={editorStyles.note}>
        Export writes the same {AUTOSKIN_EXTENSION} file as npm run pack. Load and Submit need your Automatos running, with
        skins (PRD-259).
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.action} onClick={actions.exportSkin}>
          {EXPORT_LABEL}
        </button>
        <button type="button" className={styles.action} disabled={actions.busy !== null} onClick={() => void actions.send("import")}>
          {LOAD_LABEL}
        </button>
        <button type="button" className={styles.action} disabled={actions.busy !== null} onClick={() => void actions.send("submit")}>
          {SUBMIT_LABEL}
        </button>
        <a className={styles.link} href={MARKETPLACE_URL} target="_blank" rel="noopener noreferrer">
          {MARKETPLACE_LINK}
        </a>
      </div>
      <label className={styles.fileField}>
        <span>{IMPORT_LABEL}</span>
        <input
          className={styles.fileInput}
          type="file"
          accept={`${AUTOSKIN_EXTENSION},.zip,application/zip`}
          onChange={(event) => onChosen(event.currentTarget)}
        />
      </label>
      <LookNotice notice={actions.notice} />
    </section>
  );
}
