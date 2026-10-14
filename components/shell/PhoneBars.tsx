"use client";

import Link from "next/link";
import { useCallback, useId, useRef, useState } from "react";
import { MoreSheet } from "./MoreSheet";
import { MORE_ITEMS, PHONE_TABS, isActive, isMoreActive } from "./nav";
import styles from "./shell.module.css";

/** Phone top bar on the chat (mock 01 phone): Chats · title · Shelf. */
export function PhoneTopBar({ title }: { readonly title: string }) {
  return (
    <header className={styles.topBar}>
      <Link href="/conversations" className={styles.barLink}>
        Chats
      </Link>
      <span className={styles.topBarTitle}>{title}</span>
      <Link href="/deliverables" className={styles.barLink}>
        Shelf
      </Link>
    </header>
  );
}

/**
 * Phone bottom tab bar on the lists (PRD-003): Chats · Missions · Shelf · More.
 * More opens a sheet with the other pages and Look. The sheet remembers the page
 * it was opened on, so moving to another page closes it.
 */
export function PhoneTabBar({ pathname }: { readonly pathname: string }) {
  const [openOn, setOpenOn] = useState<string | null>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const sheetId = useId();
  const open = openOn === pathname;

  const close = useCallback(() => {
    setOpenOn(null);
    moreRef.current?.focus();
  }, []);

  /** A page was picked: the new page takes focus, so it doesn't go back to More. */
  function picked() {
    setOpenOn(null);
  }

  return (
    <>
      <nav className={styles.tabBar} aria-label="Tabs">
        {PHONE_TABS.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            className={styles.tabLink}
            aria-current={isActive(tab.href, pathname) ? "page" : undefined}
          >
            {tab.label}
          </Link>
        ))}
        <button
          ref={moreRef}
          type="button"
          className={styles.moreTab}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? sheetId : undefined}
          data-current={isMoreActive(pathname) ? "true" : undefined}
          onClick={() => setOpenOn(pathname)}
        >
          More
        </button>
      </nav>
      {open && <MoreSheet id={sheetId} items={MORE_ITEMS} pathname={pathname} onClose={close} onPick={picked} />}
    </>
  );
}
