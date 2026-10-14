// The run page's activity feed: the Mission's recent_events (the latest 50, refreshed by
// the detail poll) plus older pages from GET /events, asked by offset when the user wants
// them. New events push the old ones further back, so a page can overlap what is loaded:
// rows are merged by id, newest first, so nothing shows twice and nothing is skipped.

import { useCallback, useMemo, useState } from "react";

import type { ApiClient } from "@/lib/client/api";
import { EVENTS_PAGE, mergeEvents } from "@/lib/missions/run";
import type { MissionEvent } from "@/lib/missions/types";

export const OLDER_FAILED = "Play couldn't load older activity.";

type Older = {
  readonly events: readonly MissionEvent[];
  /** A page came back short: there is nothing older. */
  readonly done: boolean;
  readonly status: "idle" | "loading" | "failed";
};

const START: Older = { events: [], done: false, status: "idle" };

export interface MissionActivity {
  readonly events: readonly MissionEvent[];
  readonly canShowOlder: boolean;
  readonly loading: boolean;
  readonly error: string | null;
  readonly showOlder: () => Promise<void>;
}

export function useMissionActivity(client: ApiClient, id: string, recent: readonly MissionEvent[]): MissionActivity {
  const [older, setOlder] = useState<Older>(START);
  const events = useMemo(() => mergeEvents(older.events, recent), [older.events, recent]);
  // The detail holds a full page when there may be more; fewer means it has them all.
  const canShowOlder = !older.done && events.length >= EVENTS_PAGE;

  const showOlder = useCallback(async () => {
    setOlder((previous) => ({ ...previous, status: "loading" }));
    try {
      const page = await client.missionEvents(id, { limit: EVENTS_PAGE, offset: events.length });
      const done = page.events.length < EVENTS_PAGE || events.length + page.events.length >= page.total;
      setOlder((previous) => ({ events: mergeEvents(previous.events, page.events), done, status: "idle" }));
    } catch (error) {
      console.error("[mission] older events failed", error);
      setOlder((previous) => ({ ...previous, status: "failed" }));
    }
  }, [client, id, events.length]);

  return {
    events,
    canShowOlder,
    loading: older.status === "loading",
    error: older.status === "failed" ? OLDER_FAILED : null,
    showOlder,
  };
}
