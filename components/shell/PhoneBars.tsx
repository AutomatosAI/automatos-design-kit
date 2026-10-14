import Link from "next/link";

import { NAV_ITEMS, isActive } from "./nav";
import styles from "./shell.module.css";

/** The phone tab bar (below 768 px, where the sidebar hides): the kit's four pages. */
export function PhoneTabBar({ pathname }: { readonly pathname: string }) {
  return (
    <nav className={styles.tabBar} aria-label="Tabs">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className={styles.tabLink}
          aria-current={isActive(item.href, pathname) ? "page" : undefined}
        >
          {item.tabLabel}
        </Link>
      ))}
    </nav>
  );
}
