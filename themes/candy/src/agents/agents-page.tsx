import { useMemo, useState } from 'react'
import { HostLink, useAgents } from '@automatos/theme-sdk'

import { THEME_HEADING } from '../theme'
import { AgentCard } from './agent-card'
import { MANAGE_AGENTS_HREF, rosterCounts, visibleAgents, type RosterCounts, type StatusFilter } from './roster'
import styles from './agents.module.css'
import ui from '../ui/ui.module.css'

/**
 * Candy's own route /x/agents (theme.json "routes"), from the SDK's pages/agents area: Your team. A search that
 * narrows the cards by name, job or team as you type, the All, Active and Inactive filters with their counts, a link
 * to the host's own agents page (where agents are made and changed), and a card for each agent. Until the roster
 * answers the grid is busy and empty (no made-up cards); a roster with no agents says so in words.
 */

export const TEAM_TITLE = 'Your team'
export const SEARCH_AGENTS = 'Search agents'
export const FILTERS_LABEL = 'Show agents'
export const GRID_LABEL = 'Agents'
export const MANAGE_AGENTS = 'Manage agents'
export const LOADING_TEAM = 'Loading your team…'
export const TEAM_FAILED = "Couldn't load your team."
export const NO_AGENTS = 'No agents yet.'
export const RETRY = 'Try again'

interface FilterPill {
  readonly filter: StatusFilter
  readonly glyph: string | null
  readonly word: string
}

const PILLS: readonly FilterPill[] = [
  { filter: 'all', glyph: null, word: 'All' },
  { filter: 'active', glyph: '●', word: 'Active' },
  { filter: 'inactive', glyph: '○', word: 'Inactive' },
]

/** What an empty grid says once the roster has agents: none match the search, or none in this filter. */
export function nothingShown(filter: StatusFilter, query: string): string {
  if (query.trim() !== '') return `No agents match “${query.trim()}”.`
  if (filter === 'active') return 'No active agents.'
  if (filter === 'inactive') return 'No inactive agents.'
  return NO_AGENTS
}

function Filters({ counts, filter, onPick }: { readonly counts: RosterCounts | null; readonly filter: StatusFilter; readonly onPick: (next: StatusFilter) => void }) {
  return (
    <div role="group" aria-label={FILTERS_LABEL} className={styles.pills}>
      {PILLS.map((pill) => (
        <button key={pill.filter} type="button" className={ui.pill} aria-pressed={filter === pill.filter} onClick={() => onPick(pill.filter)}>
          {pill.glyph !== null && <span aria-hidden="true">{pill.glyph}</span>}
          {counts === null ? pill.word : `${pill.word} ${counts[pill.filter]}`}
        </button>
      ))}
    </div>
  )
}

function SearchField({ query, onChange }: { readonly query: string; readonly onChange: (next: string) => void }) {
  return (
    <label className={styles.searchField}>
      <span className={styles.searchRing} aria-hidden="true" />
      <span className={ui.srOnly}>{SEARCH_AGENTS}</span>
      <input type="search" className={styles.searchInput} placeholder={SEARCH_AGENTS} value={query} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

export function AgentsPage() {
  const { data, error, refetch } = useAgents()
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [query, setQuery] = useState('')
  const counts = useMemo(() => (data === null ? null : rosterCounts(data)), [data])
  const shown = useMemo(() => (data === null ? [] : visibleAgents(data, filter, query)), [data, filter, query])
  return (
    <div className={styles.page}>
      <div className={`${ui.pageHead} ${styles.head}`}>
        <h1 className={ui.pageTitle} tabIndex={-1} {...THEME_HEADING}>
          {TEAM_TITLE}
        </h1>
        <SearchField query={query} onChange={setQuery} />
      </div>
      <div className={styles.filterRow}>
        <Filters counts={counts} filter={filter} onPick={setFilter} />
        <HostLink href={MANAGE_AGENTS_HREF} className={`${ui.link} ${styles.manage}`}>
          {MANAGE_AGENTS}
        </HostLink>
      </div>
      <section aria-label={GRID_LABEL} aria-busy={data === null && error === null ? true : undefined}>
        {data === null && error === null && <p className={ui.note}>{LOADING_TEAM}</p>}
        {data === null && error !== null && (
          <div className={styles.failed}>
            <p className={ui.note}>{TEAM_FAILED}</p>
            <button type="button" className={`${ui.quiet} ${ui.small}`} onClick={refetch}>
              {RETRY}
            </button>
          </div>
        )}
        {data !== null && <p className={ui.srOnly} aria-live="polite">{`${shown.length} of ${data.length} agents shown`}</p>}
        {data !== null && shown.length === 0 && <p className={ui.note}>{data.length === 0 ? NO_AGENTS : nothingShown(filter, query)}</p>}
        {shown.length > 0 && (
          <ul className={styles.grid}>
            {shown.map((entry) => (
              <AgentCard key={entry.agent.id} entry={entry} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
