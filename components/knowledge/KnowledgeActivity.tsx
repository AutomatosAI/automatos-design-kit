"use client";

// What is happening on the Knowledge page right now: Auto (reading, searching, celebrating,
// oops: lib/documents/upload.ts knowledgeMascot) and the upload's own line, with its bar
// while the bytes go. Nothing at all while nothing is happening: Auto isn't on the list.

import Link from "next/link";

import { AutoMascot } from "@/components/mascot/AutoMascot";
import { ProgressBar } from "@/components/page/parts";
import { documentHref } from "@/lib/documents/knowledge";
import { phaseWords, type UploadPhase } from "@/lib/documents/upload";
import type { MascotName } from "@/lib/mascot/types";

import pageStyles from "../page/page.module.css";
import styles from "./knowledge.module.css";

export const UPLOAD_PROGRESS = "Upload";
export const OPEN_IT = "Open it";
export const DISMISS = "Dismiss";

export interface KnowledgeActivityProps {
  readonly upload: UploadPhase;
  /** Auto's state, or null when he has nothing to do here. */
  readonly mascot: MascotName | null;
  readonly caption: string;
  /** The query, under Auto's caption while he searches. */
  readonly detail?: string;
  readonly onClipEnded: (state: MascotName) => void;
  readonly onDismiss: () => void;
}

export function KnowledgeActivity({ upload, mascot, caption, detail, onClipEnded, onDismiss }: KnowledgeActivityProps) {
  if (mascot === null && upload.kind === "idle") return null;
  return (
    <div className={styles.activity}>
      {mascot !== null && (
        <div className={styles.activityAuto}>
          <AutoMascot state={mascot} caption={caption} detail={detail} onClipEnded={onClipEnded} size="small" />
        </div>
      )}
      {upload.kind !== "idle" && <UploadLine upload={upload} onDismiss={onDismiss} />}
    </div>
  );
}

interface UploadLineProps {
  readonly upload: Exclude<UploadPhase, { readonly kind: "idle" }>;
  readonly onDismiss: () => void;
}

function UploadLine({ upload, onDismiss }: UploadLineProps) {
  const failed = upload.kind === "failed" || upload.kind === "refused";
  const settled = failed || upload.kind === "done";
  return (
    <div className={styles.activityBody}>
      {upload.kind === "sending" ? (
        <ProgressBar
          name={UPLOAD_PROGRESS}
          value={upload.progress.loaded}
          max={upload.progress.total}
          label={phaseWords(upload)}
        />
      ) : (
        <p className={styles.phase} data-failed={failed ? "true" : undefined} role={failed ? "alert" : undefined}>
          {failed && <span aria-hidden="true">✕ </span>}
          {phaseWords(upload)}
        </p>
      )}
      {settled && (
        <div className={styles.phaseActions}>
          {upload.kind === "done" && (
            <Link href={documentHref(upload.documentId)} className={pageStyles.secondary}>
              {OPEN_IT}
            </Link>
          )}
          <button type="button" className={pageStyles.secondary} onClick={onDismiss}>
            {DISMISS}
          </button>
        </div>
      )}
    </div>
  );
}
