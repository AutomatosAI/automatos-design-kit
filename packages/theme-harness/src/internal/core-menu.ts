/**
 * PRD-261 B-02b: the core nav the harness's useCoreNav and resolveActiveNavId read: core's Studio menu
 * (frontend/lib/studio-menu.ts:68-90 at 101a0bf33f64fb4f89af81b4293415be60b661ac) as data, without icons, and
 * the three filters core's internal/core-nav.ts:64 applies: the edition's routes (lib/auth-edition.ts
 * SAAS_ONLY_ROUTES, the ones the menu holds), the admin role gate and the plan-tier exposure (every gated item
 * shown, as a plan that offers them). The Docs link points at an example host: it is fake data.
 */
import type { CoreNav, CoreNavItem, HostEdition } from '@automatos/theme-sdk'

interface MenuEntry {
  readonly id: string
  readonly label: string
  readonly desc?: string
  readonly href: string
  readonly group?: string
  readonly external?: boolean
  readonly requiredRole?: 'admin'
}

const MENU_PRIMARY: readonly MenuEntry[] = Object.freeze([
  { id: 'chat', label: 'Chat', desc: 'Your AI workspace', href: '/chat', group: 'OPERATIONS' },
  { id: 'cmd', label: 'Command Centre', desc: 'Your AI workforce at a glance', href: '/command-center', group: 'OPERATIONS' },
  { id: 'assign', label: 'Assignments', desc: 'Plan, schedule & orchestrate', href: '/assignments', group: 'OPERATIONS' },
  { id: 'deliv', label: 'Deliverables', desc: 'Files, code & agent output', href: '/deliverables', group: 'OPERATIONS' },
  { id: 'agents', label: 'Agent Management', desc: 'Manage AI agents and skills', href: '/agents', group: 'WORKFORCE' },
  { id: 'tools', label: 'Tools & Integrations', desc: 'Development and utility tools', href: '/tools', group: 'WORKFORCE' },
  { id: 'kb', label: 'Knowledge Base', desc: 'Documents, databases & code', href: '/documents', group: 'WORKFORCE' },
  { id: 'market', label: 'Marketplace', desc: 'Discover agents, playbooks', href: '/marketplace', group: 'WORKFORCE' },
  { id: 'team', label: 'Team Management', desc: 'Manage workspace members', href: '/team', group: 'WORKSPACE' },
  { id: 'analytics', label: 'Analytics', desc: 'Performance, costs & insights', href: '/analytics', group: 'WORKSPACE' },
  { id: 'admin', label: 'Workspace Admin', desc: 'Manage all workspaces', href: '/admin/workspaces', group: 'WORKSPACE', requiredRole: 'admin' },
])

const MENU_FOOTER: readonly MenuEntry[] = Object.freeze([
  { id: 'docs', label: 'Docs', href: 'https://docs.example.com', external: true },
  { id: 'settings', label: 'Settings', desc: 'Profile, API keys, preferences', href: '/settings', requiredRole: 'admin' },
])

/** lib/auth-edition.ts:56: the hosted-edition routes the menu names, which the local edition leaves out. */
const SAAS_ONLY_ROUTES: readonly string[] = Object.freeze(['/admin/workspaces', '/team'])

/** studio-menu.ts:96-105: the paths that belong to an item other than the one their href names. */
const PATH_OWNERS: readonly (readonly [prefix: string, id: string])[] = Object.freeze([
  ['/chat', 'chat'],
  ['/missions/', 'assign'],
  ['/activity', 'cmd'],
  ['/marketplace', 'market'],
  ['/admin', 'admin'],
  ['/playbooks', 'assign'],
  ['/settings', 'settings'],
  ['/deliverables', 'deliv'],
])

const isUnder = (path: string, prefix: string): boolean => path === prefix || path.startsWith(`${prefix}/`)

function inEdition(item: MenuEntry, edition: HostEdition): boolean {
  return edition === 'saas' || !SAAS_ONLY_ROUTES.some((prefix) => isUnder(item.href, prefix))
}

function toCoreItem(item: MenuEntry): CoreNavItem {
  return Object.freeze({
    id: item.id,
    label: item.label,
    description: item.desc ?? null,
    href: item.href,
    group: item.group ?? null,
    external: item.external === true,
  })
}

/** core-nav.ts:64: the menu for this edition and role. */
export function buildCoreNav(edition: HostEdition, isAdmin: boolean): CoreNav {
  const allowed = (item: MenuEntry): boolean => inEdition(item, edition) && (!item.requiredRole || isAdmin)
  return Object.freeze({
    primary: Object.freeze(MENU_PRIMARY.filter(allowed).map(toCoreItem)),
    footer: Object.freeze(MENU_FOOTER.filter(allowed).map(toCoreItem)),
  })
}

/** studio-menu.ts:96: the menu item a path belongs to, or null. */
export function activeMenuId(pathname: string): string | null {
  const owner = PATH_OWNERS.find(([prefix]) => pathname.startsWith(prefix))
  if (owner) return owner[1]
  const item = MENU_PRIMARY.find((entry) => entry.href === pathname || pathname.startsWith(`${entry.href}/`))
  return item?.id ?? null
}
