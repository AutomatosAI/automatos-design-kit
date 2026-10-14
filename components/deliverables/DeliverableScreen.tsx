"use client";

// One Deliverable (mock 05): loads it with its content, then shows it, or says it
// isn't on the shelf (404), or that it couldn't be opened, with Try again. No mascot
// here: the Deliverable is the hero, and Auto comes back with "Ask Auto about this".

import Link from "next/link";
import { useCallback } from "react";

import { PageColumns } from "@/components/shell/PageColumns";
import { type Loaded, useLoad } from "@/hooks/useLoad";
import { api, ApiError, type ApiClient } from "@/lib/client/api";
import type { Deliverable } from "@/lib/client/types";

import { DeliverableView } from "./DeliverableView";
import styles from "./detail.module.css";

export const OPENING = "Opening this Deliverable…";
export const OPEN_FAILED = "Play couldn't open this Deliverable.";
export const NOT_ON_SHELF = "This Deliverable isn't on your shelf. It may have been deleted.";
const NOT_FOUND = 404;

type Found = { readonly found: true; readonly deliverable: Deliverable } | { readonly found: false };

export interface DeliverableScreenProps {
  readonly id: string;
  /** Tests pass their own (createApiClient with a mock fetch). */
  readonly client?: ApiClient;
  /** What "today" is; tests pin it. */
  readonly now?: Date;
}

async function loadDeliverable(client: ApiClient, id: string): Promise<Found> {
  try {
    const deliverable = await client.getDeliverable(id);
    if (deliverable.contentError) {
      console.warn(`[deliverable] Automatos couldn't read the file of ${id}:`, deliverable.contentError);
    }
    return { found: true, deliverable };
  } catch (error) {
    if (error instanceof ApiError && error.status === NOT_FOUND) return { found: false };
    throw error;
  }
}

export function DeliverableScreen({ id, client = api, now }: DeliverableScreenProps) {
  const load = useCallback(() => loadDeliverable(client, id), [client, id]);
  const state = useLoad(load, OPEN_FAILED, "deliverable");

  return (
    <PageColumns>
      <div className={styles.page}>
        <Link href="/deliverables" className={styles.back}>
          <span aria-hidden="true">← </span>Shelf
        </Link>
        <Body state={state} client={client} now={now ?? new Date()} />
      </div>
    </PageColumns>
  );
}

interface BodyProps {
  readonly state: Loaded<Found>;
  readonly client: ApiClient;
  readonly now: Date;
}

function Body({ state, client, now }: BodyProps) {
  if (state.status === "loading") {
    return (
      <p className={styles.note} role="status">
        {OPENING}
      </p>
    );
  }
  if (state.status === "failed") {
    return (
      <div className={styles.failed} role="alert">
        <p className={styles.error}>
          <span aria-hidden="true">✕</span> {state.error}
        </p>
        <button type="button" className={styles.primary} onClick={state.retry}>
          Try again
        </button>
      </div>
    );
  }
  const found = state.value;
  if (!found.found) return <p className={styles.note}>{NOT_ON_SHELF}</p>;
  return <DeliverableView deliverable={found.deliverable} client={client} now={now} />;
}
