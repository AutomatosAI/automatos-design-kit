"use client";

// Follows the documents still being read (knowledge.md, "Processing status"): every
// POLL_INTERVALS.DOCUMENT_PROCESSING it asks GET /api/documents/<id> for each one, and
// stops once every answer is processed, failed or otherwise settled (or the document is
// gone). Never /reprocess, which would start the reading again. The answers are kept by
// id, so the list and the upload line can show the latest status.

import { useCallback, useState } from "react";

import { usePoll } from "@/hooks/usePoll";
import { ApiError, type ApiClient } from "@/lib/client/api";
import { isSettled } from "@/lib/documents/knowledge";
import type { KnowledgeDocument } from "@/lib/documents/types";
import { POLL_INTERVALS } from "@/lib/poll/intervals";

const NOT_FOUND = 404;

/** One id's answer: its row, gone (deleted meanwhile), or not known this time. */
type Check =
  | { readonly kind: "found"; readonly document: KnowledgeDocument }
  | { readonly kind: "gone" }
  | { readonly kind: "unknown" };

function done(check: Check): boolean {
  return check.kind === "gone" || (check.kind === "found" && isSettled(check.document.status));
}

async function checkOne(client: ApiClient, id: number): Promise<Check> {
  try {
    return { kind: "found", document: await client.getDocument(id) };
  } catch (error) {
    if (error instanceof ApiError && error.status === NOT_FOUND) return { kind: "gone" };
    console.error(`[knowledge] Play couldn't check document ${id}.`, error);
    return { kind: "unknown" };
  }
}

function merged(
  previous: ReadonlyMap<number, KnowledgeDocument>,
  checks: readonly Check[],
): ReadonlyMap<number, KnowledgeDocument> {
  const found = checks.flatMap((check) => (check.kind === "found" ? [check.document] : []));
  if (found.length === 0) return previous;
  return new Map([...previous, ...found.map((document): [number, KnowledgeDocument] => [document.id, document])]);
}

const NONE: ReadonlyMap<number, KnowledgeDocument> = new Map();

type Updates = {
  readonly epoch: number;
  readonly rows: ReadonlyMap<number, KnowledgeDocument>;
  /** Deleted while being followed (404). */
  readonly gone: ReadonlySet<number>;
};

export interface Processing {
  /** The latest row per followed id. */
  readonly rows: ReadonlyMap<number, KnowledgeDocument>;
  readonly gone: ReadonlySet<number>;
}

const NO_IDS: ReadonlySet<number> = new Set();
const FRESH: Omit<Updates, "epoch"> = { rows: NONE, gone: NO_IDS };

function goneIds(previous: ReadonlySet<number>, checks: readonly Check[], ids: readonly number[]): ReadonlySet<number> {
  const gone = ids.filter((id, index) => checks[index]?.kind === "gone");
  return gone.length === 0 ? previous : new Set([...previous, ...gone]);
}

/**
 * ids: the documents that looked unread, in any order. epoch: the list's version; a fresh
 * list is newer than what was polled on top of the old one, so the answers start over
 * (a document uploaded again under its name goes back to processing, same id).
 * The latest row per id comes back, and the ids that are gone; neither is asked again.
 */
export function useProcessingPoll(
  client: ApiClient,
  ids: readonly number[],
  epoch: number,
  intervalMs: number = POLL_INTERVALS.DOCUMENT_PROCESSING,
): Processing {
  const [updates, setUpdates] = useState<Updates>({ epoch, ...FRESH });
  const { rows, gone } = updates.epoch === epoch ? updates : FRESH;
  // The ids still unread as one string, so a new array with the same ids keeps the same poll.
  const key = [...new Set(ids)]
    .filter((id) => !gone.has(id) && !isSettled(rows.get(id)?.status ?? "processing"))
    .sort((a, b) => a - b)
    .join(",");

  const check = useCallback(async (): Promise<readonly Check[]> => {
    const following = key ? key.split(",").map(Number) : [];
    const checks = await Promise.all(following.map((id) => checkOne(client, id)));
    setUpdates((previous) => {
      // A slow answer from before the list was read again is older than what is there.
      if (previous.epoch > epoch) return previous;
      const base = previous.epoch === epoch ? previous : { epoch, ...FRESH };
      return { epoch, rows: merged(base.rows, checks), gone: goneIds(base.gone, checks, following) };
    });
    return checks;
  }, [client, key, epoch]);

  // The list (or the upload) has just said "processing": the first check waits one interval.
  usePoll(check, intervalMs, { immediate: false, stopWhen: (checks) => checks.every(done), label: "knowledge" });
  return { rows, gone };
}
