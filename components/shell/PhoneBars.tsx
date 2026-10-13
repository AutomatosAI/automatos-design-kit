import Link from "next/link";
import { PHONE_TABS, isActive } from "./nav";
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

/** Phone bottom tab bar on the lists (mocks 03 and 04 phone): Chats / Shelf. */
export function PhoneTabBar({ pathname }: { readonly pathname: string }) {
  return (
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
    </nav>
  );
}
