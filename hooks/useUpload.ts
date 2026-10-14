"use client";

// One upload at a time from the Knowledge page (PRD-003 P-010). The browser checks the
// type and size first (lib/documents/rules.ts); then the file goes with X-Play-Upload: 1,
// the bar follows the bytes, Auto reads while the backend processes, and the answer
// (processed, failed, duplicate) becomes the phase. onAnswered lets the page reload its
// list. Leaving the page stops an upload still on its way.

import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, type ApiClient } from "@/lib/client/api";
import { checkFile } from "@/lib/documents/rules";
import type { UploadProgress } from "@/lib/documents/types";
import { answeredPhase, IDLE, sendingPhase, type UploadPhase } from "@/lib/documents/upload";
import type { MascotName } from "@/lib/mascot/types";

export const UPLOAD_FAILED = "Play couldn't upload it.";

export interface Upload {
  readonly phase: UploadPhase;
  /** The celebrate for this upload has played. */
  readonly celebrated: boolean;
  readonly start: (file: File) => void;
  /** Auto's one-shot ended (AutoMascot's onClipEnded). */
  readonly onClipEnded: (state: MascotName) => void;
  readonly dismiss: () => void;
}

function failedSentence(error: unknown): string {
  return error instanceof ApiError ? `${UPLOAD_FAILED} ${error.message}` : UPLOAD_FAILED;
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function useUpload(client: ApiClient, onAnswered: () => void): Upload {
  const [phase, setPhase] = useState<UploadPhase>(IDLE);
  const [celebrated, setCelebrated] = useState(false);
  const controller = useRef<AbortController | null>(null);
  // The request is open (sending or being read). A "processing" answer has closed it: the
  // page polls that document, and another file may go meanwhile.
  const inFlight = useRef(false);
  const answered = useRef(onAnswered);

  useEffect(() => {
    answered.current = onAnswered;
  }, [onAnswered]);

  useEffect(() => () => controller.current?.abort(), []);

  const start = useCallback(
    (file: File) => {
      if (inFlight.current) return;
      const check = checkFile(file);
      if (!check.ok) {
        setPhase({ kind: "refused", fileName: file.name, reason: check.reason });
        return;
      }
      const abort = new AbortController();
      controller.current = abort;
      inFlight.current = true;
      setCelebrated(false);
      setPhase(sendingPhase(file.name, { loaded: 0, total: file.size }));
      const onProgress = (progress: UploadProgress) => {
        if (!abort.signal.aborted) setPhase(sendingPhase(file.name, progress));
      };
      client.uploadDocument(file, { onProgress, signal: abort.signal }).then(
        (result) => {
          inFlight.current = false;
          setPhase(answeredPhase(file.name, result));
          answered.current();
        },
        (error: unknown) => {
          inFlight.current = false;
          if (isAbort(error)) return; // the page has gone: nobody to tell
          console.error(`[knowledge] ${UPLOAD_FAILED}`, error);
          setPhase({ kind: "failed", fileName: file.name, message: failedSentence(error) });
        },
      );
    },
    [client],
  );

  const onClipEnded = useCallback((state: MascotName) => {
    if (state === "celebrate") setCelebrated(true);
  }, []);

  const dismiss = useCallback(() => setPhase(IDLE), []);

  return { phase, celebrated, start, onClipEnded, dismiss };
}
