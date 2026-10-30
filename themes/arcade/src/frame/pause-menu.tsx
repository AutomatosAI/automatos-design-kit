import { type KeyboardEvent, useId } from 'react'
import { HostLink, useCoreNav, useHostPathname } from '@automatos/theme-sdk'

import { activeMenuId, buildMenu, type MenuGroup, type MenuItem } from './menu'
import styles from './frame.module.css'
import ui from '../ui/ui.module.css'

/**
 * The desktop's pause menu (the design's left window): THEME, HOST PAGES and SYSTEM, each item a link with a ▶
 * cursor beside the page on screen, which is also its aria-current. The arrow keys move the focus through the items,
 * Home and End jump to the ends, and Tab leaves the menu as it would any list of links. The phone's menu
 * (phone-menu.tsx) lists the same groups.
 */

export const MENU_LABEL = 'Pause menu'
const MENU_ITEM = 'data-arcade-menu-item'

function moveFocus(event: KeyboardEvent<HTMLElement>): void {
  const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End']
  if (!keys.includes(event.key)) return
  const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(`[${MENU_ITEM}]`))
  if (items.length === 0) return
  const at = items.indexOf(document.activeElement as HTMLElement)
  const last = items.length - 1
  const next =
    event.key === 'Home' ? 0
      : event.key === 'End' ? last
        : (at + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
  items[next]?.focus()
  event.preventDefault()
}

export function MenuLink({ item, current }: { readonly item: MenuItem; readonly current: boolean }) {
  return (
    <HostLink
      href={item.href}
      className={styles.menuItem}
      aria-current={current ? 'page' : undefined}
      data-arcade-menu-item=""
    >
      <span className={styles.cursor} aria-hidden="true">
        ▶
      </span>
      {item.label}
    </HostLink>
  )
}

export function MenuGroups({ groups, activeId }: { readonly groups: readonly MenuGroup[]; readonly activeId: string | null }) {
  const base = useId()
  return (
    <>
      {groups.map((group) =>
        group.items.length === 0 ? null : (
          <div key={group.id} className={styles.menuGroup} role="group" aria-labelledby={`${base}-${group.id}`}>
            <p id={`${base}-${group.id}`} className={`${ui.label} ${styles.menuHead}`}>
              {group.label}
            </p>
            <ul className={styles.menuList}>
              {group.items.map((item) => (
                <li key={item.id}>
                  <MenuLink item={item} current={item.id === activeId} />
                </li>
              ))}
            </ul>
          </div>
        ),
      )}
    </>
  )
}

export function PauseMenu() {
  const nav = useCoreNav()
  const activeId = activeMenuId(useHostPathname())
  return (
    <nav className={`${ui.window} ${styles.menu}`} aria-label={MENU_LABEL} onKeyDown={moveFocus}>
      <MenuGroups groups={buildMenu(nav)} activeId={activeId} />
    </nav>
  )
}
