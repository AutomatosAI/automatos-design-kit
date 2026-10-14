// The Missions list (PRD-003 P-004): the first page for the chosen filter, polled with
// usePoll(LIST) while the tab is visible, plus whatever Load more has added by offset.
// The backend filters by one state at a time, so a filter with several states asks once
// per state and the answers are merged, newest first. The poll keeps the first pages
// fresh; rows Load more brought stay as they were read.

import { useCallback, useMemo, useState } from "react";

import { usePoll } from "@/hooks/usePoll";
import { ApiError, type ApiClient } from "@/lib/client/api";
import {
  cursorAfter,
  type Cursors,
  hasMore,
  MISSION_PAGE_SIZE,
  type MissionFilter,
  mergeCursors,
  mergeMissions,
  queryKey,
  type StateQuery,
  statesFor,
  totalOf,
} from "@/lib/missions/list";
import type { Mission } from "@/lib/missions/types";
import { POLL_INTERVALS } from "@/lib/poll/intervals";

export const LIST_FAILED = "Play couldn't load your Missions.";
export const MORE_FAILED = "Play couldn't load more Missions.";

export type MissionPage = { readonly missions: readonly Mission[]; readonly cursors: Cursors };

/** One page per state query from where its cursor stopped (0 when unread); finished queries are skipped. */
export async function readPages(client: ApiClient, queries: readonly StateQuery[], from: Cursors): Promise<MissionPage> {
  const wanted = queries.filter((state) => {
    const cursor = from[queryKey(state)];
    return !cursor || cursor.loaded < cursor.total;
  });
  const pages = await Promise.all(
    wanted.map(async (state) => {
      const offset = from[queryKey(state)]?.loaded ?? 0;
      const list = await client.listMissions({ state, limit: MISSION_PAGE_SIZE, offset });
      return { key: queryKey(state), missions: list.missions, cursor: cursorAfter(offset, list.missions.length, list.total) };
    }),
  );
  return {
    missions: pages.reduce<readonly Mission[]>((all, page) => mergeMissions(all, page.missions), []),
    cursors: Object.fromEntries(pages.map((page) => [page.key, page.cursor])),
  };
}

export type MissionListView =
  | { readonly status: "loading" }
  | { readonly status: "failed"; readonly error: string; readonly retry: () => void }
  | {
      readonly status: "ready";
      readonly missions: readonly Mission[];
      /** Every Mission the filter matches, loaded or not. */
      readonly total: number;
      readonly hasMore: boolean;
      /** Load more: idle, on its way, or failed (the list stays). */
      readonly more: "idle" | "loading" | "failed";
      readonly loadMore: () => void;
    };

/** The poll's answer, marked with the filter it was read for. */
type FirstPage = MissionPage & { readonly filter: MissionFilter };

/** What Load more added, for the first-page reader it was read against. */
type Extra = MissionPage & {
  readonly source: (() => Promise<FirstPage>) | null;
  readonly more: "idle" | "loading" | "failed";
};

const NO_EXTRA: Extra = { source: null, missions: [], cursors: {}, more: "idle" };

function failureMessage(error: unknown): string {
  return error instanceof ApiError ? `${LIST_FAILED} ${error.message}` : LIST_FAILED;
}

export function useMissionList(
  client: ApiClient,
  filter: MissionFilter,
  intervalMs: number = POLL_INTERVALS.LIST,
): MissionListView {
  const queries = useMemo(() => statesFor(filter), [filter]);
  const firstPage = useCallback(
    async (): Promise<FirstPage> => ({ filter, ...(await readPages(client, queries, {})) }),
    [client, queries, filter],
  );
  const poll = usePoll(firstPage, intervalMs, { label: "missions" });
  const [stored, setStored] = useState<Extra>(NO_EXTRA);
  // Rows loaded for another filter (or client) don't belong to this list.
  const extra = stored.source === firstPage ? stored : NO_EXTRA;
  // The poll restarts in an effect: until then its value is the last filter's.
  const first = poll.state.status === "ready" && poll.state.value.filter === filter ? poll.state.value : null;

  const loadMore = useCallback(() => {
    if (!first || extra.more === "loading") return;
    const from = mergeCursors(extra.cursors, first.cursors);
    const mine = (now: Extra): boolean => now.source === firstPage;
    setStored({ ...extra, source: firstPage, more: "loading" });
    readPages(client, queries, from).then(
      (page) =>
        setStored((now) =>
          mine(now)
            ? {
                source: firstPage,
                missions: mergeMissions(now.missions, page.missions),
                cursors: mergeCursors(mergeCursors(from, now.cursors), page.cursors),
                more: "idle",
              }
            : now,
        ),
      (error: unknown) => {
        console.error(`[missions] ${MORE_FAILED}`, error);
        setStored((now) => (mine(now) ? { ...now, more: "failed" } : now));
      },
    );
  }, [client, queries, firstPage, first, extra]);

  const refresh = poll.refresh;
  const retry = useCallback(() => {
    void refresh();
  }, [refresh]);

  if (poll.state.status === "failed") return { status: "failed", error: failureMessage(poll.state.error), retry };
  if (!first) return { status: "loading" };
  // The poll's first pages are the freshest: their rows and totals win.
  const cursors = mergeCursors(extra.cursors, first.cursors);
  return {
    status: "ready",
    missions: mergeMissions(extra.missions, first.missions),
    total: totalOf(cursors),
    hasMore: hasMore(cursors),
    more: extra.more,
    loadMore,
  };
}
