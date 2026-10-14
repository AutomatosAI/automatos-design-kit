"use client";

// The run page's activity feed, newest first: what happened, the move it made ("Running →
// Paused"), why it stopped when it says, and when. Show older pages GET /events by offset.

import type { MissionActivity as Activity } from "@/hooks/useMissionActivity";
import { eventLabel, eventMove, whenWords } from "@/lib/missions/run";
import type { MissionEvent } from "@/lib/missions/types";

import pageStyles from "../page/page.module.css";
import styles from "./run.module.css";

export const ACTIVITY_LABEL = "Mission activity";
export const SHOW_OLDER = "Show older";
export const NO_ACTIVITY = "Nothing has happened yet.";

export function MissionActivity({ activity }: { readonly activity: Activity }) {
  const { events, canShowOlder, loading, error, showOlder } = activity;
  if (events.length === 0) return <p className={styles.note}>{NO_ACTIVITY}</p>;
  return (
    <>
      <ul className={styles.feed} aria-label={ACTIVITY_LABEL}>
        {events.map((event) => (
          <EventRow key={event.id} event={event} />
        ))}
      </ul>
      {error && (
        <p className={styles.alert} role="alert">
          {error}
        </p>
      )}
      {canShowOlder && (
        <button type="button" className={pageStyles.secondary} disabled={loading} onClick={() => void showOlder()}>
          {SHOW_OLDER}
        </button>
      )}
    </>
  );
}

function EventRow({ event }: { readonly event: MissionEvent }) {
  const move = eventMove(event);
  const when = whenWords(event.createdAt);
  return (
    <li className={styles.event}>
      <p className={styles.eventLine}>
        {eventLabel(event.eventType)}
        {move && ` (${move})`}
      </p>
      {event.stopDetail && <p className={styles.eventDetail}>{event.stopDetail}</p>}
      {when && (
        <p className={styles.eventDetail}>
          <time dateTime={event.createdAt ?? undefined}>{when}</time>
        </p>
      )}
    </li>
  );
}
