"use client";

// The run page's header buttons: only the actions the Mission's state allows, each saying
// what it does. Cancel, Reject and Delete open a confirmation in the page (ConfirmPanel)
// instead of acting; when it closes without acting, focus comes back to its button.

import { type FormEvent, useEffect, useId, useRef, useState } from "react";

import type { RunBusy } from "@/hooks/useMissionRun";
import {
  ACTION_LABELS,
  CONFIRMATIONS,
  type ConfirmedAction,
  type HeaderAction,
  needsConfirming,
  REASON_LABEL,
  reasonProblem,
} from "@/lib/missions/run";

import pageStyles from "../page/page.module.css";
import styles from "./run.module.css";

export interface MissionRunActionsProps {
  readonly actions: readonly HeaderAction[];
  readonly busy: RunBusy;
  /** The confirmation open under the header, if any: no accent button up here meanwhile. */
  readonly confirming: ConfirmedAction | null;
  readonly onAction: (action: HeaderAction) => void;
}

export function MissionRunActions({ actions, busy, confirming, onAction }: MissionRunActionsProps) {
  const buttons = useRef(new Map<HeaderAction, HTMLButtonElement>());
  const previous = useRef<ConfirmedAction | null>(confirming);

  useEffect(() => {
    const closed = previous.current;
    previous.current = confirming;
    if (closed && !confirming) buttons.current.get(closed)?.focus();
  }, [confirming]);

  return (
    <>
      {actions.map((action) => (
        <button
          key={action}
          ref={(element) => {
            if (element) buttons.current.set(action, element);
            else buttons.current.delete(action);
          }}
          type="button"
          className={styles.action}
          data-primary={action === "approve" && !confirming ? "true" : undefined}
          disabled={busy !== null}
          aria-expanded={needsConfirming(action) ? confirming === action : undefined}
          onClick={() => onAction(action)}
        >
          {ACTION_LABELS[action]}
        </button>
      ))}
    </>
  );
}

export interface ConfirmPanelProps {
  readonly action: ConfirmedAction;
  readonly busy: boolean;
  /** The reason is "" except for Reject. */
  readonly onConfirm: (reason: string) => void;
  readonly onKeep: () => void;
}

/** The in-page confirmation: the question, the reason for a rejection, and the two ways out. */
export function ConfirmPanel({ action, busy, onConfirm, onKeep }: ConfirmPanelProps) {
  const { question, confirm, keep } = CONFIRMATIONS[action];
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const reasonId = useId();
  const first = useRef<HTMLTextAreaElement | HTMLButtonElement | null>(null);
  const problem = action === "reject" && tried ? reasonProblem(reason) : null;

  useEffect(() => {
    first.current?.focus();
  }, []);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTried(true);
    if (action === "reject" && reasonProblem(reason)) return;
    onConfirm(action === "reject" ? reason : "");
  };

  return (
    <form className={styles.panel} aria-label={confirm} onSubmit={submit} noValidate>
      <p className={styles.question}>{question}</p>
      {action === "reject" && (
        <>
          <label className={styles.fieldLabel} htmlFor={reasonId}>
            {REASON_LABEL}
          </label>
          <textarea
            id={reasonId}
            ref={(element) => {
              first.current = element;
            }}
            className={styles.reason}
            rows={3}
            value={reason}
            aria-invalid={problem ? true : undefined}
            onChange={(event) => setReason(event.target.value)}
          />
          {problem && (
            <p className={styles.alert} role="alert">
              {problem}
            </p>
          )}
        </>
      )}
      <div className={styles.panelActions}>
        <button type="submit" className={styles.confirm} disabled={busy}>
          {confirm}
        </button>
        <button
          type="button"
          ref={(element) => {
            if (action !== "reject") first.current = element;
          }}
          className={pageStyles.secondary}
          onClick={onKeep}
        >
          {keep}
        </button>
      </div>
    </form>
  );
}
