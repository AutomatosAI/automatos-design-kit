import type { UploadProgress } from "@/lib/documents/types";

// How the browser sends a document: XMLHttpRequest, because fetch can't report how much
// of a request body has gone (the page shows a bar while a 50 MB file is sent). The
// body is the FormData itself: the browser writes the multipart boundary into the
// Content-Type, so the caller never sets one. Tests pass their own sender.

export interface UploadRequest {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: FormData;
  readonly onProgress?: (progress: UploadProgress) => void;
  readonly signal?: AbortSignal;
}

/** What came back: the status and the JSON body (null when it wasn't JSON). */
export interface UploadReply {
  readonly status: number;
  readonly body: unknown;
}

export type UploadSender = (request: UploadRequest) => Promise<UploadReply>;

/** Play's own server didn't answer (status 0), as transport.ts says for fetch. */
export class UploadUnreachable extends Error {
  constructor() {
    super("Play couldn't reach its own server. Is it still running?");
    this.name = "UploadUnreachable";
  }
}

function jsonOrNull(raw: string): unknown {
  try {
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

function abortError(): DOMException {
  return new DOMException("The upload was stopped.", "AbortError");
}

export const xhrUpload: UploadSender = ({ url, headers, body, onProgress, signal }) =>
  new Promise<UploadReply>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const xhr = new XMLHttpRequest();
    const stop = () => xhr.abort();
    signal?.addEventListener("abort", stop, { once: true });
    const settle = () => signal?.removeEventListener("abort", stop);
    xhr.open("POST", url);
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.({ loaded: event.loaded, total: event.total });
    };
    xhr.onload = () => {
      settle();
      resolve({ status: xhr.status, body: jsonOrNull(xhr.responseText) });
    };
    xhr.onerror = () => {
      settle();
      reject(new UploadUnreachable());
    };
    xhr.onabort = () => {
      settle();
      reject(abortError());
    };
    xhr.send(body);
  });
