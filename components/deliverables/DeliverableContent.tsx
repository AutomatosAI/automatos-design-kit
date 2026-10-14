"use client";

// A Deliverable's content. Markdown and text go through the chat's Markdown (no raw
// HTML, images as alt text: the content is model output, so untrusted); an image shows
// full width; anything else offers its file when it has one, or says Play can't show it.

import { Markdown } from "@/components/chat/Markdown";
import { useDeliverableImage } from "@/hooks/useDeliverableImage";
import { deliverableFileHref, type ApiClient } from "@/lib/client/api";
import type { Deliverable } from "@/lib/client/types";
import { type ContentView, unsupportedMessage } from "@/lib/deliverables/detail";

import styles from "./detail.module.css";

export const TRUNCATED = "This is the first part: the file is too long to show here in full.";
export const EMPTY = "This Deliverable is empty.";
export const UNREADABLE = "Automatos couldn't read this file.";
export const PICTURE_LOADING = "Loading the picture…";
export const PICTURE_FAILED = "The picture didn't load.";
export const DOWNLOAD_FILE = "Download the file";

export interface DeliverableContentProps {
  readonly view: ContentView;
  readonly deliverable: Deliverable;
  readonly kind: string;
  readonly title: string;
  readonly client: ApiClient;
}

export function DeliverableContent({ view, deliverable, kind, title, client }: DeliverableContentProps) {
  if (view.kind === "text") {
    return (
      <div className={styles.document}>
        <Markdown text={view.markdown} className={styles.prose} />
        {view.truncated && <p className={styles.note}>{TRUNCATED}</p>}
      </div>
    );
  }
  if (view.kind === "empty") return <p className={styles.note}>{EMPTY}</p>;
  if (view.kind === "image") return <Picture client={client} id={deliverable.id} title={title} />;
  return (
    <div className={styles.unavailable}>
      <p className={styles.note}>{view.reason === "unreadable" ? UNREADABLE : unsupportedMessage(kind)}</p>
      {view.download && (
        <a href={deliverableFileHref(deliverable.id)} download={deliverable.fileName ?? ""} className={styles.secondary}>
          {DOWNLOAD_FILE}
        </a>
      )}
    </div>
  );
}

interface PictureProps {
  readonly client: ApiClient;
  readonly id: string;
  readonly title: string;
}

function Picture({ client, id, title }: PictureProps) {
  const image = useDeliverableImage(client, id);
  if (image.status === "loading") {
    return (
      <p className={styles.note} role="status">
        {PICTURE_LOADING}
      </p>
    );
  }
  if (image.status === "failed") {
    return (
      <p className={styles.error} role="alert">
        <span aria-hidden="true">✕</span> {PICTURE_FAILED}
      </p>
    );
  }
  // A blob: URL from the API client, which next/image can't optimise.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={image.url} alt={title} className={styles.image} />;
}
