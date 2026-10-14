import type { MascotName } from "@/lib/mascot/types";

import { isProcessed, isProcessing } from "./knowledge";
import type { KnowledgeDocument, UploadProgress, UploadResult } from "./types";

// One upload on the Knowledge page, as a value (PRD-003 P-010), and Auto's part in it.
// The backend reads the file inside the upload request (knowledge.md), so the steps are:
// sending the bytes, Auto reading (the request still open), then the answer. An answer
// that still says processing (a replaced document) is followed by polling the document.

export type UploadPhase =
  | { readonly kind: "idle" }
  /** The browser's own check said no; nothing was sent. */
  | { readonly kind: "refused"; readonly fileName: string; readonly reason: string }
  | { readonly kind: "sending"; readonly fileName: string; readonly progress: UploadProgress }
  /** Every byte is there; the backend is chunking and embedding before it answers. */
  | { readonly kind: "reading"; readonly fileName: string }
  /** The answer said it is still being read: the page polls the document. */
  | { readonly kind: "processing"; readonly fileName: string; readonly documentId: number }
  | {
      readonly kind: "done";
      readonly fileName: string;
      readonly documentId: number;
      readonly outcome: "processed" | "duplicate";
    }
  | { readonly kind: "failed"; readonly fileName: string; readonly message: string; readonly documentId?: number };

export const IDLE: UploadPhase = { kind: "idle" };

export function sendingPhase(fileName: string, progress: UploadProgress): UploadPhase {
  return progress.total > 0 && progress.loaded >= progress.total
    ? { kind: "reading", fileName }
    : { kind: "sending", fileName, progress };
}

/** The backend's answer as the next phase. */
export function answeredPhase(fileName: string, result: UploadResult): UploadPhase {
  const name = result.filename.trim() || fileName;
  if (result.status === "duplicate") {
    return { kind: "done", fileName: name, documentId: result.documentId, outcome: "duplicate" };
  }
  if (isProcessed(result.status)) {
    return { kind: "done", fileName: name, documentId: result.documentId, outcome: "processed" };
  }
  if (isProcessing(result.status)) return { kind: "processing", fileName: name, documentId: result.documentId };
  return { kind: "failed", fileName: name, message: failedMessage(result.message), documentId: result.documentId };
}

export const DELETED_WHILE_READING = "It was deleted before Auto finished reading it.";

/** A polled document ("gone": deleted meanwhile) moves a processing upload on; anything else stays as it was. */
export function polledPhase(phase: UploadPhase, document: KnowledgeDocument | "gone" | undefined): UploadPhase {
  if (phase.kind !== "processing" || !document) return phase;
  if (document === "gone") {
    return { kind: "failed", fileName: phase.fileName, message: DELETED_WHILE_READING, documentId: phase.documentId };
  }
  if (isProcessing(document.status)) return phase;
  if (isProcessed(document.status) || document.status === "duplicate") {
    const outcome = document.status === "duplicate" ? "duplicate" : "processed";
    return { kind: "done", fileName: phase.fileName, documentId: phase.documentId, outcome };
  }
  return { kind: "failed", fileName: phase.fileName, message: FAILED_TO_READ, documentId: phase.documentId };
}

export const FAILED_TO_READ = "Auto couldn't read it.";

/** The core's own sentence when it has one ("Uploaded, but processing failed: …"). */
function failedMessage(message: string): string {
  return message.trim() || FAILED_TO_READ;
}

/** The busy steps: an upload is on its way or being read. */
export type BusyPhase = Extract<UploadPhase, { readonly kind: "sending" | "reading" | "processing" }>;

export function isUploading(phase: UploadPhase): phase is BusyPhase {
  return phase.kind === "sending" || phase.kind === "reading" || phase.kind === "processing";
}

/** The id a processing upload waits on, for the page's poll. */
export function waitingOn(phase: UploadPhase): readonly number[] {
  return phase.kind === "processing" ? [phase.documentId] : [];
}

/** Whole percent sent, 0-100. */
export function sentPercent(progress: UploadProgress): number {
  if (progress.total <= 0) return 0;
  return Math.round((Math.min(progress.loaded, progress.total) / progress.total) * 100);
}

/** The upload's status line, in words. */
export function phaseWords(phase: UploadPhase): string {
  switch (phase.kind) {
    case "idle":
      return "";
    case "refused":
      return phase.reason;
    case "sending":
      return `Sending ${phase.fileName}: ${sentPercent(phase.progress)}%`;
    case "reading":
    case "processing":
      return `Auto is reading ${phase.fileName}. Big files take a few minutes.`;
    case "done":
      return phase.outcome === "processed"
        ? `${phase.fileName} is read. Auto can use it now.`
        : `Auto already has ${phase.fileName}, so nothing changed.`;
    case "failed":
      return `${phase.fileName}: ${phase.message}`;
  }
}

export interface KnowledgeActivity {
  readonly upload: UploadPhase;
  /** A search is on its way. */
  readonly searching: boolean;
  /** This upload's celebrate has played (the page keeps it, per upload). */
  readonly celebrated: boolean;
}

/**
 * Auto on the Knowledge page (knowledge.md, "Mascot"): oops on a failed upload, celebrate
 * once on a processed one, searching while a search runs, reading while an upload is
 * sent or read. Null: nothing is happening, so he isn't shown (never on the list itself).
 */
export function knowledgeMascot({ upload, searching, celebrated }: KnowledgeActivity): MascotName | null {
  if (upload.kind === "failed") return "oops";
  if (upload.kind === "done" && upload.outcome === "processed" && !celebrated) return "celebrate";
  if (searching) return "searching";
  if (isUploading(upload)) return "reading";
  if (upload.kind === "done") return "idle";
  return null;
}

/** The line under Auto for that state. */
export function knowledgeCaption(activity: KnowledgeActivity, mascot: MascotName): string {
  const { upload } = activity;
  if (mascot === "searching") return "Searching your documents";
  if (mascot === "oops") return "That one didn't work";
  if (upload.kind === "done") return upload.outcome === "processed" ? "All read" : "I already have this one";
  if (isUploading(upload)) return `Reading ${upload.fileName}`;
  return "Ready when you are";
}
