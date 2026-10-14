"use client";

// Giving Auto a document (PRD-003 P-010): a drop zone with a Choose button behind which
// sits the file picker. The page checks the type and the size before anything is sent
// (lib/documents/rules.ts); one file at a time.

import { type ChangeEvent, type DragEvent, useId, useRef, useState } from "react";

import { ACCEPT_ATTRIBUTE } from "@/lib/documents/rules";

import styles from "./knowledge.module.css";

export const UPLOAD_TITLE = "Give Auto a document";
export const UPLOAD_HINT = "Drop a file here, or choose one. PDF, Word, text, Markdown, CSV, HTML, JSON or Excel, up to 50 MB.";
export const CHOOSE = "Choose a file";
export const PICKER_LABEL = "File to upload";

export interface UploadPanelProps {
  /** An upload is on its way: no second one until it answers. */
  readonly busy: boolean;
  readonly onFile: (file: File) => void;
}

export function UploadPanel({ busy, onFile }: UploadPanelProps) {
  const picker = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const titleId = useId();

  const onPick = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    // Cleared at once, so the same file can be chosen again (after a refusal).
    input.value = "";
    if (file) onFile(file);
  };

  const onDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (!busy) setOver(true);
  };

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setOver(false);
    const file = event.dataTransfer.files[0];
    if (file && !busy) onFile(file);
  };

  return (
    <section
      className={styles.dropZone}
      aria-labelledby={titleId}
      data-over={over ? "true" : "false"}
      onDragOver={onDragOver}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <div className={styles.dropText}>
        <h2 id={titleId} className={styles.uploadTitle}>
          {UPLOAD_TITLE}
        </h2>
        <p className={styles.hint}>{UPLOAD_HINT}</p>
      </div>
      <button type="button" className={styles.choose} disabled={busy} onClick={() => picker.current?.click()}>
        {CHOOSE}
      </button>
      <input
        ref={picker}
        type="file"
        className={styles.fileInput}
        accept={ACCEPT_ATTRIBUTE}
        aria-label={PICKER_LABEL}
        hidden
        onChange={onPick}
      />
    </section>
  );
}
