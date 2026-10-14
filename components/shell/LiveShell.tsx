"use client";

import type { ReactNode } from "react";

import { AsleepScreen } from "@/components/edges/AsleepScreen";
import { type BackendStatus, RECHECK_MS, useBackendStatus } from "@/hooks/useBackendStatus";
import { useRecentChats } from "@/hooks/useRecentChats";
import type { ApiClient } from "@/lib/client/api";

import { AppShell } from "./AppShell";
import type { ConnectionStatus } from "./ConnectionPill";

export interface LiveShellProps {
  readonly children: ReactNode;
  /** Tests pass their own (createApiClient with a mock fetch). */
  readonly client?: ApiClient;
  /** How often to ask again while Automatos is asleep (tests shorten it). */
  readonly recheckMs?: number;
}

const MS_PER_SECOND = 1000;

function connectionOf(status: BackendStatus): ConnectionStatus {
  switch (status.kind) {
    case "up":
      return "connected";
    case "checking":
      return "checking";
    case "asleep":
    case "unknown":
      return "down";
  }
}

/**
 * AppShell fed with live data: the latest conversations in the sidebar's Recent list and
 * the connection pill. While Automatos isn't running the whole window is the asleep
 * screen (mock 07); the pages mount again, fresh, once it answers.
 */
export function LiveShell({ children, client, recheckMs = RECHECK_MS }: LiveShellProps) {
  const backend = useBackendStatus(client, recheckMs);
  const recent = useRecentChats(client, backend.status.kind === "up" || backend.status.kind === "unknown");
  if (backend.status.kind === "asleep") {
    return (
      <AsleepScreen
        detail={backend.status.message}
        onCheck={backend.check}
        recheckSeconds={Math.round(recheckMs / MS_PER_SECOND)}
      />
    );
  }
  return (
    <AppShell recent={recent} connection={connectionOf(backend.status)}>
      {children}
    </AppShell>
  );
}
