'use client'

import { type KeyboardEvent, type MouseEvent, useEffect, useRef } from 'react'
import { CHAT_HREF, HeaderUtilities, openGlobalSearch, useHealth, useHostPathname } from '@automatos/theme-sdk'

import { ConnectionPill } from './connection-pill'
import { focusables, trapKey } from './focus-trap'
import styles from './phone.module.css'
import { resolvePlayActiveId } from './play-nav'
import sidebar from './play-sidebar.module.css'
import { FooterList, MAIN_NAV_LABEL, NavGroupList, NewChatButton, RecentList, usePlayNav } from './sidebar-parts'
import type { PhoneMenuState } from './use-phone-menu'

/**
 * Play 1.2.0 — the frame's menu on a phone, which Menu in the phone's top bar opens (phone-bar.tsx), after HUD's
 * (themes/hud/src/frame/nav-drawer.tsx): a modal panel from the left edge over a glass, holding what the desktop's
 * sidebar and header row hold and a phone has no room for, in the sidebar's own words and styles (sidebar-parts.tsx):
 * New chat and search; the nav in its groups with Conversations after Chat and Look on its own; Recent; Docs and
 * Settings with the connection pill; then the host's header utilities (Help, notifications, the theme menu and the
 * account). It stays mounted while shut (hidden), so the frame always renders the host's utilities, as every frame
 * must. Open, it takes the focus (its Close button first), keeps Tab inside it (focus-trap.ts), and Esc, Close or a
 * tap on the glass shut it, handing the focus back to Menu (use-phone-menu.ts); a link followed, New chat or search
 * shuts it for what it opens.
 */

export const MENU_TITLE = 'Menu'
export const CLOSE_LABEL = 'Close menu'
export const SEARCH_LABEL = 'Search'
/** What shuts the menu when pressed, as following a link does: a link, New chat and search. */
const LEAVES_MENU = 'a, [data-leaves-menu]'

export interface PhoneMenuProps {
  readonly menu: PhoneMenuState
  readonly id: string
}

/** Focus the menu's first control as it opens. */
function useFocusOnOpen(open: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (open && ref.current !== null) focusables(ref.current)[0]?.focus()
  }, [open])
  return ref
}

/** The sidebar's lists: the nav in its groups, Recent, then Docs and Settings and the connection pill. */
function MenuLists() {
  const pathname = useHostPathname()
  const nav = usePlayNav()
  const activeId = resolvePlayActiveId(pathname)
  const backend = useHealth()
  return (
    <>
      <nav aria-label={MAIN_NAV_LABEL} className={sidebar.navGroups}>
        {nav.groups.map((group) => (
          <NavGroupList key={group.id} group={group} activeId={activeId} />
        ))}
      </nav>
      <RecentList onChat={pathname === CHAT_HREF} />
      <div className={sidebar.foot}>
        <FooterList items={nav.footer} activeId={activeId} />
        <ConnectionPill connection={backend.connection} host={backend.host} />
      </div>
    </>
  )
}

export function PhoneMenu({ menu, id }: PhoneMenuProps) {
  const ref = useFocusOnOpen(menu.open)
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (ref.current !== null) trapKey(event, ref.current, menu.dismiss)
  }
  const onClick = (event: MouseEvent<HTMLDivElement>): void => {
    const { target } = event
    if (target instanceof Element && ref.current?.contains(target) && target.closest(LEAVES_MENU) !== null) menu.leave()
  }
  return (
    <div className={styles.layer} hidden={!menu.open}>
      <div className={styles.glass} aria-hidden="true" onClick={menu.dismiss} />
      <div ref={ref} id={id} className={styles.menu} role="dialog" aria-modal="true" aria-label={MENU_TITLE} onKeyDown={onKeyDown} onClick={onClick}>
        <div className={styles.menuHead}>
          <span className={styles.wordmark} aria-hidden="true">
            <span className={styles.wordmarkText}>
              Automatos <span className={styles.wordmarkAccent}>Play</span>
            </span>
          </span>
          <button type="button" className={styles.close} aria-label={CLOSE_LABEL} onClick={menu.dismiss}>
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <div className={styles.menuActions}>
          <span className={styles.action} data-leaves-menu="">
            <NewChatButton />
          </span>
          <button type="button" className={styles.search} data-leaves-menu="" onClick={openGlobalSearch}>
            {SEARCH_LABEL}
          </button>
        </div>
        <MenuLists />
        <div className={styles.utilities}>
          <HeaderUtilities />
        </div>
      </div>
    </div>
  )
}
