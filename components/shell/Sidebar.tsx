import Link from "next/link";

import { NAV_ITEMS, isActive } from "./nav";
import styles from "./shell.module.css";

/** The desktop sidebar: the kit's name and its four pages. */
export function Sidebar({ pathname }: { readonly pathname: string }) {
  return (
    <aside className={styles.sidebar} aria-label="Sidebar">
      <Link href="/" className={styles.wordmark}>
        <span>
          Automatos <span className={styles.wordmarkAccent}>Skin Kit</span>
        </span>
      </Link>
      <nav aria-label="Main">
        <ul className={styles.list}>
          {NAV_ITEMS.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className={styles.navLink}
                aria-current={isActive(item.href, pathname) ? "page" : undefined}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <p className={styles.footnote}>Skins for Automatos Studio</p>
    </aside>
  );
}
