'use client'

import { CHAT_HREF, DELIVERABLES_HREF, HostLink, useHostPathname } from '@automatos/theme-sdk'

import styles from './phone.module.css'
import { isUnder } from './play-nav'
import { PLAY_CONVERSATIONS_HREF } from './play-routes'
import type { PhoneMenuState } from './use-phone-menu'

/**
 * Play 1.2.0 — the top bar on a phone (the Ember design's 390 screens): Menu, which opens the phone menu with what the
 * desktop's sidebar and header hold (phone-menu.tsx), the wordmark, which goes to the chat, and the design's two
 * places, Chats (Play's Conversations) and Shelf (the Deliverables), the current one marked with the accent's dot as
 * in the design's tab bar. Menu says whether the menu is open (aria-expanded) and which element it opens
 * (aria-controls). The bar is the page's named banner.
 */

export const TOP_BAR_LABEL = 'Top bar'
export const MENU_LABEL = 'Menu'
export const PLACES_LABEL = 'Chats and shelf'
/** The design's names for Play's two places on a phone. */
export const CHATS_LABEL = 'Chats'
export const SHELF_LABEL = 'Shelf'

export interface PhoneBarProps {
  readonly menu: PhoneMenuState
  /** The menu's id, for aria-controls. */
  readonly menuId: string
}

function Place({ href, label, current }: { readonly href: string; readonly label: string; readonly current: boolean }) {
  return (
    <HostLink href={href} className={styles.place} aria-current={current ? 'page' : undefined}>
      {label}
    </HostLink>
  )
}

export function PhoneBar({ menu, menuId }: PhoneBarProps) {
  const pathname = useHostPathname()
  return (
    <header className={styles.bar} aria-label={TOP_BAR_LABEL}>
      <button
        ref={menu.buttonRef}
        type="button"
        className={styles.menuButton}
        aria-label={MENU_LABEL}
        aria-expanded={menu.open}
        aria-controls={menuId}
        aria-haspopup="dialog"
        onClick={menu.show}
      >
        <span className={styles.menuIcon} aria-hidden="true" />
      </button>
      <HostLink href={CHAT_HREF} className={styles.wordmark}>
        <span className={styles.wordmarkText}>
          Automatos <span className={styles.wordmarkAccent}>Play</span>
        </span>
      </HostLink>
      <nav className={styles.places} aria-label={PLACES_LABEL}>
        <Place href={PLAY_CONVERSATIONS_HREF} label={CHATS_LABEL} current={isUnder(pathname, PLAY_CONVERSATIONS_HREF)} />
        <Place href={DELIVERABLES_HREF} label={SHELF_LABEL} current={isUnder(pathname, DELIVERABLES_HREF)} />
      </nav>
    </header>
  )
}
