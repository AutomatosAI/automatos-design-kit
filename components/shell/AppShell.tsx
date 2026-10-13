"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { ConnectionStatus } from "./ConnectionPill";
import { PhoneTabBar, PhoneTopBar } from "./PhoneBars";
import { Sidebar, type RecentChat, type ShellCounts } from "./Sidebar";
import { phoneChrome } from "./nav";
import styles from "./shell.module.css";

export interface AppShellProps {
  readonly children: ReactNode;
  /** Shown in the phone top bar on the chat. */
  readonly title?: string;
  readonly counts?: ShellCounts;
  readonly recent?: readonly RecentChat[];
  readonly connection?: ConnectionStatus;
  readonly host?: string;
}

const NO_COUNTS: ShellCounts = {};
const NO_RECENT: readonly RecentChat[] = [];

/**
 * The frame around every page (mock 01): the sidebar on desktop, the phone
 * bars below 768 px, and the page in between. Pages that show Auto add the
 * mascot column themselves with PageColumns.
 */
export function AppShell({
  children,
  title = "Chat",
  counts = NO_COUNTS,
  recent = NO_RECENT,
  connection = "checking",
  host,
}: AppShellProps) {
  const pathname = usePathname();
  const chrome = phoneChrome(pathname);
  return (
    <div className={styles.shell}>
      <Sidebar pathname={pathname} counts={counts} recent={recent} connection={connection} host={host} />
      <div className={styles.content}>
        {chrome.topBar && <PhoneTopBar title={title} />}
        {children}
        {chrome.tabBar && <PhoneTabBar pathname={pathname} />}
      </div>
    </div>
  );
}
