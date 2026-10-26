'use client'

import { useId, useMemo } from 'react'
import { ExternalLink } from '../../../vendor/lucide-react/index.js'
import { HostLink, chatHref, useCoreNav, useRecentChats, useStartChat } from '@automatos/theme-sdk'

import { buildPlayNav, type PlayNav, type PlayNavGroup, type PlayNavItem } from './play-nav'
import styles from './play-sidebar.module.css'

/**
 * PRD-260 T-004 — the parts of Play's sidebar (play-sidebar.tsx), in its own words and styles: New chat, a nav link,
 * a group of them under its small caps label, Recent and Docs and Settings at the foot. Play 1.2.0 moved them here
 * from the sidebar, so the phone menu (phone-menu.tsx) draws the same ones on a phone. PRD-261 A-14f: each reaches
 * the core through '@automatos/theme-sdk' (useStartChat, useCoreNav, useRecentChats, HostLink).
 */

/** The nav's name, and the foot list's. */
export const MAIN_NAV_LABEL = 'Main'
export const MORE_LABEL = 'More'

/** A conversation the backend has not named yet. */
const UNTITLED_CHAT = 'Conversation'

/** The nav for this edition, role and plan: the core nav (StudioSidebar's filters), Play's pages added. */
export function usePlayNav(): PlayNav {
  // Unknown (no provider) is not an admin: the core nav hides admin-only items, never guesses them in.
  const coreNav = useCoreNav()
  return useMemo(() => buildPlayNav(coreNav), [coreNav])
}

/** Docs and Settings, where Studio keeps its footer; nothing when the edition has none. */
export function FooterList({ items, activeId }: { readonly items: readonly PlayNavItem[]; readonly activeId: string | null }) {
  if (items.length === 0) return null
  return (
    <ul className={styles.list} aria-label={MORE_LABEL}>
      {items.map((item) => (
        <li key={item.id}>
          <NavLink item={item} active={activeId === item.id} />
        </li>
      ))}
    </ul>
  )
}

/** New chat: a fresh draft in the chat session store, then the chat; pressable once the store is hydrated. */
export function NewChatButton() {
  const { startChat, ready } = useStartChat()
  return (
    <button type="button" className={styles.newChat} onClick={startChat} disabled={!ready}>
      New chat
    </button>
  )
}

export function NavLink({ item, active }: { readonly item: PlayNavItem; readonly active: boolean }) {
  if (item.external) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" className={styles.navLink}>
        {item.label}
        <ExternalLink className={styles.externalIcon} aria-hidden="true" />
      </a>
    )
  }
  return (
    <HostLink href={item.href} className={styles.navLink} aria-current={active ? 'page' : undefined}>
      {item.label}
    </HostLink>
  )
}

/** A group: its small caps label over its links; Look has no label and stands alone. */
export function NavGroupList({ group, activeId }: { readonly group: PlayNavGroup; readonly activeId: string | null }) {
  const labelId = useId()
  const list = (
    <ul className={styles.list}>
      {group.items.map((item) => (
        <li key={item.id}>
          <NavLink item={item} active={activeId === item.id} />
        </li>
      ))}
    </ul>
  )
  if (group.label === null) return list
  return (
    <div role="group" aria-labelledby={labelId}>
      <span id={labelId} className={styles.groupLabel}>
        {group.label}
      </span>
      {list}
    </div>
  )
}

/** Recent: the latest conversations, each opening in the chat, a title on one line. Nothing until there is one. */
export function RecentList({ onChat }: { readonly onChat: boolean }) {
  const headingId = useId()
  const { chats: recent, activeChatId } = useRecentChats()
  if (recent.length === 0) return null
  return (
    <section aria-labelledby={headingId} className={styles.recent}>
      <h2 id={headingId} className={styles.sectionLabel}>
        Recent
      </h2>
      <ul className={`${styles.list} ${styles.recentList}`}>
        {recent.map((chat) => (
          <li key={chat.id}>
            <HostLink
              href={chatHref(chat.id)}
              className={styles.recentLink}
              aria-current={onChat && chat.id === activeChatId ? 'true' : undefined}
            >
              <span className={styles.recentTitle}>{chat.title || UNTITLED_CHAT}</span>
            </HostLink>
          </li>
        ))}
      </ul>
    </section>
  )
}
