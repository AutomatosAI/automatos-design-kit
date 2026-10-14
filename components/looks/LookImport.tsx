"use client";

// "Import a look" on the Looks page (PRD-002 L-005): pasted JSON or a chosen .json file goes
// through lib/looks/transfer.ts (size check, JSON, validateLook, fresh id). A valid Look is
// added to the saved Looks and picked; an invalid one adds nothing and lists the reasons.

import { type ChangeEvent, type FormEvent, useEffect, useId, useRef, useState } from "react";

import { importLook, readLookFile } from "@/lib/looks/transfer";
import type { ValidationResult } from "@/lib/looks/types";

import { useLook } from "./LookProvider";
import { LookNotice, type Notice, failed } from "./LookNotice";
import styles from "./manage.module.css";

export const IMPORT_LABEL = "Import a look";
export const PASTE_LABEL = "Paste a Look's JSON";
export const FILE_LABEL = "Or choose a .json file";
export const IMPORT_PASTED = "Import pasted JSON";

const NOT_ADDED = "That look wasn't added.";

/** The paste box's text, the last outcome, and the two ways in. */
function useImport() {
  const { saved, saveLook, setLook } = useLook();
  const [text, setText] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  // Reading a file takes a moment: its fresh id must come from the saved Looks after the read.
  const savedNow = useRef(saved);
  useEffect(() => {
    savedNow.current = saved;
  }, [saved]);

  const add = (imported: ValidationResult): boolean => {
    const result = imported.ok ? saveLook(imported.look) : imported;
    if (!result.ok) {
      setNotice(failed(NOT_ADDED, result.errors));
      return false;
    }
    setLook(result.look);
    setNotice({ kind: "done", text: `Added ${result.look.name} to your Looks.` });
    return true;
  };

  const importPasted = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (add(importLook(text, saved))) setText("");
  };

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    // Cleared at once, so choosing the same file again (after fixing it) imports it again.
    input.value = "";
    if (!file) return;
    const read = await readLookFile(file);
    add(read.ok ? importLook(read.text, savedNow.current) : read);
  };

  return { text, setText, notice, importPasted, importFile };
}

export function LookImport() {
  const { text, setText, notice, importPasted, importFile } = useImport();
  const headingId = useId();
  const pasteId = useId();
  const fileId = useId();

  return (
    <section className={styles.manage} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.label}>
        {IMPORT_LABEL}
      </h2>
      <form className={styles.form} onSubmit={importPasted}>
        <label htmlFor={pasteId} className={styles.fieldLabel}>
          {PASTE_LABEL}
        </label>
        <textarea
          id={pasteId}
          className={styles.paste}
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={4}
          spellCheck={false}
          autoComplete="off"
        />
        <div className={styles.formActions}>
          <button type="submit" className={styles.action}>
            {IMPORT_PASTED}
          </button>
        </div>
      </form>
      <div className={styles.form}>
        <label htmlFor={fileId} className={styles.fieldLabel}>
          {FILE_LABEL}
        </label>
        <input
          id={fileId}
          type="file"
          accept=".json,application/json"
          className={styles.file}
          onChange={(event) => void importFile(event)}
        />
      </div>
      <LookNotice notice={notice} />
    </section>
  );
}
