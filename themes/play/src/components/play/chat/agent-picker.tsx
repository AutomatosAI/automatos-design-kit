'use client'

import { type KeyboardEvent, type ReactNode, useId, useRef, useState } from 'react'
import { HostLink, type RosterAgent, useAgents } from '@automatos/theme-sdk'

import {
  type AgentChoice, AUTO_NAME, chosenName, isSessionAgent, messagePlaceholder, pickableAgents, sessionHref,
} from './agent-choice'
import styles from './composer.module.css'

/**
 * Play 1.5.0, after themes/hud/src/chat/modes/agent-picker.tsx (HUD 1.4.0): who the message box talks to (agent-choice.ts,
 * SDK 1.5.0's chat controller). useAgentSeat hands the composer its seat: its placeholder ("Message Auto", or "Message
 * <the agent>") and the picker for the row under the box. The picker is a pill naming the agent, a disclosure
 * (aria-expanded) over the list it opens: Auto, then each active agent that can run now (the SDK's useAgents). An agent
 * is chosen with the controller's chooseAgent, and the box takes the focus; one the host refuses leaves the list open
 * as it was. A session agent is a link, never a choice: it opens the agent's session (`/chat?agent=<id>`). Esc shuts
 * the list and gives the pill the focus.
 */

/** Said before the pill's name to a screen reader: "Talking to Auto". */
export const TALKING_TO = 'Talking to'
export const AGENTS_LIST_LABEL = 'Talk to'
/** The tag on a session agent's link. */
export const SESSION_TAG = 'Session'

/** What the composer takes from the choice: its placeholder, and the picker for the row under it. */
export interface ComposerSeat {
  readonly placeholder: string
  readonly picker: ReactNode
}

/** The composer's seat for the chat's choice; `onChosen` runs once an agent is chosen (the box takes the focus). */
export function useAgentSeat(choice: AgentChoice, onChosen: () => void): ComposerSeat {
  const { data } = useAgents()
  const name = chosenName(data ?? [], choice.agentId)
  const picker = <AgentPicker choice={choice} agents={pickableAgents(data)} current={name} onChosen={onChosen} />
  return { placeholder: messagePlaceholder(name), picker }
}

interface AgentPickerProps {
  readonly choice: AgentChoice
  /** The agents to list after Auto (agent-choice.ts pickableAgents). */
  readonly agents: readonly RosterAgent[]
  /** The name of the agent the box talks to now. */
  readonly current: string
  readonly onChosen: () => void
}

function AgentPicker({ choice, agents, current, onChosen }: AgentPickerProps) {
  const [open, setOpen] = useState(false)
  const listId = useId()
  const chipRef = useRef<HTMLButtonElement>(null)
  const choose = (id: number | null): void => {
    if (!choice.chooseAgent(id)) return
    setOpen(false)
    onChosen()
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Escape' || !open) return
    event.preventDefault()
    setOpen(false)
    chipRef.current?.focus()
  }
  return (
    <div className={styles.agent} onKeyDown={onKeyDown}>
      <button
        ref={chipRef}
        type="button"
        className={styles.agentChip}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((was) => !was)}
      >
        <span className={styles.srOnly}>{TALKING_TO} </span>
        {current}
        <span className={styles.caret} aria-hidden="true">▾</span>
      </button>
      <ul id={listId} className={styles.agentList} aria-label={AGENTS_LIST_LABEL} hidden={!open}>
        <ChoiceRow name={AUTO_NAME} chosen={choice.agentId === null} onChoose={() => choose(null)} />
        {agents.map((agent) =>
          isSessionAgent(agent) ? (
            <SessionRow key={agent.id} agent={agent} />
          ) : (
            <ChoiceRow key={agent.id} name={agent.name} chosen={choice.agentId === agent.id} onChoose={() => choose(agent.id)} />
          ),
        )}
      </ul>
    </div>
  )
}

function ChoiceRow({ name, chosen, onChoose }: { readonly name: string; readonly chosen: boolean; readonly onChoose: () => void }) {
  return (
    <li>
      <button type="button" className={styles.agentOption} aria-pressed={chosen} onClick={onChoose}>
        {name}
      </button>
    </li>
  )
}

function SessionRow({ agent }: { readonly agent: RosterAgent }) {
  return (
    <li>
      <HostLink href={sessionHref(agent)} className={styles.agentOption}>
        {agent.name}{' '}
        <span className={styles.sessionTag}>{SESSION_TAG}</span>
      </HostLink>
    </li>
  )
}
