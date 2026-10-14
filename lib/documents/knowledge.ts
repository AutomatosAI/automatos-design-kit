import type { StateChipProps } from "@/components/page/StateChip";

import type { DeleteImpact, KnowledgeDocument } from "./types";

// The Knowledge page's words (PRD-003 P-010), pure. Statuses per knowledge.md: uploaded,
// processing, processed, failed, duplicate; the queue also says pending and completed,
// and completed counts as processed.

export const KNOWLEDGE_HREF = "/knowledge";
export const KNOWLEDGE_PAGE_SIZE = 50;

const CHIPS: Readonly<Record<string, StateChipProps>> = {
  uploaded: { tone: "queued", label: "Waiting to be read" },
  pending: { tone: "queued", label: "Waiting to be read" },
  processing: { tone: "running", label: "Reading" },
  processed: { tone: "done", label: "Ready" },
  completed: { tone: "done", label: "Ready" },
  duplicate: { tone: "done", label: "Already here" },
  failed: { tone: "failed", label: "Couldn't read" },
};

const PROCESSING = new Set(["uploaded", "pending", "processing"]);

/** The status as a chip; one this build doesn't know shows its own words, idle. */
export function statusChip(status: string): StateChipProps {
  return Object.hasOwn(CHIPS, status) ? (CHIPS[status] ?? { tone: "idle" }) : { tone: "idle", label: words(status) };
}

/** Still being read: the page polls GET /api/documents/<id> for these. */
export function isProcessing(status: string): boolean {
  return PROCESSING.has(status);
}

/** Processed, in the document route's word or the queue's. */
export function isProcessed(status: string): boolean {
  return status === "processed" || status === "completed";
}

/** The poll stops here: read (or already there) or failed. Unknown statuses stop it too. */
export function isSettled(status: string): boolean {
  return !isProcessing(status);
}

function words(raw: string): string {
  const spaced = raw.replace(/_/g, " ").trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : "Unknown";
}

const TYPE_WORDS: Readonly<Record<string, string>> = {
  pdf: "PDF",
  markdown: "Markdown",
  text: "Text",
  document: "Word",
  json: "JSON",
  csv: "CSV",
  spreadsheet: "Excel",
  html: "HTML",
};

/** The type badge's word; the core files .html as "unknown", so the name's extension decides then. */
export function typeWords(fileType: string, filename = ""): string {
  if (Object.hasOwn(TYPE_WORDS, fileType)) return TYPE_WORDS[fileType] ?? fileType;
  const extension = filename.includes(".") ? filename.slice(filename.lastIndexOf(".") + 1) : "";
  if (extension) return extension.toUpperCase();
  return fileType && fileType !== "unknown" ? words(fileType) : "File";
}

const KILOBYTE = 1024;
const MEGABYTE = KILOBYTE * KILOBYTE;

/** "820 bytes", "14 KB", "2.4 MB"; "" when unknown. */
export function sizeWords(bytes: number | null): string {
  if (bytes === null) return "";
  if (bytes < KILOBYTE) return bytes === 1 ? "1 byte" : `${bytes} bytes`;
  if (bytes < MEGABYTE) return `${Math.round(bytes / KILOBYTE)} KB`;
  return `${(bytes / MEGABYTE).toFixed(1)} MB`;
}

/** "82% match"; null when the backend gave no score. */
export function similarityWords(similarity: number | null): string | null {
  if (similarity === null) return null;
  const percent = Math.round(Math.min(Math.max(similarity, 0), 1) * 100);
  return `${percent}% match`;
}

export function documentHref(id: number): string {
  return `${KNOWLEDGE_HREF}/${id}`;
}

/** "1 document", "12 documents". */
export function documentCount(total: number): string {
  return total === 1 ? "1 document" : `${total} documents`;
}

/** The file's name, or a stand-in when the core sent none. */
export function documentName(document: Pick<KnowledgeDocument, "filename">): string {
  return document.filename.trim() || "Untitled document";
}

function plural(value: number, one: string, many: string): string {
  return `${value} ${value === 1 ? one : many}`;
}

/** The delete confirmation's line: what goes with the document. */
export function impactWords(impact: DeleteImpact): string {
  const parts = [
    plural(impact.vectorChunks, "stored passage", "stored passages"),
    plural(impact.embeddings, "search entry", "search entries"),
    plural(impact.references, "recorded use", "recorded uses"),
  ];
  const freed = impact.storageFreed ? ` and frees ${impact.storageFreed}` : "";
  return `Deleting it removes ${parts.join(", ")}${freed}. Auto won't be able to use it any more.`;
}

/** How a document's text is shown: Markdown through the safe renderer, anything else as text. */
export function readsAsMarkdown(fileType: string, filename: string): boolean {
  return fileType === "markdown" || /\.(md|markdown)$/i.test(filename);
}

/** Replaces any listed row a poll brought back, newest answer winning; nothing else changes. */
export function withUpdates(
  documents: readonly KnowledgeDocument[],
  updates: ReadonlyMap<number, KnowledgeDocument>,
): readonly KnowledgeDocument[] {
  if (updates.size === 0) return documents;
  return documents.map((document) => updates.get(document.id) ?? document);
}

/** The ids still being read, once each, in list order. */
export function processingIds(documents: readonly KnowledgeDocument[], extra: readonly number[] = []): readonly number[] {
  const ids = [...documents.filter((document) => isProcessing(document.status)).map((document) => document.id), ...extra];
  return [...new Set(ids)];
}
