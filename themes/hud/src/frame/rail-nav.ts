import { resolveActiveNavId, type CoreNav, type CoreNavItem } from '@automatos/theme-sdk'

import { CONVERSATIONS_HREF } from '../conversations/route'

/**
 * The side rail's nav, from the core nav (the SDK's useCoreNav: the Studio menu after its edition, role and
 * plan filters): its groups in the menu's own order, each with its items, and the footer (Docs, Settings), with
 * HUD's own page, Conversations, right after Chat (after Play's, themes/play/src/components/play/shell/play-nav.ts,
 * Play 1.1.1). Pure data, no React; the routes stay the host's, never a second list here.
 */

export interface RailItem {
  readonly id: string
  readonly label: string
  readonly href: string
  /** Opens in a new tab (Docs). */
  readonly external: boolean
}

export interface RailGroup {
  readonly id: string
  /** The group's label, as the menu writes it ('OPERATIONS'). */
  readonly label: string
  readonly items: readonly RailItem[]
}

export interface RailNav {
  readonly groups: readonly RailGroup[]
  readonly footer: readonly RailItem[]
}

/** HUD's Conversations page, at its theme route: right after Chat. */
export const CONVERSATIONS_ITEM: RailItem = {
  id: 'conversations',
  label: 'Conversations',
  href: CONVERSATIONS_HREF,
  external: false,
}
const CONVERSATIONS_FOLLOW = 'chat'

function toRailItem({ id, label, href, external }: CoreNavItem): RailItem {
  return { id, label, href, external }
}

function withConversations(items: readonly RailItem[]): RailItem[] {
  return items.flatMap((item) => (item.id === CONVERSATIONS_FOLLOW ? [item, CONVERSATIONS_ITEM] : [item]))
}

function isUnder(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** The rail item a path belongs to: HUD's Conversations page, else the core nav's resolver. */
export function resolveRailActiveId(pathname: string): string | null {
  return isUnder(pathname, CONVERSATIONS_ITEM.href) ? CONVERSATIONS_ITEM.id : resolveActiveNavId(pathname)
}

/** The menu's groups in the menu's own order (OPERATIONS, WORKFORCE, WORKSPACE). */
function groupsInOrder(items: readonly CoreNavItem[]): string[] {
  return Array.from(new Set(items.flatMap((item) => (item.group === null ? [] : [item.group]))))
}

/** The rail's nav for this edition, role and plan. An item outside every group goes in the footer's list. */
export function buildRailNav({ primary, footer }: CoreNav): RailNav {
  const groups = groupsInOrder(primary).map((group) => ({
    id: group.toLowerCase(),
    label: group,
    items: withConversations(primary.filter((item) => item.group === group).map(toRailItem)),
  }))
  const loose = primary.filter((item) => item.group === null).map(toRailItem)
  return { groups, footer: [...loose, ...footer.map(toRailItem)] }
}
