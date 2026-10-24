import { HostLink, type RosterAgent } from '@automatos/theme-sdk'
import { useId, useState } from 'react'

import { detailsHref, filterAgents, statusCounts, STATUS_FILTERS, type StatusFilter } from './agents-summary'
import styles from './agents.module.css'

/**
 * The roster tab: the core page's search and status filter over the workspace's agents, then a card for each. A
 * card's Details opens the agent on the host's own page, which keeps the details, the configuration and the skills
 * (`?agent=`, keepCorePage), since the SDK's agents area reads the roster and its counts alone.
 */

export const SEARCH_LABEL = 'Search agents'
export const SEARCH_PLACEHOLDER = 'Search agents by name, type, or capabilities…'
export const STATUS_LABEL = 'Status'
export const ROSTER_LABEL = 'Agents'
export const LOADING = 'Loading the agents…'
export const NO_AGENTS = 'No agents yet.'
export const NO_MATCH = 'No agent matches.'
export const DETAILS = 'Details'

function AgentCard({ agent }: { readonly agent: RosterAgent }) {
  const role = agent.job_title ?? agent.agent_type
  return (
    <li className={styles.card}>
      <div className={styles.cardHead}>
        <h3 className={styles.cardName}>{agent.name}</h3>
        <span className={styles.status} data-status={agent.status === 'active' ? 'active' : 'idle'}>
          {agent.status}
        </span>
      </div>
      <p className={styles.role}>{agent.team ? `${role} · ${agent.team}` : role}</p>
      {agent.description && <p className={styles.description}>{agent.description}</p>}
      {(agent.tags ?? []).length > 0 && (
        <ul className={styles.tags} aria-label={`${agent.name}'s skills`}>
          {(agent.tags ?? []).map((tag) => (
            <li key={tag} className={styles.tag}>
              {tag}
            </li>
          ))}
        </ul>
      )}
      <HostLink href={detailsHref(agent)} className={styles.details} aria-label={`${DETAILS}: ${agent.name}`}>
        {DETAILS}
      </HostLink>
    </li>
  )
}

interface ToolbarProps {
  readonly agents: readonly RosterAgent[]
  readonly term: string
  readonly status: StatusFilter
  readonly onTerm: (term: string) => void
  readonly onStatus: (status: StatusFilter) => void
}

function Toolbar({ agents, term, status, onTerm, onStatus }: ToolbarProps) {
  const searchId = useId()
  const counts = statusCounts(agents)
  return (
    <div className={styles.toolbar}>
      <label htmlFor={searchId} className={styles.hidden}>
        {SEARCH_LABEL}
      </label>
      <input
        id={searchId}
        type="search"
        className={styles.search}
        value={term}
        placeholder={SEARCH_PLACEHOLDER}
        onChange={(event) => onTerm(event.target.value)}
      />
      <div className={styles.filters} role="group" aria-label={STATUS_LABEL}>
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.key}
            type="button"
            className={styles.filter}
            aria-pressed={status === filter.key}
            onClick={() => onStatus(filter.key)}
          >
            {filter.label} <span className={styles.count}>{counts[filter.key]}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function AgentRoster({ agents, loading }: { readonly agents: readonly RosterAgent[]; readonly loading: boolean }) {
  const [term, setTerm] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const shown = filterAgents(agents, term, status)
  const empty = agents.length === 0 ? NO_AGENTS : NO_MATCH
  return (
    <section className={styles.roster} aria-label={ROSTER_LABEL} aria-busy={loading ? true : undefined}>
      <Toolbar agents={agents} term={term} status={status} onTerm={setTerm} onStatus={setStatus} />
      {loading && <p className={styles.note}>{LOADING}</p>}
      {!loading && shown.length === 0 && <p className={styles.note}>{empty}</p>}
      {shown.length > 0 && (
        <ul className={styles.cards}>
          {shown.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </ul>
      )}
    </section>
  )
}
