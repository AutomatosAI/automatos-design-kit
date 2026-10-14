"use client";

// The in-page delete confirmation (PRD-003 design rule 6): it first asks the backend what
// the delete takes with it (GET /delete-impact) and says so, then Delete or Keep. Focus
// starts on Keep; the page puts it back on Delete when Keep closes the panel.

import { useCallback, useEffect, useRef } from "react";

import { useLoad } from "@/hooks/useLoad";
import type { ApiClient } from "@/lib/client/api";
import { impactWords } from "@/lib/documents/knowledge";

import pageStyles from "../page/page.module.css";
import styles from "./knowledge.module.css";

export const DELETE_QUESTION = "Delete this document?";
export const CONFIRM_DELETE = "Delete document";
export const DELETING = "Deleting…";
export const KEEP = "Keep it";
export const COUNTING = "Counting what goes with it…";
export const IMPACT_FAILED = "Play couldn't count what goes with it.";

export interface DeleteConfirmProps {
  readonly client: ApiClient;
  readonly id: number;
  readonly busy: boolean;
  /** The delete itself failed: the sentence to show. */
  readonly error: string | null;
  readonly onConfirm: () => void;
  readonly onKeep: () => void;
}

export function DeleteConfirm({ client, id, busy, error, onConfirm, onKeep }: DeleteConfirmProps) {
  const load = useCallback(() => client.deleteImpact(id), [client, id]);
  const impact = useLoad(load, IMPACT_FAILED, "knowledge");
  const keep = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    keep.current?.focus();
  }, []);

  return (
    <form
      className={styles.panel}
      aria-label={CONFIRM_DELETE}
      onSubmit={(event) => {
        event.preventDefault();
        onConfirm();
      }}
    >
      <p className={styles.question}>{DELETE_QUESTION}</p>
      {impact.status === "loading" && (
        <p className={styles.note} role="status">
          {COUNTING}
        </p>
      )}
      {impact.status === "ready" && <p className={styles.note}>{impactWords(impact.value)}</p>}
      {impact.status === "failed" && <p className={styles.alert}>{impact.error}</p>}
      {error && (
        <p className={styles.alert} role="alert">
          <span aria-hidden="true">✕</span> {error}
        </p>
      )}
      <div className={styles.panelActions}>
        <button type="submit" className={styles.confirm} disabled={busy || impact.status === "loading"}>
          {busy ? DELETING : CONFIRM_DELETE}
        </button>
        <button type="button" ref={keep} className={pageStyles.secondary} onClick={onKeep}>
          {KEEP}
        </button>
      </div>
    </form>
  );
}
