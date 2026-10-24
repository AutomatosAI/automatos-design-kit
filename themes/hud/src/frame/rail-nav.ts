import type { CoreNav, CoreNavItem } from '@automatos/theme-sdk'

/**
 * The side rail's nav, from the core nav (the SDK's useCoreNav: the Studio menu after its edition, role and
 * plan filters): its groups in the menu's own order, each with its items, and the footer (Docs, Settings).
 * Pure data, no React; the routes stay the host's, never a second list here.
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

function toRailItem({ id, label, href, external }: CoreNavItem): RailItem {
  return { id, label, href, external }
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
    items: primary.filter((item) => item.group === group).map(toRailItem),
  }))
  const loose = primary.filter((item) => item.group === null).map(toRailItem)
  return { groups, footer: [...loose, ...footer.map(toRailItem)] }
}
