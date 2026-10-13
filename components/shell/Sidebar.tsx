import Link from "next/link";
import { useId } from "react";
import { ConnectionPill, type ConnectionStatus } from "./ConnectionPill";
import { NAV_ITEMS, isActive, type NavId } from "./nav";
import styles from "./shell.module.css";

export type ShellCounts = Readonly<Partial<Record<NavId, number>>>;

export interface RecentChat {
  readonly id: string;
  readonly title: string;
}

export interface SidebarProps {
  readonly pathname: string;
  readonly counts: ShellCounts;
  readonly recent: readonly RecentChat[];
  readonly connection: ConnectionStatus;
  readonly host?: string;
}

export function Sidebar({ pathname, counts, recent, connection, host }: SidebarProps) {
  return (
    <aside className={styles.sidebar} aria-label="Sidebar">
      <Link href="/" className={styles.wordmark}>
        <span className={styles.wordmarkRing} aria-hidden="true" />
        <span>
          Automatos <span className={styles.wordmarkAccent}>Play</span>
        </span>
      </Link>
      <Link href="/" className={styles.primaryButton}>
        New chat
      </Link>
      <nav aria-label="Main">
        <ul className={styles.list}>
          {NAV_ITEMS.map((item) => {
            const count = counts[item.id];
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={styles.navLink}
                  aria-current={isActive(item.href, pathname) ? "page" : undefined}
                >
                  {item.label}
                  {count !== undefined && <span className={styles.count}> {count}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <RecentList recent={recent} />
      <ConnectionPill status={connection} host={host} />
    </aside>
  );
}

function RecentList({ recent }: { readonly recent: readonly RecentChat[] }) {
  const headingId = useId();
  if (recent.length === 0) return null;
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.sectionLabel}>
        Recent
      </h2>
      <ul className={styles.list}>
        {recent.map((chat) => (
          <li key={chat.id}>
            <Link href={`/?chat=${encodeURIComponent(chat.id)}`} className={styles.recentLink}>
              {chat.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
