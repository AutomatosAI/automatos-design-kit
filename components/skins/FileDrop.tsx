"use client";

// A place to drop files (or a folder), with plain file inputs for the keyboard and for anyone
// who doesn't drag. The folder input sets webkitdirectory through a ref: React's input props
// don't name it.

import { useState, type DragEvent } from "react";

import styles from "./assets.module.css";
import { droppedFiles } from "./files";

export interface FileDropProps {
  /** The file input's label, e.g. "Choose a .woff2 file for Sans". */
  readonly label: string;
  readonly hint: string;
  readonly accept: string;
  readonly multiple?: boolean;
  /** Also offer "Choose a folder". */
  readonly folderLabel?: string;
  readonly onFiles: (files: readonly File[]) => void;
  /** A drop that couldn't be opened, in words. */
  readonly onFailed: (message: string) => void;
}

export const DROP_FAILED = "Those files couldn't be opened. Try choosing them with the button instead.";

function allowFolder(input: HTMLInputElement | null): void {
  input?.setAttribute("webkitdirectory", "");
}

export function FileDrop({ label, hint, accept, multiple = false, folderLabel, onFiles, onFailed }: FileDropProps) {
  const [over, setOver] = useState(false);

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setOver(true);
  };
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setOver(false);
    droppedFiles(event.dataTransfer)
      .then((files) => {
        if (files.length > 0) onFiles(multiple ? files : files.slice(0, 1));
      })
      .catch((error: unknown) => {
        console.error("[skins] the dropped files couldn't be opened:", error);
        onFailed(DROP_FAILED);
      });
  };
  const onChosen = (input: HTMLInputElement) => {
    const files = input.files ? [...input.files] : [];
    // Cleared, so choosing the same file again is a change too.
    input.value = "";
    if (files.length > 0) onFiles(files);
  };

  return (
    <div className={styles.drop} data-over={over || undefined} onDragOver={onDragOver} onDragLeave={() => setOver(false)} onDrop={onDrop}>
      <p className={styles.dropHint}>{hint}</p>
      <div className={styles.dropInputs}>
        <label className={styles.fileField}>
          <span>{label}</span>
          <input
            className={styles.fileInput}
            type="file"
            accept={accept}
            multiple={multiple}
            onChange={(event) => onChosen(event.currentTarget)}
          />
        </label>
        {folderLabel && (
          <label className={styles.fileField}>
            <span>{folderLabel}</span>
            <input
              ref={allowFolder}
              className={styles.fileInput}
              type="file"
              multiple
              onChange={(event) => onChosen(event.currentTarget)}
            />
          </label>
        )}
      </div>
    </div>
  );
}
