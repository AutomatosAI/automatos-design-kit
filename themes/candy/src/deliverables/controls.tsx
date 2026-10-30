import { HostLink } from '@automatos/theme-sdk'

import { sectionLinks } from './links'
import type { Pill } from './shelf'
import styles from './deliverables.module.css'
import ui from '../ui/ui.module.css'

/**
 * The shelf's controls: the search pill in the header (a real search box, its words asked of the host's list), the
 * kind pills under it ("All 8", "Reports 1", …; the pressed one in the accent), and, under the grid, the links to the
 * host's other sections of Deliverables, so none is out of reach under Candy.
 */

export const SEARCH_LABEL = 'Search Deliverables'
export const FILTERS_LABEL = 'Kinds of Deliverable'
export const SECTIONS_LABEL = 'More in Deliverables'

export function SearchField({ value, onChange }: { readonly value: string; readonly onChange: (value: string) => void }) {
  return (
    <label className={styles.search}>
      <span className={styles.searchRing} aria-hidden="true" />
      <span className={ui.srOnly}>{SEARCH_LABEL}</span>
      <input
        type="search"
        className={styles.searchInput}
        value={value}
        placeholder={SEARCH_LABEL}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

interface PillsProps {
  readonly pills: readonly Pill[]
  readonly selected: string | null
  readonly onSelect: (kind: string | null) => void
}

export function KindPills({ pills, selected, onSelect }: PillsProps) {
  return (
    <div className={styles.pills} role="group" aria-label={FILTERS_LABEL}>
      {pills.map((pill) => (
        <button key={pill.kind ?? ''} type="button" className={`${ui.pill} ${styles.pill}`} aria-pressed={pill.kind === selected} onClick={() => onSelect(pill.kind)}>
          {pill.label}
          {pill.count && (
            <>
              {' '}
              <span className={ui.count}>{pill.count}</span>
            </>
          )}
        </button>
      ))}
    </div>
  )
}

export function Sections({ socials }: { readonly socials: boolean }) {
  return (
    <nav className={styles.sections} aria-label={SECTIONS_LABEL}>
      <span className={ui.meta}>{SECTIONS_LABEL}</span>
      {sectionLinks(socials).map((link) => (
        <HostLink key={link.href} href={link.href} className={ui.link}>
          {link.label}
        </HostLink>
      ))}
    </nav>
  )
}
