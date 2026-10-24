import { LOOKS_HREF, LOOK_STYLE_HREF, type CoreNavItem } from '@automatos/theme-sdk'

/**
 * The sidebar's menu as data: the host's own menu (the SDK's useCoreNav, already filtered for this edition, role
 * and plan) in its groups and order, then the theme's two screens. No React here, so it reads at a glance.
 */

export interface NavItem {
  readonly id: string
  readonly label: string
  readonly href: string
}

export interface NavGroup {
  readonly id: string
  readonly label: string
  readonly items: readonly NavItem[]
}

/** The theme's own screens, in the host's /looks pages: the look editor and the style sheet. */
export const THEME_GROUP: NavGroup = {
  id: 'theme',
  label: 'Look',
  items: [
    { id: 'theme-looks', label: 'Make it yours', href: LOOKS_HREF },
    { id: 'theme-style-sheet', label: 'Style sheet', href: LOOK_STYLE_HREF },
  ],
}

/** 'OPERATIONS' as 'Operations': the menu names its groups in capitals, the sidebar in words. */
function groupLabel(group: string): string {
  return group.charAt(0) + group.slice(1).toLowerCase()
}

/** The host's primary menu in its own groups, in the order it first names each one. */
export function coreGroups(primary: readonly CoreNavItem[]): NavGroup[] {
  const names = Array.from(new Set(primary.flatMap((item) => (item.group === null ? [] : [item.group]))))
  return names.map((group) => ({
    id: group.toLowerCase(),
    label: groupLabel(group),
    items: primary.filter((item) => item.group === group).map(({ id, label, href }) => ({ id, label, href })),
  }))
}

/** The theme screen a path is, or null: /looks/style is the style sheet, anything else under /looks the editor. */
export function themeScreenId(pathname: string): string | null {
  if (pathname === LOOK_STYLE_HREF || pathname.startsWith(`${LOOK_STYLE_HREF}/`)) return 'theme-style-sheet'
  if (pathname === LOOKS_HREF || pathname.startsWith(`${LOOKS_HREF}/`)) return 'theme-looks'
  return null
}
