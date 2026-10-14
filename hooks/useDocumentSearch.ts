"use client";

// The Knowledge search box (knowledge.md, "Search"): POST /api/documents/search on Enter
// or the Search button, never on every key. Its results take the list's place until the
// box is cleared. An answer to an older query is dropped.

import { useCallback, useRef, useState } from "react";

import { ApiError, type ApiClient } from "@/lib/client/api";
import type { SearchAnswer } from "@/lib/documents/types";

export const SEARCH_FAILED = "Play couldn't search your documents.";

export type SearchState =
  | { readonly kind: "off" }
  | { readonly kind: "running"; readonly query: string }
  | { readonly kind: "done"; readonly answer: SearchAnswer }
  | { readonly kind: "failed"; readonly query: string; readonly error: string };

const OFF: SearchState = { kind: "off" };

export interface DocumentSearch {
  readonly draft: string;
  readonly state: SearchState;
  /** Typing; an emptied box (or its clear button) brings the list back. */
  readonly onChange: (value: string) => void;
  readonly submit: () => void;
  readonly clear: () => void;
  readonly retry: () => void;
}

export function useDocumentSearch(client: ApiClient): DocumentSearch {
  const [draft, setDraft] = useState("");
  const [state, setState] = useState<SearchState>(OFF);
  const latest = useRef(0);

  const run = useCallback(
    (query: string) => {
      const asked = latest.current + 1;
      latest.current = asked;
      setState({ kind: "running", query });
      client.searchDocuments(query).then(
        (answer) => {
          if (latest.current === asked) setState({ kind: "done", answer });
        },
        (error: unknown) => {
          console.error(`[knowledge] ${SEARCH_FAILED}`, error);
          const sentence = error instanceof ApiError ? `${SEARCH_FAILED} ${error.message}` : SEARCH_FAILED;
          if (latest.current === asked) setState({ kind: "failed", query, error: sentence });
        },
      );
    },
    [client],
  );

  const clear = useCallback(() => {
    latest.current += 1;
    setDraft("");
    setState(OFF);
  }, []);

  const onChange = useCallback(
    (value: string) => {
      if (value.trim() === "") clear();
      else setDraft(value);
    },
    [clear],
  );

  const submit = useCallback(() => {
    const query = draft.trim();
    if (query) run(query);
    else clear();
  }, [draft, run, clear]);

  const retry = useCallback(() => {
    if (state.kind === "failed") run(state.query);
  }, [state, run]);

  return { draft, state, onChange, submit, clear, retry };
}
