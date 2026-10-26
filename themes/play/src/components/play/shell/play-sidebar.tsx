'use client'

import { CHAT_HREF, HostLink, useHealth, useHostPathname } from '@automatos/theme-sdk'

import { ConnectionPill } from './connection-pill'
import { resolvePlayActiveId } from './play-nav'
import styles from './play-sidebar.module.css'
import { FooterList, MAIN_NAV_LABEL, NavGroupList, NewChatButton, RecentList, usePlayNav } from './sidebar-parts'

/**
 * PRD-260 T-004 — Play's sidebar (Ember mock 01), ported from Automatos Play's
 * components/shell/Sidebar.tsx onto the core: the wordmark, New chat (a draft in
 * the chat session store, then /chat), every core page grouped as the Studio menu
 * has them (play-nav.ts), Recent (getChatHistory) and the connection pill (GET
 * /health). Rendered by PlayFrame from 1024 px up (a phone gets its menu). PRD-261 A-14f:
 * each of those reaches the core through '@automatos/theme-sdk' (useStartChat,
 * useCoreNav, useRecentChats, useHealth, HostLink).
 *
 * Play 1.1.1: the nav and Recent scroll between New chat and the foot, Recent's
 * own list scrolling in what the nav leaves, so Docs, Settings and the pill stay
 * in view on a laptop's window; Recent lines up with the nav, one line a title.
 *
 * Play 1.2.0: its parts (New chat, the grouped nav, Recent, Docs and Settings) are sidebar-parts.tsx's, which the
 * phone menu (phone-menu.tsx) draws too.
 */

export function PlaySidebar() {
  const pathname = useHostPathname()
  const nav = usePlayNav()
  const activeId = resolvePlayActiveId(pathname)
  const backend = useHealth()
  return (
    <aside className={styles.sidebar} aria-label="Sidebar">
      <HostLink href={CHAT_HREF} className={styles.wordmark}>
        <span>
          Automatos <span className={styles.wordmarkAccent}>Play</span>
        </span>
      </HostLink>
      <NewChatButton />
      <div className={styles.scroller}>
        <nav aria-label={MAIN_NAV_LABEL} className={styles.navGroups}>
          {nav.groups.map((group) => (
            <NavGroupList key={group.id} group={group} activeId={activeId} />
          ))}
        </nav>
        <RecentList onChat={pathname === CHAT_HREF} />
      </div>
      <div className={styles.foot}>
        <FooterList items={nav.footer} activeId={activeId} />
        <ConnectionPill connection={backend.connection} host={backend.host} />
      </div>
    </aside>
  )
}
