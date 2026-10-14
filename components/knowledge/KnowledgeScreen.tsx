"use client";

// Knowledge (PRD-003 P-010), Studio's documents page in Play's look: give Auto a file
// (drop or choose; checked in the browser, then sent with X-Play-Upload: 1), the
// documents with their status, and a search box whose results replace the list until it
// is cleared. Documents still being read are polled one by one until they settle.
// Auto shows up only while something happens (and on the empty state), never on the list.

import { useMemo } from "react";

import { AutoMascot } from "@/components/mascot/AutoMascot";
import { type GridStatus, type LoadMore, GridPage } from "@/components/page/GridPage";
import { type DocumentListView, MORE_FAILED, useDocumentList } from "@/hooks/useDocumentList";
import { type DocumentSearch, useDocumentSearch } from "@/hooks/useDocumentSearch";
import { type Processing, useProcessingPoll } from "@/hooks/useProcessingPoll";
import { useUpload } from "@/hooks/useUpload";
import { api, type ApiClient } from "@/lib/client/api";
import { documentCount, processingIds, withUpdates } from "@/lib/documents/knowledge";
import type { KnowledgeDocument } from "@/lib/documents/types";
import { knowledgeCaption, knowledgeMascot, polledPhase, waitingOn } from "@/lib/documents/upload";

import pageStyles from "../page/page.module.css";
import { CLEAR_SEARCH, DocumentList, SearchResults } from "./DocumentList";
import { KnowledgeActivity } from "./KnowledgeActivity";
import { UploadPanel } from "./UploadPanel";

export const TITLE = "Knowledge";
export const SEARCH_LABEL = "Search your documents";
export const LOADING_DOCUMENTS = "Loading your documents…";
export const SEARCHING = "Searching your documents…";
export const EMPTY = "Give me something to read.";

export function noMatches(query: string): string {
  return `Nothing in your documents matches “${query}”.`;
}

export interface KnowledgeScreenProps {
  /** Tests pass their own (createApiClient with a mock fetch and upload sender). */
  readonly client?: ApiClient;
  /** What "now" is for the rows' dates; tests pin it. */
  readonly now?: Date;
  /** The processing poll's interval; POLL_INTERVALS.DOCUMENT_PROCESSING unless a test wants it faster. */
  readonly intervalMs?: number;
}

export function KnowledgeScreen({ client = api, now, intervalMs }: KnowledgeScreenProps) {
  const list = useDocumentList(client);
  const search = useDocumentSearch(client);
  const upload = useUpload(client, list.reload);
  const listed = list.status === "ready" ? list.documents : null;
  const epoch = list.status === "ready" ? list.epoch : -1;

  const candidates = useMemo(() => processingIds(listed ?? [], waitingOn(upload.phase)), [listed, upload.phase]);
  const processing = useProcessingPoll(client, candidates, epoch, intervalMs);
  const phase = polledPhase(upload.phase, followed(processing, waitingOn(upload.phase)[0]));
  const query = search.state.kind === "running" ? search.state.query : null;
  const activity = { upload: phase, searching: query !== null, celebrated: upload.celebrated };
  const mascot = knowledgeMascot(activity);
  const showCount = list.status === "ready" && !list.hasMore && search.state.kind === "off";
  const today = now ?? new Date();

  return (
    <GridPage
      title={TITLE}
      count={showCount && listed ? documentCount(listed.length) : undefined}
      lead={
        <>
          <UploadPanel busy={phase.kind === "sending" || phase.kind === "reading"} onFile={upload.start} />
          <KnowledgeActivity
            upload={phase}
            mascot={mascot}
            caption={mascot ? knowledgeCaption(activity, mascot) : ""}
            detail={query === null ? undefined : `“${query}”`}
            onClipEnded={upload.onClipEnded}
            onDismiss={upload.dismiss}
          />
        </>
      }
      search={{ label: SEARCH_LABEL, value: search.draft, onChange: search.onChange, onSubmit: search.submit }}
      status={gridStatus(list, search, mascot === null)}
      loadMore={search.state.kind === "off" ? loadMoreOf(list) : undefined}
    >
      {search.state.kind === "done" ? (
        <SearchResults answer={search.state.answer} onClear={search.clear} />
      ) : (
        listed && <DocumentList documents={withUpdates(listed, processing.rows)} now={today} />
      )}
    </GridPage>
  );
}

/** What the poll knows of the document an upload waits on. */
function followed({ rows, gone }: Processing, id: number | undefined): KnowledgeDocument | "gone" | undefined {
  if (id === undefined) return undefined;
  return gone.has(id) ? "gone" : rows.get(id);
}

function gridStatus(list: DocumentListView, search: DocumentSearch, autoFree: boolean): GridStatus {
  const { state } = search;
  if (state.kind === "running") return { kind: "loading", text: SEARCHING };
  if (state.kind === "failed") return { kind: "failed", error: state.error, retry: search.retry };
  if (state.kind === "done") {
    if (state.answer.results.length > 0) return { kind: "ready" };
    return { kind: "empty", message: noMatches(state.answer.query), action: <ClearButton onClear={search.clear} /> };
  }
  if (list.status === "loading") return { kind: "loading", text: LOADING_DOCUMENTS };
  if (list.status === "failed") return { kind: "failed", error: list.error, retry: list.retry };
  if (list.documents.length > 0) return { kind: "ready" };
  // Auto on the empty state, unless he is already at work above it.
  const mascot = autoFree ? <AutoMascot state="idle" showCaption={false} /> : undefined;
  return { kind: "empty", message: EMPTY, mascot };
}

function ClearButton({ onClear }: { readonly onClear: () => void }) {
  return (
    <button type="button" className={pageStyles.secondary} onClick={onClear}>
      {CLEAR_SEARCH}
    </button>
  );
}

function loadMoreOf(list: DocumentListView): LoadMore | undefined {
  if (list.status !== "ready" || !list.hasMore) return undefined;
  return { onLoadMore: list.loadMore, loading: list.more === "loading", error: list.more === "failed" ? MORE_FAILED : null };
}
