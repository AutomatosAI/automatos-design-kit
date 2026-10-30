import { type KeyboardEvent, useId, useState } from 'react'
import { HostLink } from '@automatos/theme-sdk'

import type { Menu, MenuItem } from './menu'
import styles from './frame.module.css'

/**
 * The menu's links (the sidebar's and the phone's): each a pill with a round dot in its card colour, the page on
 * screen filled with the accent and marked aria-current. More opens the rest of the host's pages in place; it opens
 * by itself when the page on screen is one of them. The arrow keys move the focus through the links, Home and End
 * jump to the ends.
 */

export const MORE_LABEL = 'More'
export const MENU_ITEM = 'data-candy-menu-item'

export function moveFocus(event: KeyboardEvent<HTMLElement>): void {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(`[${MENU_ITEM}]`))
  if (items.length === 0) return
  const at = items.indexOf(document.activeElement as HTMLElement)
  const last = items.length - 1
  const step = event.key === 'ArrowDown' ? 1 : -1
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? last : (at + step + items.length) % items.length
  items[next]?.focus()
  event.preventDefault()
}

export function MenuLink({ item, current }: { readonly item: MenuItem; readonly current: boolean }) {
  return (
    <HostLink href={item.href} className={styles.item} aria-current={current ? 'page' : undefined} data-candy-menu-item="">
      <span className={styles.itemDot} data-set={item.set} aria-hidden="true">
        <span className={styles.itemDotInner} />
      </span>
      <span className={styles.itemLabel}>{item.label}</span>
    </HostLink>
  )
}

function Items({ items, activeId }: { readonly items: readonly MenuItem[]; readonly activeId: string | null }) {
  return (
    <ul className={styles.items}>
      {items.map((entry) => (
        <li key={entry.id}>
          <MenuLink item={entry} current={entry.id === activeId} />
        </li>
      ))}
    </ul>
  )
}

export function MenuList({ menu, activeId }: { readonly menu: Menu; readonly activeId: string | null }) {
  const moreId = useId()
  const onMore = menu.more.some((entry) => entry.id === activeId)
  const [open, setOpen] = useState(onMore)
  const shown = open || onMore
  return (
    <div className={styles.menu} onKeyDown={moveFocus}>
      <Items items={menu.main} activeId={activeId} />
      {menu.more.length > 0 && (
        <>
          <button type="button" className={styles.more} aria-expanded={shown} aria-controls={moreId} onClick={() => setOpen(!shown)}>
            <span className={styles.moreGlyph} aria-hidden="true">
              {shown ? '−' : '+'}
            </span>
            {MORE_LABEL}
          </button>
          <div id={moreId} hidden={!shown}>
            <Items items={menu.more} activeId={activeId} />
          </div>
        </>
      )}
      <Items items={[menu.look]} activeId={activeId} />
    </div>
  )
}
