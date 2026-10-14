"use client";

// The Deliverables shelf (mock 04): "Your shelf" with Auto in the header, filter chips
// by type, a card grid with the newest in the spotlight, and Load more. A Deliverable
// this browser hasn't seen makes Auto celebrate once. There is no mascot column here:
// Auto sits in the header, as in the mock.

import { useCallback, useEffect, useReducer, useState } from "react";

import { AutoMascot } from "@/components/mascot/AutoMascot";
import { PageColumns } from "@/components/shell/PageColumns";
import { useCelebrateNew } from "@/hooks/useCelebrateNew";
import { type ShelfState, useShelf } from "@/hooks/useShelf";
import { api, type ApiClient } from "@/lib/client/api";
import {
  ALL_FILTER,
  countLine,
  kindOf,
  SHELF_FILTERS,
  shelfCaption,
  type ShelfFilter,
} from "@/lib/deliverables/shelf";
import { captionFor } from "@/lib/mascot/media";
import { INITIAL_MASCOT, mascotReducer } from "@/lib/mascot/reducer";
import type { MascotEvent, MascotName } from "@/lib/mascot/types";

import { ShelfBody } from "./ShelfBody";
import styles from "./shelf.module.css";

export const FILTER_GROUP_LABEL = "Show Deliverables by type";

export interface ShelfScreenProps {
  /** Tests pass their own (createApiClient with a mock fetch). */
  readonly client?: ApiClient;
  /** What "today" is; tests pin it. */
  readonly now?: Date;
  /** How often to check for new Deliverables. */
  readonly refreshMs?: number;
}

/** Auto sleeps when Automatos isn't running and says oops when a load fails. */
function useShelfMascot(state: ShelfState, dispatch: (event: MascotEvent) => void): void {
  useEffect(() => {
    if (state.status === "failed") dispatch(state.backendDown ? { type: "backend-down" } : { type: "request-failed" });
    if (state.status === "ready") dispatch({ type: "backend-up" });
  }, [state, dispatch]);
}

export function ShelfScreen({ client = api, now, refreshMs }: ShelfScreenProps) {
  const [filter, setFilter] = useState<ShelfFilter>(ALL_FILTER);
  const shelf = useShelf(client, filter.artifactType, refreshMs);
  const [mascot, dispatch] = useReducer(mascotReducer, INITIAL_MASCOT);
  const celebrate = useCallback(() => dispatch({ type: "deliverable-added" }), []);
  const onClipEnded = useCallback((state: MascotName) => dispatch({ type: "clip-ended", state }), []);
  const latest = useCelebrateNew(shelf.state.status === "ready" ? shelf.state.items : null, celebrate);
  useShelfMascot(shelf.state, dispatch);

  const total = shelf.state.status === "ready" ? shelf.state.total : null;
  const caption =
    mascot.mascot === "celebrate" && latest ? captionFor("celebrate", kindOf(latest)) : idleCaption(mascot.mascot, total);

  return (
    <PageColumns>
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.heading}>
            <h1 className={styles.title}>Your shelf</h1>
            {total !== null && <p className={styles.count}>{countLine(total)}</p>}
          </div>
          <div className={styles.auto}>
            <AutoMascot state={mascot.mascot} onClipEnded={onClipEnded} caption={caption} size="small" />
          </div>
        </header>
        <FilterChips selected={filter} onSelect={setFilter} />
        <ShelfBody shelf={shelf} filter={filter} client={client} now={now ?? new Date()} />
      </div>
    </PageColumns>
  );
}

/** The shelf line while Auto idles; his own caption for anything else (asleep, oops). */
function idleCaption(state: MascotName, total: number | null): string | undefined {
  return state === "idle" || state === "celebrate" ? shelfCaption(total) : undefined;
}

interface FilterChipsProps {
  readonly selected: ShelfFilter;
  readonly onSelect: (filter: ShelfFilter) => void;
}

function FilterChips({ selected, onSelect }: FilterChipsProps) {
  return (
    <div className={styles.chips} role="group" aria-label={FILTER_GROUP_LABEL}>
      {SHELF_FILTERS.map((filter) => (
        <button
          key={filter.label}
          type="button"
          className={styles.chip}
          aria-pressed={filter.artifactType === selected.artifactType}
          onClick={() => onSelect(filter)}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}
