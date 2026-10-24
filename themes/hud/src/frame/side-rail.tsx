import { useId, useMemo } from 'react'

import { HostLink, resolveActiveNavId, useCoreNav, useHostPathname } from '@automatos/theme-sdk'

import { AutoDock } from './auto-dock'
import { buildRailNav, type RailGroup, type RailItem } from './rail-nav'
import styles from './side-rail.module.css'

/**
 * The side rail: every core page, grouped as the Studio menu groups them (rail-nav.ts), in Geist Mono
 * capitals; the current one in the accent with a 2 px bar on its edge, and aria-current, so the state is never
 * the colour alone. Docs and Settings sit at its foot, above Auto's dock. Every link is the SDK's HostLink:
 * a path inside the app moves the host's router, Docs opens in a new tab.
 */

export const RAIL_LABEL = 'Sidebar'
export const NAV_LABEL = 'Main'
export const MORE_LABEL = 'More'

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

export function SideRail() {
  const coreNav = useCoreNav()
  const nav = useMemo(() => buildRailNav(coreNav), [coreNav])
  const activeId = resolveActiveNavId(useHostPathname())
  return (
    <aside className={styles.rail} aria-label={RAIL_LABEL}>
      <nav aria-label={NAV_LABEL} className={styles.nav}>
        {nav.groups.map((group) => (
          <RailGroupList key={group.id} group={group} activeId={activeId} />
        ))}
      </nav>
      <div className={styles.foot}>
        {nav.footer.length > 0 && <RailList items={nav.footer} activeId={activeId} label={MORE_LABEL} />}
        <AutoDock />
      </div>
    </aside>
  )
}
