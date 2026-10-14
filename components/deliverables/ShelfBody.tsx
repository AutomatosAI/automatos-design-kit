"use client";

// The shelf under the chips: loading, the error state (success: false or no answer,
// never "nothing here yet"), the friendly empty state, or the grid with Load more.

import Link from "next/link";

import { MORE_FAILED, type Shelf } from "@/hooks/useShelf";
import type { ApiClient } from "@/lib/client/api";
import { emptyMessage, type ShelfFilter } from "@/lib/deliverables/shelf";

import { ShelfCard } from "./ShelfCard";
import styles from "./shelf.module.css";

export const LOADING_SHELF = "Loading your shelf…";

export interface ShelfBodyProps {
  readonly shelf: Shelf;
  readonly filter: ShelfFilter;
  readonly client: ApiClient;
  readonly now: Date;
}

export function ShelfBody({ shelf, filter, client, now }: ShelfBodyProps) {
  const { state } = shelf;
  if (state.status === "loading") {
    return (
      <p className={styles.status} role="status">
        {LOADING_SHELF}
      </p>
    );
  }
  if (state.status === "failed") return <Failed error={state.error} retry={shelf.retry} />;
  if (state.items.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.status}>{emptyMessage(filter)}</p>
        <Link href="/" className={styles.button}>
          Start a chat
        </Link>
      </div>
    );
  }
  return (
    <>
      <ul className={styles.grid} aria-label="Deliverables">
        {state.items.map((deliverable, index) => (
          <ShelfCard key={deliverable.id} deliverable={deliverable} client={client} now={now} newest={index === 0} />
        ))}
      </ul>
      {state.items.length < state.total && (
        <div className={styles.more}>
          {state.more === "failed" && (
            <p className={styles.error} role="alert">
              <span aria-hidden="true">✕</span> {MORE_FAILED}
            </p>
          )}
          <button
            type="button"
            className={styles.moreButton}
            onClick={shelf.loadMore}
            disabled={state.more === "loading"}
          >
            {state.more === "loading" ? "Loading more…" : "Load more"}
          </button>
        </div>
      )}
    </>
  );
}

function Failed({ error, retry }: { readonly error: string; readonly retry: () => void }) {
  return (
    <div className={styles.failed} role="alert">
      <p className={styles.error}>
        <span aria-hidden="true">✕</span> {error}
      </p>
      <button type="button" className={styles.button} onClick={retry}>
        Try again
      </button>
    </div>
  );
}
