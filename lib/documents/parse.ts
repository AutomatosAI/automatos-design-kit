import { count, isRecord, listOf, text } from "@/lib/client/types";

import type {
  DeleteImpact,
  DocumentContent,
  KnowledgeDocument,
  SearchAnswer,
  SearchResult,
  UploadResult,
} from "./types";

// Backend JSON -> the Knowledge shapes. Untrusted: a row without a whole-number id is
// dropped, anything else missing or of the wrong type becomes null or a safe default.

function documentId(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function wholeOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function strings(value: unknown): readonly string[] {
  return listOf(value, (item) => {
    const tag = text(item)?.trim();
    return tag ? tag : null;
  });
}

export function parseDocument(value: unknown): KnowledgeDocument | null {
  if (!isRecord(value)) return null;
  const id = documentId(value.id);
  if (id === null) return null;
  return {
    id,
    filename: text(value.filename) ?? text(value.original_filename) ?? "",
    fileType: text(value.file_type) ?? "unknown",
    fileSize: wholeOrNull(value.file_size),
    status: text(value.status) ?? "unknown",
    chunkCount: wholeOrNull(value.chunk_count),
    uploadDate: text(value.upload_date),
    processedDate: text(value.processed_date),
    description: text(value.description)?.trim() || null,
    tags: strings(value.tags),
    keptPercent: wholeOrNull(value.kept_pct),
    partial: value.partial === true,
  };
}

export function parseDocumentList(value: unknown): readonly KnowledgeDocument[] {
  return listOf(value, parseDocument);
}

export function parseDocumentContent(value: unknown, id: number): DocumentContent {
  const body = isRecord(value) ? value : {};
  return {
    documentId: documentId(body.document_id) ?? id,
    filename: text(body.filename) ?? "",
    fileType: text(body.file_type) ?? "unknown",
    content: text(body.content) ?? "",
    chunkCount: count(body.chunk_count, 0),
  };
}

export function parseDeleteImpact(value: unknown): DeleteImpact {
  const body = isRecord(value) ? value : {};
  return {
    vectorChunks: count(body.vector_chunks, 0),
    embeddings: count(body.embeddings, 0),
    references: count(body.references, 0),
    storageFreed: text(body.storage_freed),
  };
}

function parseSearchResult(value: unknown): SearchResult | null {
  if (!isRecord(value)) return null;
  const id = documentId(value.document_id);
  if (id === null) return null;
  const source = isRecord(value.source) ? value.source : {};
  const similarity = typeof value.similarity === "number" && Number.isFinite(value.similarity) ? value.similarity : null;
  return {
    documentId: id,
    excerpt: text(value.excerpt) ?? "",
    similarity,
    filename: text(source.filename) ?? "",
    fileType: text(source.file_type) ?? "unknown",
  };
}

export function parseSearchAnswer(value: unknown, query: string): SearchAnswer {
  const body = isRecord(value) ? value : {};
  return { query: text(body.query) ?? query, results: listOf(body.results, parseSearchResult) };
}

/** Null when the answer names no document (Play can't follow it up). */
export function parseUploadResult(value: unknown): UploadResult | null {
  if (!isRecord(value)) return null;
  const id = documentId(value.document_id);
  if (id === null) return null;
  return {
    documentId: id,
    filename: text(value.filename) ?? "",
    status: text(value.status) ?? "unknown",
    message: text(value.message) ?? "",
  };
}
