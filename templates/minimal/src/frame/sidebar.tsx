import { HostLink, resolveActiveNavId, useCoreNav, useHostPathname } from '@automatos/theme-sdk'

import { THEME_NAME } from '../theme'
import { coreGroups, THEME_GROUP, themeScreenId, type NavGroup, type NavItem } from './nav'
import styles from './frame.module.css'

/**
 * The frame's sidebar: the theme's name, the host's menu and the theme's screens, the item for the page on screen
 * marked as the current page. Docs and Settings stay at its foot, where the host's own sidebar has them.
 */

export const SIDEBAR_LABEL = 'Sidebar'
export const MAIN_NAV_LABEL = 'Main'

function NavLink({ item, current }: { readonly item: NavItem; readonly current: boolean }) {
  return (
    <HostLink href={item.href} className={styles.link} aria-current={current ? 'page' : undefined}>
      {item.label}
    </HostLink>
  )
}

function Group({ group, activeId }: { readonly group: NavGroup; readonly activeId: string | null }) {
  return (
    <div className={styles.group}>
      <p className={styles.groupLabel}>{group.label}</p>
      <ul className={styles.items}>
        {group.items.map((item) => (
          <li key={item.id}>
            <NavLink item={item} current={item.id === activeId} />
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Sidebar() {
  const nav = useCoreNav()
  const pathname = useHostPathname()
  const themeId = themeScreenId(pathname)
  const activeId = themeId ?? resolveActiveNavId(pathname)
  return (
    <aside className={styles.sidebar} aria-label={SIDEBAR_LABEL}>
      <p className={styles.wordmark}>{THEME_NAME}</p>
      <nav className={styles.nav} aria-label={MAIN_NAV_LABEL}>
        {[...coreGroups(nav.primary), THEME_GROUP].map((group) => (
          <Group key={group.id} group={group} activeId={activeId} />
        ))}
      </nav>
      <ul className={styles.footer}>
        {nav.footer.map((item) => (
          <li key={item.id}>
            <NavLink item={item} current={item.id === activeId} />
          </li>
        ))}
      </ul>
    </aside>
  )
}
