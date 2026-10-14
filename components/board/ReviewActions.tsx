"use client";

// Approve and Reject on a Task in Review (B-003). Reject asks, in the card, what the
// agent should fix; the answer goes back with the Task (POST /reject {feedback}).

import { type FormEvent, useEffect, useId, useRef, useState } from "react";

import type { BoardTask } from "@/lib/board/types";

import styles from "./board.module.css";

export const APPROVE = "Approve";
export const REJECT = "Reject";
export const FEEDBACK_LABEL = "What should it fix?";
export const SEND_BACK = "Reject and send back";
export const KEEP = "Keep it in Review";

export interface ReviewActionsProps {
  readonly task: BoardTask;
  readonly busy: boolean;
  readonly onApprove: (task: BoardTask) => void;
  readonly onReject: (task: BoardTask, feedback: string) => void;
}

export function ReviewActions({ task, busy, onApprove, onReject }: ReviewActionsProps) {
  const [asking, setAsking] = useState(false);
  const [feedback, setFeedback] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);
  const rejectButton = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);
  const fieldId = useId();

  useEffect(() => {
    if (asking) field.current?.focus();
    else if (refocus.current) rejectButton.current?.focus();
    refocus.current = false;
  }, [asking]);

  const send = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAsking(false);
    onReject(task, feedback.trim());
    setFeedback("");
  };

  const keep = () => {
    refocus.current = true;
    setAsking(false);
  };

  if (asking) {
    return (
      <form className={styles.rejectForm} aria-label={`${REJECT} ${task.title}`} onSubmit={send}>
        <label htmlFor={fieldId} className={styles.fieldLabel}>
          {FEEDBACK_LABEL}
        </label>
        <textarea
          ref={field}
          id={fieldId}
          className={styles.textArea}
          rows={3}
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
        />
        <div className={styles.cardActions}>
          <button type="submit" className={styles.cardButton} disabled={busy}>
            {SEND_BACK}
          </button>
          <button type="button" className={styles.cardButton} onClick={keep}>
            {KEEP}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className={styles.cardActions}>
      <button type="button" className={styles.approve} disabled={busy} onClick={() => onApprove(task)}>
        {APPROVE}
      </button>
      <button
        ref={rejectButton}
        type="button"
        className={styles.cardButton}
        disabled={busy}
        onClick={() => setAsking(true)}
      >
        {REJECT}
      </button>
    </div>
  );
}
