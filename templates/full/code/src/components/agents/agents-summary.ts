import type { AgentStatistics, RosterAgent } from '@automatos/theme-sdk'

/**
 * The Agents page's data, worked out as the core page works it out (core's lib/agents/stats.ts summariseAgents and
 * lib/agents/tabs.ts, and the status filter of components/agents/studio/agent-management-studio.tsx): pure, so the
 * page and a test read the same numbers. Every number is honest: the SDK's counts carry no success rate, so the
 * core page's SUCCESS cell is the inactive count here.
 */

/** The core page's tabs (`?tab=`): the theme's page is the roster, and the host draws its own page for the rest. */
export const AGENT_TABS = [
  { key: 'roster', label: 'Roster' },
  { key: 'org-chart', label: 'Org Chart' },
  { key: 'configuration', label: 'Configuration' },
  { key: 'skills', label: 'Skills' },
] as const

export const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'idle', label: 'Idle' },
] as const

export type StatusFilter = (typeof STATUS_FILTERS)[number]['key']

export interface AgentSummary {
  readonly total: number
  readonly active: number
  /** Agents whose status is error, failed or inactive. */
  readonly attention: number
  /** The error and failed part of `attention`. */
  readonly failing: number
  readonly inactive: number
}

const FAILING: ReadonlySet<string> = new Set(['error', 'failed'])
const ACTIVE = 'active'
const INACTIVE = 'inactive'
const AGENTS_ROUTE = '/agents'

/** summariseAgents: the counts from the SDK's stats when it has them, else from the roster. */
export function summariseAgents(agents: readonly RosterAgent[], stats: AgentStatistics | null): AgentSummary {
  const failing = agents.filter((agent) => FAILING.has(agent.status)).length
  const inactive = agents.filter((agent) => agent.status === INACTIVE).length
  return {
    total: stats?.total_agents || agents.length,
    active: stats?.active_agents || agents.filter((agent) => agent.status === ACTIVE).length,
    attention: failing + inactive,
    failing,
    inactive: stats?.inactive_agents ?? inactive,
  }
}

/** How many agents each status filter shows. */
export function statusCounts(agents: readonly RosterAgent[]): Readonly<Record<StatusFilter, number>> {
  const active = agents.filter((agent) => agent.status === ACTIVE).length
  return { all: agents.length, active, idle: agents.length - active }
}

/** The words a search matches: the name, the role, the type, the team, the tags and the description. */
function wordsOf(agent: RosterAgent): string {
  const tags = agent.tags ?? []
  return [agent.name, agent.job_title, agent.agent_type, agent.team, agent.description, ...tags].filter(Boolean).join(' ').toLowerCase()
}

/** The agents a search term and a status filter leave, in the roster's order. */
export function filterAgents(agents: readonly RosterAgent[], term: string, status: StatusFilter): RosterAgent[] {
  const needle = term.trim().toLowerCase()
  return agents.filter((agent) => {
    const shown = status === 'all' || (status === 'active') === (agent.status === ACTIVE)
    return shown && (needle === '' || wordsOf(agent).includes(needle))
  })
}

/** A tab's link: the roster is this page, any other tab the host's own page (keepCorePage `tab`). */
export function tabHref(key: string): string {
  return key === 'roster' ? AGENTS_ROUTE : `${AGENTS_ROUTE}?tab=${encodeURIComponent(key)}`
}

/** One agent's details, which the host's own page opens (keepCorePage `agent`). */
export function detailsHref(agent: RosterAgent): string {
  return `${AGENTS_ROUTE}?agent=${encodeURIComponent(String(agent.id))}`
}

/** `count` and the word, plural when it should be. */
export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}
