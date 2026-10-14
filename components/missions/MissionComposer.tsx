"use client";

// The in-page "New Mission" composer: the goal (1-10000 characters, with a counter),
// Start Mission -> POST /api/missions, then the new Mission's own page.

import { useRouter } from "next/navigation";
import { type ChangeEvent, type FormEvent, useEffect, useId, useRef, useState } from "react";

import { ApiError, type ApiClient } from "@/lib/client/api";
import { checkGoal, goalCounter, missionHref, tooLongSentence } from "@/lib/missions/list";

import pageStyles from "../page/page.module.css";
import styles from "./missions.module.css";

export const COMPOSER_TITLE = "New Mission";
export const GOAL_LABEL = "What should this Mission achieve?";
export const START = "Start Mission";
export const STARTING = "Starting…";
export const CLOSE = "Close";
export const START_FAILED = "Play couldn't start the Mission.";

export interface MissionComposerProps {
  readonly client: ApiClient;
  readonly onClose: () => void;
}

export function MissionComposer({ client, onClose }: MissionComposerProps) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const ids = { field: useId(), counter: useId(), problem: useId() };
  const check = checkGoal(draft);
  const tooLongBy = !check.ok && check.reason === "too-long" ? check.length : null;
  const tooLong = tooLongBy !== null;

  useEffect(() => {
    field.current?.focus();
  }, []);

  const onInput = (event: ChangeEvent<HTMLTextAreaElement>) => setDraft(event.target.value);

  const start = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!check.ok || starting) return;
    setStarting(true);
    setError(null);
    try {
      const mission = await client.createMission({ goal: check.goal });
      router.push(missionHref(mission.id));
    } catch (failure) {
      console.error(`[missions] ${START_FAILED}`, failure);
      setError(failure instanceof ApiError ? `${START_FAILED} ${failure.message}` : START_FAILED);
      setStarting(false);
    }
  };

  return (
    <form className={styles.composer} aria-label={COMPOSER_TITLE} onSubmit={start}>
      <label htmlFor={ids.field} className={styles.goalLabel}>
        {GOAL_LABEL}
      </label>
      <textarea
        ref={field}
        id={ids.field}
        className={styles.goalInput}
        rows={4}
        value={draft}
        onChange={onInput}
        aria-invalid={tooLong}
        aria-describedby={tooLong ? `${ids.counter} ${ids.problem}` : ids.counter}
      />
      <p id={ids.counter} className={styles.counter} data-over={tooLong ? "true" : undefined}>
        {goalCounter(draft)}
      </p>
      {tooLongBy !== null && (
        <p id={ids.problem} className={pageStyles.error}>
          {tooLongSentence(tooLongBy)}
        </p>
      )}
      {error && (
        <p className={pageStyles.error} role="alert">
          <span aria-hidden="true">✕</span> {error}
        </p>
      )}
      <div className={styles.composerActions}>
        <button type="submit" className={styles.start} disabled={!check.ok || starting}>
          {starting ? STARTING : START}
        </button>
        <button type="button" className={pageStyles.secondary} onClick={onClose}>
          {CLOSE}
        </button>
      </div>
    </form>
  );
}
