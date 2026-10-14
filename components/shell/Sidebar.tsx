import Link from "next/link";
import { useId } from "react";
import { chatHref } from "@/lib/chat/params";
import { ConnectionPill, type ConnectionStatus } from "./ConnectionPill";
import { isActive, visibleGroups, type NavGroup, type NavId } from "./nav";
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
        <span>
          Automatos <span className={styles.wordmarkAccent}>Play</span>
        </span>
      </Link>
      <Link href="/" className={styles.primaryButton}>
        New chat
      </Link>
      <MainNav pathname={pathname} counts={counts} />
      <RecentList recent={recent} />
      <ConnectionPill status={connection} host={host} />
    </aside>
  );
}

/** The grouped nav (PRD-003): a small caps label over each group, Look on its own at the end. */
function MainNav({ pathname, counts }: { readonly pathname: string; readonly counts: ShellCounts }) {
  const baseId = useId();
  return (
    <nav aria-label="Main" className={styles.navGroups}>
      {visibleGroups().map((group) => (
        <NavGroupList
          key={group.id}
          group={group}
          labelId={`${baseId}-${group.id}`}
          pathname={pathname}
          counts={counts}
        />
      ))}
    </nav>
  );
}

interface NavGroupListProps {
  readonly group: NavGroup;
  readonly labelId: string;
  readonly pathname: string;
  readonly counts: ShellCounts;
}

function NavGroupList({ group, labelId, pathname, counts }: NavGroupListProps) {
  const list = (
    <ul className={styles.list}>
      {group.items.map((item) => {
        const count = counts[item.id];
        return (
          <li key={item.id}>
            <Link
              href={item.href}
              className={styles.navLink}
              aria-current={isActive(item.href, pathname) ? "page" : undefined}
            >
              {item.label}
              {/* The space sits outside the span: a span's own text is trimmed in the accessible name. */}
              {count !== undefined && (
                <>
                  {" "}
                  <span className={styles.count}>{count}</span>
                </>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
  if (group.label === null) return list;
  return (
    <div role="group" aria-labelledby={labelId}>
      <span id={labelId} className={styles.groupLabel}>
        {group.label}
      </span>
      {list}
    </div>
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
            <Link href={chatHref(chat.id)} className={styles.recentLink}>
              {chat.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
