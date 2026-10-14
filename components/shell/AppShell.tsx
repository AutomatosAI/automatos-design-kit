"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { PhoneTabBar } from "./PhoneBars";
import { Sidebar } from "./Sidebar";
import styles from "./shell.module.css";

/**
 * The frame around every kit page (PRD-004): the sidebar on desktop, the tab bar below
 * 768 px, and the page in between. It needs no Automatos: only Load into my Automatos and
 * Submit talk to one.
 */
export function AppShell({ children }: { readonly children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className={styles.shell}>
      <Sidebar pathname={pathname} />
      <div className={styles.content}>
        {children}
        <PhoneTabBar pathname={pathname} />
      </div>
    </div>
  );
}
