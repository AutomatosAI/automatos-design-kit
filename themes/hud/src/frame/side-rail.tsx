import { useId, useMemo } from 'react'

import { CHAT_HREF, chatHref, HostLink, useCoreNav, useHostPathname, useRecentChats } from '@automatos/theme-sdk'

import { conversationTitle } from '../conversations/conversations'
import { AutoDock } from './auto-dock'
import { buildRailNav, resolveRailActiveId, type RailGroup, type RailItem } from './rail-nav'
import styles from './side-rail.module.css'

/**
 * The side rail: every core page, grouped as the Studio menu groups them, and HUD's Conversations after Chat
 * (rail-nav.ts), in Geist Mono capitals; the current one in the accent with a 2 px bar on its edge, and
 * aria-current, so the state is never the colour alone. Under the nav, RECENT lists the latest conversations (the
 * SDK's useRecentChats), each opening in the chat, the one on screen marked; nothing until there is one. Docs and
 * Settings sit at its foot, above Auto's dock (none while the host draws its own floating Auto). Every link is the
 * SDK's HostLink: a path inside the app moves the host's router, Docs opens in a new tab.
 */

export const RAIL_LABEL = 'Sidebar'
export const NAV_LABEL = 'Main'
export const MORE_LABEL = 'More'
export const RECENT_LABEL = 'Recent'
/** How many conversations RECENT lists. */
export const RECENT_SHOWN = 5

function RailLink({ item, active }: { readonly item: RailItem; readonly active: boolean }) {
  return (
    <HostLink href={item.href} className={styles.link} aria-current={active ? 'page' : undefined}>
      <span>{item.label}</span>
      {item.external && (
        <span className={styles.external} aria-hidden="true">
          ↗
        </span>
      )}
    </HostLink>
  )
}

function RailList({ items, activeId, label }: { readonly items: readonly RailItem[]; readonly activeId: string | null; readonly label?: string }) {
  return (
    <ul className={styles.list} aria-label={label}>
      {items.map((item) => (
        <li key={item.id}>
          <RailLink item={item} active={item.id === activeId} />
        </li>
      ))}
    </ul>
  )
}

function RailGroupList({ group, activeId }: { readonly group: RailGroup; readonly activeId: string | null }) {
  const labelId = useId()
  return (
    <div role="group" aria-labelledby={labelId} className={styles.group}>
      <span id={labelId} className={styles.groupLabel}>
        {group.label}
      </span>
      <RailList items={group.items} activeId={activeId} />
    </div>
  )
}

/** RECENT: the latest conversations, each opening in the chat, the one the chat shows marked. */
function RecentList() {
  const labelId = useId()
  const { chats, activeChatId } = useRecentChats(RECENT_SHOWN)
  const onChat = useHostPathname() === CHAT_HREF
  if (chats.length === 0) return null
  return (
    <div role="group" aria-labelledby={labelId} className={styles.group}>
      <span id={labelId} className={styles.groupLabel}>
        {RECENT_LABEL}
      </span>
      <ul className={styles.list}>
        {chats.map((chat) => (
          <li key={chat.id}>
            <HostLink
              href={chatHref(chat.id)}
              className={styles.recent}
              aria-current={onChat && chat.id === activeChatId ? 'page' : undefined}
            >
              <span className={styles.recentTitle}>{conversationTitle(chat)}</span>
            </HostLink>
          </li>
        ))}
      </ul>
    </div>
  )
}

export interface SideRailProps {
  /** False while the host draws its floating Auto widget: the dock steps aside, so Auto shows once. */
  readonly dock?: boolean
}

export function SideRail({ dock = true }: SideRailProps) {
  const coreNav = useCoreNav()
  const nav = useMemo(() => buildRailNav(coreNav), [coreNav])
  const activeId = resolveRailActiveId(useHostPathname())
  return (
    <aside className={styles.rail} aria-label={RAIL_LABEL}>
      <nav aria-label={NAV_LABEL} className={styles.nav}>
        {nav.groups.map((group) => (
          <RailGroupList key={group.id} group={group} activeId={activeId} />
        ))}
      </nav>
      <RecentList />
      <div className={styles.foot}>
        {nav.footer.length > 0 && <RailList items={nav.footer} activeId={activeId} label={MORE_LABEL} />}
        {dock && <AutoDock />}
      </div>
    </aside>
  )
}
