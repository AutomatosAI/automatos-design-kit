import {
  CHAT_HREF,
  DELIVERABLES_HREF,
  LOOK_STYLE_HREF,
  LOOKS_HREF,
  resolveActiveNavId,
  type CoreNav,
  type CoreNavItem,
} from '@automatos/theme-sdk'

import { QUESTS_HREF } from '../routes'

/**
 * The pause menu as data (the design's MENU): THEME (Chat, Quests, Inventory: Arcade's own pages), HOST PAGES (the
 * host's menu for this caller, from the SDK's useCoreNav, after its edition, role and plan filters, with Docs and
 * Settings from its foot), and SYSTEM (Options and the Sprite gallery, the host's /looks pages Arcade draws).
 * The host's own Chat and Deliverables items are the THEME group's Chat and Inventory. Pure.
 */

export interface MenuItem {
  readonly id: string
  readonly label: string
  readonly href: string
  /** Opens in a new tab (Docs). */
  readonly external: boolean
}

export interface MenuGroup {
  readonly id: string
  readonly label: string
  readonly items: readonly MenuItem[]
}

export const CHAT_ITEM: MenuItem = { id: 'arcade-chat', label: 'Chat', href: CHAT_HREF, external: false }
export const QUESTS_ITEM: MenuItem = { id: 'arcade-quests', label: 'Quests', href: QUESTS_HREF, external: false }
export const INVENTORY_ITEM: MenuItem = { id: 'arcade-inventory', label: 'Inventory', href: DELIVERABLES_HREF, external: false }
export const OPTIONS_ITEM: MenuItem = { id: 'arcade-options', label: 'Options', href: LOOKS_HREF, external: false }
export const SPRITES_ITEM: MenuItem = { id: 'arcade-sprites', label: 'Sprite gallery', href: LOOK_STYLE_HREF, external: false }

const THEME_HREFS: ReadonlySet<string> = new Set([CHAT_HREF, DELIVERABLES_HREF])

function toItem({ id, label, href, external }: CoreNavItem): MenuItem {
  return { id, label, href, external }
}

export function buildMenu({ primary, footer }: CoreNav): readonly MenuGroup[] {
  const host = [...primary, ...footer].filter((item) => !THEME_HREFS.has(item.href)).map(toItem)
  return [
    { id: 'theme', label: 'Theme', items: [CHAT_ITEM, QUESTS_ITEM, INVENTORY_ITEM] },
    { id: 'host', label: 'Host pages', items: host },
    { id: 'system', label: 'System', items: [OPTIONS_ITEM, SPRITES_ITEM] },
  ]
}

function isUnder(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** The menu item a path belongs to: one of Arcade's own, else the host's resolver. */
export function activeMenuId(pathname: string): string | null {
  if (isUnder(pathname, CHAT_HREF)) return CHAT_ITEM.id
  if (isUnder(pathname, QUESTS_HREF)) return QUESTS_ITEM.id
  if (isUnder(pathname, DELIVERABLES_HREF)) return INVENTORY_ITEM.id
  if (isUnder(pathname, LOOK_STYLE_HREF)) return SPRITES_ITEM.id
  if (isUnder(pathname, LOOKS_HREF)) return OPTIONS_ITEM.id
  return resolveActiveNavId(pathname)
}
