// Is Automatos running? Asks GET /api/workspace (through the proxy) when Play opens. A
// 502 means the backend isn't answering: Play shows the asleep screen and asks again
// every 10 seconds, or at once on "Check again", until it answers.

import { useCallback, useEffect, useState } from "react";

import { api, type ApiClient, ApiError } from "@/lib/client/api";

export const RECHECK_MS = 10_000;
const BACKEND_DOWN_STATUS = 502;

/** asleep: the proxy said 502. unknown: another failure (the pages show their own errors). */
export type BackendStatus =
  | { readonly kind: "checking" }
  | { readonly kind: "up"; readonly workspace: string }
  | { readonly kind: "asleep"; readonly message: string }
  | { readonly kind: "unknown" };

export type BackendCheck = {
  readonly status: BackendStatus;
  /** Ask again now ("Check again"). */
  readonly check: () => void;
};

async function askBackend(client: ApiClient): Promise<BackendStatus> {
  try {
    const workspace = await client.getWorkspace();
    return { kind: "up", workspace: workspace.name };
  } catch (error) {
    if (error instanceof ApiError && error.status === BACKEND_DOWN_STATUS) {
      return { kind: "asleep", message: error.message };
    }
    console.error("[backend] couldn't ask Automatos which workspace to use:", error);
    return { kind: "unknown" };
  }
}

export function useBackendStatus(client: ApiClient = api, recheckMs: number = RECHECK_MS): BackendCheck {
  const [status, setStatus] = useState<BackendStatus>({ kind: "checking" });
  const [asks, setAsks] = useState(0);

  useEffect(() => {
    let live = true;
    void askBackend(client).then((next) => {
      if (live) setStatus(next);
    });
    return () => {
      live = false;
    };
  }, [client, asks]);

  const asleep = status.kind === "asleep";
  useEffect(() => {
    if (!asleep) return;
    const timer = setInterval(() => setAsks((n) => n + 1), recheckMs);
    return () => clearInterval(timer);
  }, [asleep, recheckMs]);

  const check = useCallback(() => setAsks((n) => n + 1), []);
  return { status, check };
}
