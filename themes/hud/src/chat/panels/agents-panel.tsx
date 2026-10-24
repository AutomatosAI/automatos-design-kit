import { type RosterAgent, useAgents } from '@automatos/theme-sdk'

import { Panel } from '../../components/panel'
import { activeCount, agentDetail, agentRows, agentStatus } from './panel-rows'
import styles from './panels.module.css'

/**
 * AGENTS, the core screen's first panel (the design's left column): the workspace's agents from the SDK's roster
 * (useAgents), active ones first, each with its name, its status as a glyph and a word, and a detail line; the
 * header's value is how many are active. The design's progress bars are left out: the roster says no agent's
 * progress.
 */

export const AGENTS_TITLE = 'Agents'
/** How many agents the panel lists. */
export const AGENTS_SHOWN = 5
export const AGENTS_LOADING = 'Loading the agents…'
export const AGENTS_FAILED = "Couldn't load the agents."
export const NO_AGENTS = 'No agents yet.'

function AgentRow({ agent }: { readonly agent: RosterAgent }) {
  const status = agentStatus(agent)
  return (
    <li className={styles.row}>
      <span className={styles.rowHead}>
        <span className={styles.name}>{agent.name}</span>
        <span className={styles.status} data-tone={status.tone}>
          <span aria-hidden="true">{status.glyph}</span> {status.word}
        </span>
      </span>
      <span className={styles.detail}>{agentDetail(agent)}</span>
    </li>
  )
}

function AgentsBody({ agents, error }: { readonly agents: readonly RosterAgent[] | null; readonly error: string | null }) {
  if (agents === null) return <p className={styles.note}>{error === null ? AGENTS_LOADING : AGENTS_FAILED}</p>
  if (agents.length === 0) return <p className={styles.note}>{NO_AGENTS}</p>
  return (
    <ul className={styles.rows}>
      {agentRows(agents).slice(0, AGENTS_SHOWN).map((agent) => (
        <AgentRow key={agent.id} agent={agent} />
      ))}
    </ul>
  )
}

export function AgentsPanel() {
  const { data, error } = useAgents()
  return (
    <Panel title={AGENTS_TITLE} value={data === null ? undefined : activeCount(data)}>
      <AgentsBody agents={data} error={error} />
    </Panel>
  )
}
