"use client";

import type { ReactNode } from "react";

import { useRecentChats } from "@/hooks/useRecentChats";
import type { ApiClient } from "@/lib/client/api";

import { AppShell } from "./AppShell";

export interface LiveShellProps {
  readonly children: ReactNode;
  /** Tests pass their own (createApiClient with a mock fetch). */
  readonly client?: ApiClient;
}

/** AppShell fed with live data: the latest conversations in the sidebar's Recent list. */
export function LiveShell({ children, client }: LiveShellProps) {
  const recent = useRecentChats(client);
  return <AppShell recent={recent}>{children}</AppShell>;
}
