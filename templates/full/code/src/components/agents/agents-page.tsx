'use client'

import { HostLink, useAgents, useAgentStats, type RosterAgent } from '@automatos/theme-sdk'

import { AgentRoster } from './agents-roster'
import { AgentStats } from './agents-stats'
import { AGENT_TABS, plural, summariseAgents, tabHref } from './agents-summary'
import styles from './agents.module.css'

/**
 * The /agents page, cloned from core's components/agents/studio/agent-management-studio.tsx (theme.json's
 * `clonedFrom` names the file and its sha256 when it was copied) and rewritten on the SDK's `pages/agents` area: the
 * head and its Refresh, the tabs, the honest stats strip, and the roster with its search and status filter. Its data
 * is the host's own (useAgents, useAgentStats, the core page's cache), and it imports nothing of core.
 *
 * The core page's other tabs, an agent's details and creating an agent have no SDK area yet, so they stay the host's:
 * their links carry the parameters theme.json's `keepCorePage` names (`tab`, `agent`, `panel`), for which the host
 * draws its own page in place of this one. When a later host changes the core file, `automatos-theme check` says the
 * clone may miss what the core page has now (`clonedFrom`): read the file again and bring this page up to it.
 */

export const AGENTS_EYEBROW = 'Workforce · Roster'
export const AGENTS_HEADING = 'Agent Management'
export const AGENTS_LEAD = "Your agents, what they're good at, and what they're doing."
export const REFRESH = 'Refresh'
export const TABS_LABEL = 'Agent Management sections'
export const LOAD_FAILED = "The agents didn't load."
export const RETRY = 'Retry'

const NO_ROSTER: readonly RosterAgent[] = Object.freeze([])

function AgentTabs({ total }: { readonly total: number }) {
  return (
    <nav className={styles.tabs} aria-label={TABS_LABEL}>
      {AGENT_TABS.map((tab) => (
        <HostLink
          key={tab.key}
          href={tabHref(tab.key)}
          className={styles.tab}
          aria-current={tab.key === 'roster' ? 'page' : undefined}
        >
          {tab.label}
          {tab.key === 'roster' && total > 0 && <span className={styles.count}>{total}</span>}
        </HostLink>
      ))}
    </nav>
  )
}

function LoadFailed({ error, onRetry }: { readonly error: string; readonly onRetry: () => void }) {
  return (
    <div className={styles.failed} role="alert">
      <p className={styles.failedText}>
        {LOAD_FAILED} {error}
      </p>
      <button type="button" className={styles.button} onClick={onRetry}>
        {RETRY}
      </button>
    </div>
  )
}

export function AgentsPage() {
  const roster = useAgents()
  const stats = useAgentStats()
  const agents = roster.data ?? NO_ROSTER
  const summary = summariseAgents(agents, stats.data)
  const refresh = () => {
    roster.refetch()
    stats.refetch()
  }
  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.headText}>
          <p className={styles.eyebrow}>
            {AGENTS_EYEBROW} · {plural(summary.total, 'agent')}
          </p>
          <h1 className={styles.heading}>{AGENTS_HEADING}</h1>
          <p className={styles.lead}>{AGENTS_LEAD}</p>
        </div>
        <button type="button" className={styles.button} onClick={refresh} disabled={roster.isFetching}>
          {REFRESH}
        </button>
      </header>
      {roster.error !== null && <LoadFailed error={roster.error} onRetry={refresh} />}
      <AgentTabs total={summary.total} />
      <AgentStats summary={summary} />
      <AgentRoster agents={agents} loading={roster.isLoading} />
    </div>
  )
}
