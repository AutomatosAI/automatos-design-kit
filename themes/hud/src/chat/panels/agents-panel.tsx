import { HostLink, type RosterAgent, useAgents } from '@automatos/theme-sdk'

import { Panel } from '../../components/panel'
import { type AgentChoice, isPickable, isSessionAgent, sessionHref } from '../modes/agent-choice'
import { SESSION_TAG } from '../modes/agent-picker'
import { activeCount, agentDetail, agentRows, agentStatus } from './panel-rows'
import styles from './panels.module.css'

/**
 * AGENTS, the core screen's first panel (the design's left column): the workspace's agents from the SDK's roster
 * (useAgents), active ones first, each with its name, its status as a glyph and a word, and a detail line; the
 * header's value is how many are active. The design's progress bars are left out: the roster says no agent's
 * progress. HUD 1.4.0: on the core screen, a row of an agent that can run now acts (SDK 1.5.0): a press makes the
 * message box talk to that agent (the chat's chooseAgent; pressed while it does, aria-pressed), and the box takes the
 * focus; a session agent's row is a link to its session (`/chat?agent=<id>`), tagged SESSION. The other rows only say.
 */

export const AGENTS_TITLE = 'Agents'
/** How many agents the panel lists. */
export const AGENTS_SHOWN = 5
export const AGENTS_LOADING = 'Loading the agents…'
export const AGENTS_FAILED = "Couldn't load the agents."
export const NO_AGENTS = 'No agents yet.'

/** What makes a row act: the chat's choice, and what follows a choice (the box takes the focus). */
export interface AgentChooser {
  readonly choice: AgentChoice
  readonly onChosen: () => void
}

function RowBody({ agent }: { readonly agent: RosterAgent }) {
  const status = agentStatus(agent)
  return (
    <>
      <span className={styles.rowHead}>
        <span className={styles.name}>{agent.name}</span>
        <span className={styles.status} data-tone={status.tone}>
          <span aria-hidden="true">{status.glyph}</span> {status.word}
        </span>
      </span>
      <span className={styles.detail}>{agentDetail(agent)}</span>
    </>
  )
}

function RowAction({ agent, chooser }: { readonly agent: RosterAgent; readonly chooser: AgentChooser }) {
  if (isSessionAgent(agent)) {
    return (
      <HostLink href={sessionHref(agent)} className={styles.rowAction}>
        <RowBody agent={agent} />
        <span className={styles.rowTag}>{SESSION_TAG}</span>
      </HostLink>
    )
  }
  const { choice, onChosen } = chooser
  const choose = (): void => {
    if (choice.chooseAgent(agent.id)) onChosen()
  }
  return (
    <button type="button" className={styles.rowAction} aria-pressed={choice.agentId === agent.id} onClick={choose}>
      <RowBody agent={agent} />
    </button>
  )
}

function AgentRow({ agent, chooser }: { readonly agent: RosterAgent; readonly chooser: AgentChooser | null }) {
  const acts = chooser !== null && isPickable(agent)
  return <li className={styles.row}>{acts ? <RowAction agent={agent} chooser={chooser} /> : <RowBody agent={agent} />}</li>
}

interface AgentsBodyProps {
  readonly agents: readonly RosterAgent[] | null
  readonly error: string | null
  readonly chooser: AgentChooser | null
}

function AgentsBody({ agents, error, chooser }: AgentsBodyProps) {
  if (agents === null) return <p className={styles.note}>{error === null ? AGENTS_LOADING : AGENTS_FAILED}</p>
  if (agents.length === 0) return <p className={styles.note}>{NO_AGENTS}</p>
  return (
    <ul className={styles.rows}>
      {agentRows(agents).slice(0, AGENTS_SHOWN).map((agent) => (
        <AgentRow key={agent.id} agent={agent} chooser={chooser} />
      ))}
    </ul>
  )
}

/** AGENTS; `chooser` (the core screen's chat) makes the rows of agents that can run act. */
export function AgentsPanel({ chooser = null }: { readonly chooser?: AgentChooser | null }) {
  const { data, error } = useAgents()
  return (
    <Panel title={AGENTS_TITLE} value={data === null ? undefined : activeCount(data)}>
      <AgentsBody agents={data} error={error} chooser={chooser} />
    </Panel>
  )
}
