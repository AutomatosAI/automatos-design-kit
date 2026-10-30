import {
  CHAT_HREF,
  DELIVERABLES_HREF,
  LOOK_STYLE_HREF,
  LOOKS_HREF,
  resolveActiveNavId,
  type CoreNav,
  type CoreNavItem,
} from '@automatos/theme-sdk'

import { AGENTS_HREF, TODAY_HREF } from '../routes'
import { cardSetOf, type CardSet } from '../ui/sets'

/**
 * The sidebar's menu as data (the design's Candy Sidebar): Candy's own pages (Today, Chat, Deliverables, Agents),
 * then the two host pages the design keeps in view (the Missions and Playbooks page and the Knowledge Base), then
 * Look. Every other page of the host's menu for this caller (the SDK's useCoreNav, after its edition, role and plan
 * filters, with Docs and Settings from its foot) sits under More, so nothing the host offers is out of reach. The
 * host's own Chat and Deliverables items are Candy's. Each item's dot cycles the three card gradients. Pure.
 */

export interface MenuItem {
  readonly id: string
  readonly label: string
  readonly href: string
  /** Opens in a new tab (Docs). */
  readonly external: boolean
  readonly set: CardSet
}

export interface Menu {
  readonly main: readonly MenuItem[]
  readonly more: readonly MenuItem[]
  readonly look: MenuItem
}

const item = (id: string, label: string, href: string): Omit<MenuItem, 'set'> => ({ id, label, href, external: false })

export const TODAY_ITEM = item('candy-today', 'Today', TODAY_HREF)
export const CHAT_ITEM = item('candy-chat', 'Chat', CHAT_HREF)
export const DELIVERABLES_ITEM = item('candy-deliverables', 'Deliverables', DELIVERABLES_HREF)
export const AGENTS_ITEM = item('candy-agents', 'Agents', AGENTS_HREF)
export const LOOK_ITEM = item('candy-look', 'Look', LOOKS_HREF)

/** The host pages the design shows beside Candy's own, by their path. */
const FEATURED_HOST_HREFS: readonly string[] = ['/assignments', '/documents']
/** The host's items Candy's own pages stand for. */
const REPLACED_HREFS: ReadonlySet<string> = new Set([CHAT_HREF, DELIVERABLES_HREF])

function hostItem({ id, label, href, external }: CoreNavItem): Omit<MenuItem, 'set'> {
  return { id, label, href, external }
}

function withSets(items: readonly Omit<MenuItem, 'set'>[], from = 0): MenuItem[] {
  return items.map((entry, index) => ({ ...entry, set: cardSetOf(from + index) }))
}

export function buildMenu({ primary, footer }: CoreNav): Menu {
  const host = [...primary, ...footer].filter((entry) => !REPLACED_HREFS.has(entry.href))
  const featured = FEATURED_HOST_HREFS.flatMap((href) => host.filter((entry) => entry.href === href)).map(hostItem)
  const rest = host.filter((entry) => !FEATURED_HOST_HREFS.includes(entry.href)).map(hostItem)
  const main = withSets([TODAY_ITEM, CHAT_ITEM, DELIVERABLES_ITEM, AGENTS_ITEM, ...featured])
  return { main, more: withSets(rest, main.length), look: { ...LOOK_ITEM, set: cardSetOf(main.length) } }
}

function isUnder(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** The menu item a path belongs to: one of Candy's own, else the host's resolver. */
export function activeMenuId(pathname: string): string | null {
  const own: readonly (readonly [string, string])[] = [
    [TODAY_HREF, TODAY_ITEM.id],
    [AGENTS_HREF, AGENTS_ITEM.id],
    [CHAT_HREF, CHAT_ITEM.id],
    [DELIVERABLES_HREF, DELIVERABLES_ITEM.id],
    [LOOK_STYLE_HREF, LOOK_ITEM.id],
    [LOOKS_HREF, LOOK_ITEM.id],
  ]
  return own.find(([href]) => isUnder(pathname, href))?.[1] ?? resolveActiveNavId(pathname)
}

/** Which band a page wears behind its top (the design's heights): Today's tall one, the chat's short one, the rest. */
export type BandSize = 'today' | 'chat' | 'page'

export function bandOf(pathname: string): BandSize {
  if (isUnder(pathname, TODAY_HREF)) return 'today'
  if (isUnder(pathname, CHAT_HREF)) return 'chat'
  return 'page'
}

/** Candy's own screens draw their own header row beside the host's utilities; the host's pages start under them. */
export function ownsHeader(pathname: string): boolean {
  return [TODAY_HREF, AGENTS_HREF, CHAT_HREF, DELIVERABLES_HREF, LOOKS_HREF].some((href) => isUnder(pathname, href))
}
