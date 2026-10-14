// The Deliverables shelf's list: GET /api/deliverables (heartbeat outputs hidden by the
// client), one artifact_type filter, pages by offset, and a quiet re-read of the first
// page while the shelf is open so a new Deliverable shows up (and Auto celebrates).

import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, type ApiClient } from "@/lib/client/api";
import type { Deliverable } from "@/lib/client/types";
import { appendPage, prependNew, SHELF_PAGE_SIZE, SHELF_REFRESH_MS } from "@/lib/deliverables/shelf";

export const SHELF_FAILED = "Play couldn't load your shelf.";
export const MORE_FAILED = "Play couldn't load more Deliverables.";
const BACKEND_DOWN_STATUS = 502;

export type ShelfState =
  | { readonly status: "loading" }
  | { readonly status: "failed"; readonly error: string; readonly backendDown: boolean }
  | {
      readonly status: "ready";
      readonly items: readonly Deliverable[];
      readonly total: number;
      /** Load more: idle, on its way, or failed (the list stays). */
      readonly more: "idle" | "loading" | "failed";
    };

type Page =
  | { readonly ok: true; readonly items: readonly Deliverable[]; readonly total: number }
  | { readonly ok: false; readonly error: string; readonly backendDown: boolean };

/** One page; never throws. Users get a friendly sentence, the console gets the detail. */
async function fetchPage(client: ApiClient, artifactType: string | null, offset: number, failed: string): Promise<Page> {
  try {
    const list = await client.listDeliverables({ artifactType: artifactType ?? undefined, limit: SHELF_PAGE_SIZE, offset });
    if (list.success) return { ok: true, items: list.deliverables, total: list.total };
    // success: false carries the backend's own error text: log it, don't show it.
    console.error(`[shelf] ${failed}`, list.error);
    return { ok: false, error: failed, backendDown: false };
  } catch (error) {
    console.error(`[shelf] ${failed}`, error);
    const apiError = error instanceof ApiError ? error : null;
    return {
      ok: false,
      error: apiError ? `${failed} ${apiError.message}` : failed,
      backendDown: apiError?.status === BACKEND_DOWN_STATUS,
    };
  }
}

export interface Shelf {
  readonly state: ShelfState;
  readonly retry: () => void;
  readonly loadMore: () => void;
}

const LOADING: ShelfState = { status: "loading" };

export function useShelf(client: ApiClient, artifactType: string | null, refreshMs: number = SHELF_REFRESH_MS): Shelf {
  const [state, setState] = useState<ShelfState>(LOADING);
  const [attempt, setAttempt] = useState(0);
  // Bumped on every new list (filter or retry): answers for an older one are dropped.
  const generation = useRef(0);

  useEffect(() => {
    const mine = ++generation.current;
    setState(LOADING);
    void fetchPage(client, artifactType, 0, SHELF_FAILED).then((page) => {
      if (generation.current !== mine) return;
      setState(
        page.ok
          ? { status: "ready", items: page.items, total: page.total, more: "idle" }
          : { status: "failed", error: page.error, backendDown: page.backendDown },
      );
    });
    return () => {
      generation.current += 1;
    };
  }, [client, artifactType, attempt]);

  const loadMore = useCallback(() => {
    const current = state;
    if (current.status !== "ready" || current.more === "loading") return;
    const mine = generation.current;
    setState({ ...current, more: "loading" });
    void fetchPage(client, artifactType, current.items.length, MORE_FAILED).then((page) => {
      if (generation.current !== mine) return;
      setState((now) => (now.status === "ready" ? withPage(now, page) : now));
    });
  }, [client, artifactType, state]);

  useShelfRefresh(client, artifactType, refreshMs, generation, setState, state.status === "ready");

  const retry = useCallback(() => setAttempt((count) => count + 1), []);
  return { state, retry, loadMore };
}

type ReadyState = Extract<ShelfState, { status: "ready" }>;

function withPage(now: ReadyState, page: Page): ShelfState {
  if (!page.ok) return { ...now, more: "failed" };
  return { ...now, items: appendPage(now.items, page.items), total: page.total, more: "idle" };
}

/** The same state when the first page brought nothing new, so an idle shelf doesn't re-render. */
function withFirstPage(now: ReadyState, page: Extract<Page, { ok: true }>): ShelfState {
  const items = prependNew(now.items, page.items);
  return items === now.items && page.total === now.total ? now : { ...now, items, total: page.total };
}

/** Re-reads the first page every refreshMs, and when the tab comes back into view. */
function useShelfRefresh(
  client: ApiClient,
  artifactType: string | null,
  refreshMs: number,
  generation: { readonly current: number },
  setState: (update: (now: ShelfState) => ShelfState) => void,
  ready: boolean,
): void {
  useEffect(() => {
    if (!ready) return undefined;
    const refresh = () => {
      const mine = generation.current;
      void fetchPage(client, artifactType, 0, "Play couldn't check for new Deliverables.").then((page) => {
        if (generation.current !== mine || !page.ok) return;
        const firstPage = page;
        setState((now) => (now.status === "ready" ? withFirstPage(now, firstPage) : now));
      });
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const timer = window.setInterval(refresh, refreshMs);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [client, artifactType, refreshMs, generation, setState, ready]);
}
