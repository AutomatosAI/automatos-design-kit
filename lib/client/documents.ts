import {
  parseDeleteImpact,
  parseDocument,
  parseDocumentContent,
  parseDocumentList,
  parseSearchAnswer,
  parseUploadResult,
} from "@/lib/documents/parse";
import { UPLOAD_HEADER, UPLOAD_HEADER_VALUE } from "@/lib/documents/rules";
import type {
  DeleteImpact,
  DocumentContent,
  DocumentQuery,
  KnowledgeDocument,
  SearchAnswer,
  UploadProgress,
  UploadResult,
} from "@/lib/documents/types";
import { ApiError, errorMessage, failure, type Transport, WORKSPACE_HEADER } from "@/lib/client/transport";
import { type UploadSender, UploadUnreachable } from "@/lib/client/upload";

// The Knowledge calls (knowledge.md), through Play's /api/documents routes. Never
// /reprocess: the processing poll reads GET /api/documents/<id>.

const DEFAULT_DOCUMENT_LIMIT = 50;
const UPLOAD_PATH = "/api/documents/upload";
const UNREACHABLE = 0;

export function documentPath(id: number, suffix = ""): string {
  return `/api/documents/${encodeURIComponent(String(id))}${suffix}`;
}

/** Play's download route: a plain link (302 to S3, or the bytes streamed by Play's server). */
export function documentDownloadHref(id: number): string {
  return documentPath(id, "/download");
}

function documentsSearch(query: DocumentQuery): string {
  return new URLSearchParams({
    skip: String(query.skip ?? 0),
    limit: String(query.limit ?? DEFAULT_DOCUMENT_LIMIT),
  }).toString();
}

export interface UploadOptions {
  readonly onProgress?: (progress: UploadProgress) => void;
  readonly signal?: AbortSignal;
}

export function documentEndpoints({ call, callJson, getWorkspace }: Transport, sendUpload: UploadSender) {
  return {
    /** The workspace's documents, newest first. */
    async listDocuments(query: DocumentQuery = {}): Promise<readonly KnowledgeDocument[]> {
      return parseDocumentList(await callJson(`/api/documents?${documentsSearch(query)}`));
    },

    /** One document with its status: the processing poll reads this. */
    async getDocument(id: number): Promise<KnowledgeDocument> {
      const parsed = parseDocument(await callJson(documentPath(id)));
      if (!parsed) throw new ApiError(200, "Automatos sent a document Play can't read");
      return parsed;
    },

    /** The full text, rebuilt from the chunks on every call: only when the page is opened. */
    async documentContent(id: number): Promise<DocumentContent> {
      return parseDocumentContent(await callJson(documentPath(id, "/content")), id);
    },

    async deleteImpact(id: number): Promise<DeleteImpact> {
      return parseDeleteImpact(await callJson(documentPath(id, "/delete-impact")));
    },

    /** Resolves once it is gone; the body ({message}) isn't read. */
    async deleteDocument(id: number): Promise<void> {
      const path = documentPath(id);
      const response = await call(path, { method: "DELETE" });
      if (!response.ok) throw await failure(response, path);
    },

    async searchDocuments(query: string): Promise<SearchAnswer> {
      const body = JSON.stringify({ query });
      return parseSearchAnswer(await callJson("/api/documents/search", { method: "POST", body }), query);
    },

    /** Multipart with X-Play-Upload: 1 and no Content-Type of Play's own (the browser adds the boundary). */
    async uploadDocument(file: File, options: UploadOptions = {}): Promise<UploadResult> {
      const { id } = await getWorkspace();
      const form = new FormData();
      form.append("file", file);
      const reply = await sendUpload({
        url: UPLOAD_PATH,
        headers: { [UPLOAD_HEADER]: UPLOAD_HEADER_VALUE, [WORKSPACE_HEADER]: id },
        body: form,
        onProgress: options.onProgress,
        signal: options.signal,
      }).catch((error: unknown) => {
        if (!(error instanceof UploadUnreachable)) throw error;
        console.error(`[api] ${UPLOAD_PATH} did not answer:`, error);
        throw new ApiError(UNREACHABLE, error.message);
      });
      if (reply.status < 200 || reply.status >= 300) {
        console.error(`[api] ${UPLOAD_PATH} failed with ${reply.status}:`, reply.body);
        throw new ApiError(reply.status, errorMessage(reply.body, reply.status));
      }
      const parsed = parseUploadResult(reply.body);
      if (!parsed) throw new ApiError(reply.status, "Automatos took the file but didn't say what happened to it");
      return parsed;
    },
  };
}
