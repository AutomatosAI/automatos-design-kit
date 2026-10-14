// The Knowledge shapes Play uses (knowledge.md; the core's orchestrator/api/documents.py).
// camelCase, built by the parsers in lib/documents/parse.ts from untrusted backend JSON.

/** One document in the list or on its page (the core's DocumentResponse). */
export type KnowledgeDocument = {
  readonly id: number;
  readonly filename: string;
  /** The core's category: pdf, markdown, text, document, json, csv, spreadsheet, unknown. */
  readonly fileType: string;
  readonly fileSize: number | null;
  /** uploaded, processing, processed, failed, duplicate (the queue says completed and pending too). */
  readonly status: string;
  readonly chunkCount: number | null;
  readonly uploadDate: string | null;
  readonly processedDate: string | null;
  readonly description: string | null;
  readonly tags: readonly string[];
  /** The share of the text the stored chunks hold (F086), when the core measured it. */
  readonly keptPercent: number | null;
  /** True when the core says too little was kept (under its RAG_KEPT_WARN_PCT). */
  readonly partial: boolean;
};

export type DocumentQuery = {
  readonly skip?: number;
  readonly limit?: number;
};

/** The full text, rebuilt from the chunks (GET /content). */
export type DocumentContent = {
  readonly documentId: number;
  readonly filename: string;
  readonly fileType: string;
  readonly content: string;
  readonly chunkCount: number;
};

/** What a delete takes with it (GET /delete-impact). */
export type DeleteImpact = {
  readonly vectorChunks: number;
  readonly embeddings: number;
  readonly references: number;
  /** "1.20 MB", as the core words it. */
  readonly storageFreed: string | null;
};

export type SearchResult = {
  readonly documentId: number;
  readonly excerpt: string;
  /** 0-1 from the retrieval funnel. */
  readonly similarity: number | null;
  readonly filename: string;
  readonly fileType: string;
};

export type SearchAnswer = {
  readonly query: string;
  readonly results: readonly SearchResult[];
};

/** The upload's answer: the backend processes the file before it replies. */
export type UploadResult = {
  readonly documentId: number;
  readonly filename: string;
  /** processed, failed or duplicate; a replaced document can still say processing. */
  readonly status: string;
  readonly message: string;
};

export type UploadProgress = {
  readonly loaded: number;
  readonly total: number;
};
