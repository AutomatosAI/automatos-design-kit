"use client";

// The Knowledge list (PRD-003 P-010): page one, Load more by skip, and reload() after an
// upload, which keeps the rows on screen until the fresh ones arrive. Not polled: the
// documents still being read are followed one by one (useProcessingPoll).

import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, type ApiClient } from "@/lib/client/api";
import { KNOWLEDGE_PAGE_SIZE } from "@/lib/documents/knowledge";
import type { KnowledgeDocument } from "@/lib/documents/types";

export const LIST_FAILED = "Play couldn't load your documents.";
export const MORE_FAILED = "Play couldn't load more documents. Try again.";

/** The backend's own ceiling for one page (orchestrator/api/documents.py, limit le=1000). */
const MAX_LIMIT = 1000;

type MoreState = "idle" | "loading" | "failed";

export type DocumentListView =
  | { readonly status: "loading" }
  | { readonly status: "failed"; readonly error: string; readonly retry: () => void }
  | {
      readonly status: "ready";
      readonly documents: readonly KnowledgeDocument[];
      /** Goes up each time page one lands (a fresh list). */
      readonly epoch: number;
      readonly hasMore: boolean;
      readonly more: MoreState;
      readonly loadMore: () => void;
    };

type Loaded =
  | { readonly status: "loading" }
  | { readonly status: "failed"; readonly error: string }
  | {
      readonly status: "ready";
      readonly documents: readonly KnowledgeDocument[];
      readonly epoch: number;
      readonly hasMore: boolean;
    };

function appendNew(loaded: readonly KnowledgeDocument[], page: readonly KnowledgeDocument[]): readonly KnowledgeDocument[] {
  const known = new Set(loaded.map((document) => document.id));
  return [...loaded, ...page.filter((document) => !known.has(document.id))];
}

function failedSentence(error: unknown): string {
  return error instanceof ApiError ? `${LIST_FAILED} ${error.message}` : LIST_FAILED;
}

export function useDocumentList(client: ApiClient): DocumentListView & { readonly reload: () => void } {
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading" });
  const [more, setMore] = useState<MoreState>("idle");
  const [version, setVersion] = useState(0);
  // Rows on screen, so a reload asks for as many as are shown.
  const shown = useRef(0);
  // A Load more answer that lands after a reload is dropped.
  const generation = useRef(0);

  useEffect(() => {
    let live = true;
    const limit = Math.min(Math.max(KNOWLEDGE_PAGE_SIZE, shown.current), MAX_LIMIT);
    generation.current += 1;
    client.listDocuments({ skip: 0, limit }).then(
      (documents) => {
        if (!live) return;
        shown.current = documents.length;
        setLoaded((previous) => ({
          status: "ready",
          documents,
          epoch: previous.status === "ready" ? previous.epoch + 1 : 0,
          hasMore: documents.length === limit,
        }));
        setMore("idle");
      },
      (error: unknown) => {
        console.error(`[knowledge] ${LIST_FAILED}`, error);
        // A failed reload keeps the rows already on screen; a Load more it overtook is over.
        if (!live) return;
        setMore("idle");
        setLoaded((previous) => (previous.status === "ready" ? previous : { status: "failed", error: failedSentence(error) }));
      },
    );
    return () => {
      live = false;
    };
  }, [client, version]);

  const reload = useCallback(() => setVersion((count) => count + 1), []);
  const retry = useCallback(() => {
    setLoaded({ status: "loading" });
    reload();
  }, [reload]);

  const loadMore = useCallback(() => {
    if (loaded.status !== "ready") return;
    const started = generation.current;
    setMore("loading");
    client.listDocuments({ skip: loaded.documents.length, limit: KNOWLEDGE_PAGE_SIZE }).then(
      (page) => {
        if (generation.current !== started) return;
        setLoaded((previous) => {
          if (previous.status !== "ready") return previous;
          const documents = appendNew(previous.documents, page);
          shown.current = documents.length;
          return { ...previous, documents, hasMore: page.length === KNOWLEDGE_PAGE_SIZE };
        });
        setMore("idle");
      },
      (error: unknown) => {
        console.error(`[knowledge] ${MORE_FAILED}`, error);
        if (generation.current === started) setMore("failed");
      },
    );
  }, [client, loaded]);

  if (loaded.status === "loading") return { status: "loading", reload };
  if (loaded.status === "failed") return { status: "failed", error: loaded.error, retry, reload };
  return { ...loaded, more, loadMore, reload };
}
