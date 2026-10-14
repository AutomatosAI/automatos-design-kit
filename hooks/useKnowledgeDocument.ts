"use client";

// One document's page (PRD-003 P-010): the row, followed with usePoll while it is still
// being read (POLL_INTERVALS.DOCUMENT_PROCESSING; one call for a document already read),
// and its text, fetched once it has settled (it is rebuilt from the chunks on every call).

import { useCallback } from "react";

import { type Loaded, useLoad } from "@/hooks/useLoad";
import { type PollState, usePoll } from "@/hooks/usePoll";
import { ApiError, type ApiClient } from "@/lib/client/api";
import { isSettled } from "@/lib/documents/knowledge";
import type { DocumentContent, KnowledgeDocument } from "@/lib/documents/types";
import { POLL_INTERVALS } from "@/lib/poll/intervals";

export const DOCUMENT_FAILED = "Play couldn't load this document.";
export const DOCUMENT_GONE = "This document isn't in Knowledge any more.";
export const CONTENT_FAILED = "Play couldn't load the text.";

const NOT_FOUND = 404;

type Lookup = { readonly kind: "found"; readonly document: KnowledgeDocument } | { readonly kind: "gone" };

export type DocumentView =
  | { readonly status: "loading" }
  | { readonly status: "failed"; readonly error: string; readonly retry: () => void }
  | { readonly status: "ready"; readonly document: KnowledgeDocument };

export interface KnowledgeDocumentPage {
  readonly view: DocumentView;
  /** null while there is nothing to fetch (still being read, or failed), and for one render after. */
  readonly content: Loaded<DocumentContent | null>;
}

function lookupDone(lookup: Lookup): boolean {
  return lookup.kind === "gone" || isSettled(lookup.document.status);
}

function failedSentence(error: unknown): string {
  return error instanceof ApiError ? `${DOCUMENT_FAILED} ${error.message}` : DOCUMENT_FAILED;
}

export function useKnowledgeDocument(
  client: ApiClient,
  id: number,
  intervalMs: number = POLL_INTERVALS.DOCUMENT_PROCESSING,
): KnowledgeDocumentPage {
  const lookup = useCallback(async (): Promise<Lookup> => {
    try {
      return { kind: "found", document: await client.getDocument(id) };
    } catch (error) {
      if (error instanceof ApiError && error.status === NOT_FOUND) return { kind: "gone" };
      throw error;
    }
  }, [client, id]);
  const poll = usePoll(lookup, intervalMs, { stopWhen: lookupDone, label: "knowledge" });
  const { state, refresh } = poll;
  const retry = useCallback(() => void refresh(), [refresh]);

  const found = state.status === "ready" && state.value.kind === "found" ? state.value.document : null;
  // A failed document has no text to fetch; anything else settled has.
  const readable = found !== null && isSettled(found.status) && found.status !== "failed";
  const loadContent = useCallback(
    async (): Promise<DocumentContent | null> => (readable ? client.documentContent(id) : null),
    [client, id, readable],
  );
  const content = useLoad(loadContent, CONTENT_FAILED, "knowledge");

  return { view: viewOf(state, retry), content };
}

/** usePoll has already logged a failed call (under "knowledge"). */
function viewOf(state: PollState<Lookup>, retry: () => void): DocumentView {
  if (state.status === "loading") return { status: "loading" };
  if (state.status === "failed") return { status: "failed", error: failedSentence(state.error), retry };
  if (state.value.kind === "gone") return { status: "failed", error: DOCUMENT_GONE, retry };
  return { status: "ready", document: state.value.document };
}
