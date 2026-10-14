"use client";

// One document (PRD-003 P-010), on the detail page pattern: its name, status and type, its
// text (Markdown through the chat's safe renderer, anything else as plain text), Download
// (Play's route: a redirect to S3 or the bytes through Play's server) and Delete, which
// confirms in the page with what the delete takes with it. No Auto here.

import { useRouter } from "next/navigation";
import { type RefObject, useEffect, useRef, useState } from "react";

import { Markdown } from "@/components/chat/Markdown";
import { DetailPage } from "@/components/page/DetailPage";
import { PageFailed, PageLoading } from "@/components/page/parts";
import { StateChip } from "@/components/page/StateChip";
import type { Loaded } from "@/hooks/useLoad";
import { useKnowledgeDocument } from "@/hooks/useKnowledgeDocument";
import { api, ApiError, type ApiClient, documentDownloadHref } from "@/lib/client/api";
import {
  documentName,
  isProcessing,
  KNOWLEDGE_HREF,
  readsAsMarkdown,
  sizeWords,
  statusChip,
} from "@/lib/documents/knowledge";
import type { DocumentContent, KnowledgeDocument } from "@/lib/documents/types";

import { DeleteConfirm } from "./DeleteConfirm";
import { TypeBadge } from "./DocumentList";
import { DocumentFacts } from "./DocumentFacts";
import styles from "./knowledge.module.css";

export const BACK = { href: KNOWLEDGE_HREF, label: "Knowledge" } as const;
export const PLACEHOLDER_TITLE = "Document";
export const LOADING_DOCUMENT = "Loading this document…";
export const LOADING_TEXT = "Loading the text…";
export const STILL_READING = "Auto is still reading this document. The text shows here once he's done.";
export const NO_TEXT = "There's no text to show: Auto kept nothing from this file.";
export const UNREAD = "Auto couldn't read this file, so there's no text to show. Download it to see the original.";
export const DOWNLOAD = "Download";
export const DELETE = "Delete";
export const DELETE_FAILED = "Play couldn't delete it.";

export interface DocumentScreenProps {
  readonly id: number;
  /** Tests pass their own (createApiClient with a mock fetch). */
  readonly client?: ApiClient;
  readonly now?: Date;
  /** The processing poll's interval; POLL_INTERVALS.DOCUMENT_PROCESSING unless a test wants it faster. */
  readonly intervalMs?: number;
}

export function DocumentScreen({ id, client = api, now, intervalMs }: DocumentScreenProps) {
  const { view, content } = useKnowledgeDocument(client, id, intervalMs);
  const remove = useDelete(client, id);
  if (view.status !== "ready") {
    return (
      <DetailPage back={BACK} title={PLACEHOLDER_TITLE}>
        {view.status === "loading" ? (
          <PageLoading text={LOADING_DOCUMENT} />
        ) : (
          <PageFailed error={view.error} retry={view.retry} />
        )}
      </DetailPage>
    );
  }
  const { document } = view;
  return (
    <DetailPage
      back={BACK}
      title={documentName(document)}
      chips={
        <>
          <StateChip {...statusChip(document.status)} />
          <TypeBadge fileType={document.fileType} filename={document.filename} />
          {document.fileSize !== null && <span className={styles.note}>{sizeWords(document.fileSize)}</span>}
        </>
      }
      actions={
        <DocumentActions id={id} confirming={remove.confirming} onDelete={remove.open} deleteButton={remove.button} />
      }
      side={<DocumentFacts document={document} now={now ?? new Date()} />}
    >
      {remove.confirming && (
        <DeleteConfirm
          client={client}
          id={id}
          busy={remove.busy}
          error={remove.error}
          onConfirm={remove.confirm}
          onKeep={remove.keep}
        />
      )}
      <DocumentText document={document} content={content} />
    </DetailPage>
  );
}

interface DocumentActionsProps {
  readonly id: number;
  readonly confirming: boolean;
  readonly onDelete: () => void;
  readonly deleteButton: RefObject<HTMLButtonElement | null>;
}

function DocumentActions({ id, confirming, onDelete, deleteButton }: DocumentActionsProps) {
  return (
    <>
      <a href={documentDownloadHref(id)} className={styles.action} download>
        {DOWNLOAD}
      </a>
      <button
        type="button"
        ref={deleteButton}
        className={styles.action}
        aria-expanded={confirming}
        onClick={onDelete}
      >
        {DELETE}
      </button>
    </>
  );
}

interface DocumentTextProps {
  readonly document: KnowledgeDocument;
  readonly content: Loaded<DocumentContent | null>;
}

function DocumentText({ document, content }: DocumentTextProps) {
  if (isProcessing(document.status)) return <p className={styles.note}>{STILL_READING}</p>;
  if (document.status === "failed") return <p className={styles.note}>{UNREAD}</p>;
  if (content.status === "failed") return <PageFailed error={content.error} retry={content.retry} />;
  // null: the text load for this status hasn't started yet (it starts after this render).
  if (content.status === "loading" || content.value === null) return <PageLoading text={LOADING_TEXT} />;
  const text = content.value.content.trim();
  if (!text) return <p className={styles.note}>{NO_TEXT}</p>;
  if (readsAsMarkdown(document.fileType, document.filename)) return <Markdown text={text} />;
  return <p className={styles.text}>{text}</p>;
}

/** Delete: open the confirmation, then DELETE and back to the list; Keep puts focus back on Delete. */
function useDelete(client: ApiClient, id: number) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);

  useEffect(() => {
    if (confirming || !refocus.current) return;
    refocus.current = false;
    button.current?.focus();
  }, [confirming]);

  const open = () => {
    setError(null);
    setConfirming(true);
  };
  const keep = () => {
    refocus.current = true;
    setConfirming(false);
  };
  const confirm = () => {
    setBusy(true);
    setError(null);
    client.deleteDocument(id).then(
      () => router.push(KNOWLEDGE_HREF),
      (failure: unknown) => {
        console.error(`[knowledge] ${DELETE_FAILED}`, failure);
        setError(failure instanceof ApiError ? `${DELETE_FAILED} ${failure.message}` : DELETE_FAILED);
        setBusy(false);
      },
    );
  };
  return { confirming, busy, error, open, keep, confirm, button };
}
