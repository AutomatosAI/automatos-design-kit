// One request's answer as render state: loading, ready or failed (with a retry).
// Pass a memoised load (useCallback): a new function loads again.

import { useCallback, useEffect, useState } from "react";

import { ApiError } from "@/lib/client/api";

export type Loaded<T> =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly value: T }
  | { readonly status: "failed"; readonly error: string; readonly retry: () => void };

const LOADING = { status: "loading" } as const;

/** The friendly sentence, then what Play's client said (it has no internals in it). */
function failureMessage(failed: string, error: unknown): string {
  return error instanceof ApiError ? `${failed} ${error.message}` : failed;
}

/** failed is the sentence users see; the console gets the error itself, under label. */
export function useLoad<T>(load: () => Promise<T>, failed: string, label: string): Loaded<T> {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<Loaded<T>>(LOADING);
  const retry = useCallback(() => setAttempt((count) => count + 1), []);

  useEffect(() => {
    let live = true;
    setState(LOADING);
    load().then(
      (value) => {
        if (live) setState({ status: "ready", value });
      },
      (error: unknown) => {
        console.error(`[${label}] ${failed}`, error);
        if (live) setState({ status: "failed", error: failureMessage(failed, error), retry });
      },
    );
    return () => {
      live = false;
    };
  }, [load, failed, label, attempt, retry]);

  return state;
}
