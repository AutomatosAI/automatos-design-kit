import type { RosterAgent } from '@automatos/theme-sdk'

import { cardSetOf, type CardSet } from '../ui/sets'

/**
 * Your team as data: each agent's status as a glyph and a word (never colour alone), the filter counts (All, Active,
 * Inactive, counted as the host's own roster counts them: active is the status "active", inactive everything else),
 * the agents a filter and a search leave on screen, the line under each name, and the host page that opens one agent.
 * An agent keeps its gradient (its place in the roster) whatever the filter. Pure.
 */

export type StatusFilter = 'all' | 'active' | 'inactive'

export interface AgentStatus {
  readonly glyph: string
  readonly word: string
  readonly active: boolean
}

export interface RosterCounts {
  readonly all: number
  readonly active: number
  readonly inactive: number
}

export interface RosterEntry {
  readonly agent: RosterAgent
  readonly set: CardSet
}

/** The host's agents page: the roster, where agents are made and changed. */
export const MANAGE_AGENTS_HREF = '/agents'

const ACTIVE: AgentStatus = { glyph: '●', word: 'Active', active: true }
const INACTIVE: AgentStatus = { glyph: '○', word: 'Inactive', active: false }
const ERROR: AgentStatus = { glyph: '✕', word: 'Error', active: false }

/** An agent's status as the card's chip says it; a status this theme doesn't know is shown in its own word. */
export function statusOf(status: string | null | undefined): AgentStatus {
  const word = (status ?? '').trim().toLowerCase()
  if (word === 'active') return ACTIVE
  if (word === 'error') return ERROR
  if (word === '' || word === 'inactive') return INACTIVE
  return { glyph: '○', word: `${word[0].toUpperCase()}${word.slice(1).replace(/_/g, ' ')}`, active: false }
}

export function rosterCounts(agents: readonly RosterAgent[]): RosterCounts {
  const active = agents.filter((agent) => statusOf(agent.status).active).length
  return { all: agents.length, active, inactive: agents.length - active }
}

/** The line under a name: the job title, else the description. */
export function jobOf(agent: RosterAgent): string | null {
  return agent.job_title?.trim() || agent.description?.trim() || null
}

function matchesFilter(agent: RosterAgent, filter: StatusFilter): boolean {
  if (filter === 'all') return true
  return statusOf(agent.status).active === (filter === 'active')
}

/** Whether a search finds the agent: by its name, its job or its team, in any case. */
export function matchesQuery(agent: RosterAgent, query: string): boolean {
  const wanted = query.trim().toLocaleLowerCase()
  if (wanted === '') return true
  return [agent.name, jobOf(agent), agent.team].some((field) => (field ?? '').toLocaleLowerCase().includes(wanted))
}

/** The agents on screen, in roster order, each with the gradient of its place in the roster. */
export function visibleAgents(agents: readonly RosterAgent[], filter: StatusFilter, query: string): readonly RosterEntry[] {
  return agents
    .map((agent, index) => ({ agent, set: cardSetOf(index) }))
    .filter(({ agent }) => matchesFilter(agent, filter) && matchesQuery(agent, query))
}

/** The host's agents page with this agent's details open. */
export function agentHref(id: number): string {
  return `${MANAGE_AGENTS_HREF}?agent=${encodeURIComponent(String(id))}`
}
