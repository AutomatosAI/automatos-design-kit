"use client";

// A Mission Auto suggests, under his answer (a mission-suggestion frame): the goal, its
// complexity, Start this Mission (POST /api/missions, then the Mission's run page) and
// Not now, which hides the card for this reply. Nothing is created until you start it.

import { useRouter } from "next/navigation";
import { useState } from "react";

import { complexityWords } from "@/lib/chat/suggestion";
import type { MissionSuggestion } from "@/lib/chat/types";
import { ApiError } from "@/lib/client/api";
import { goalPreview, missionHref } from "@/lib/missions/list";
import type { Mission } from "@/lib/missions/types";

import pageStyles from "../page/page.module.css";
import styles from "./chat.module.css";

export const SUGGESTION_LABEL = "Mission suggestion";
export const SUGGESTION_TITLE = "Auto suggests a Mission";
export const START_SUGGESTED = "Start this Mission";
export const STARTING_SUGGESTED = "Starting…";
export const NOT_NOW = "Not now";
export const SUGGESTION_FAILED = "Play couldn't start the Mission.";

export interface MissionSuggestionCardProps {
  readonly suggestion: MissionSuggestion;
  /** Creates the Mission (the chat builds the request); the card then opens it. */
  readonly onStart: () => Promise<Mission>;
}

function failedSentence(failure: unknown): string {
  return failure instanceof ApiError ? `${SUGGESTION_FAILED} ${failure.message}` : SUGGESTION_FAILED;
}

export function MissionSuggestionCard({ suggestion, onStart }: MissionSuggestionCardProps) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const complexity = complexityWords(suggestion.complexity);

  if (dismissed) return null;

  const start = async () => {
    if (starting) return;
    setStarting(true);
    setError(null);
    try {
      const mission = await onStart();
      router.push(missionHref(mission.id));
    } catch (failure) {
      console.error(`[chat] ${SUGGESTION_FAILED}`, failure);
      setError(failedSentence(failure));
      setStarting(false);
    }
  };

  return (
    <section className={styles.suggestion} aria-label={SUGGESTION_LABEL}>
      <h3 className={styles.suggestionTitle}>{SUGGESTION_TITLE}</h3>
      {complexity && <p className={styles.suggestionMeta}>{complexity}</p>}
      <p className={styles.suggestionGoal}>{goalPreview(suggestion.goal)}</p>
      {error && (
        <p className={styles.error} role="alert">
          <span className={styles.mark} aria-hidden="true">
            ✕
          </span>
          {error}
        </p>
      )}
      <div className={styles.suggestionActions}>
        <button type="button" className={styles.suggestionStart} onClick={() => void start()} disabled={starting}>
          {starting ? STARTING_SUGGESTED : START_SUGGESTED}
        </button>
        <button type="button" className={pageStyles.secondary} onClick={() => setDismissed(true)} disabled={starting}>
          {NOT_NOW}
        </button>
      </div>
    </section>
  );
}
