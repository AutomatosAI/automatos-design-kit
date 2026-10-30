import type { ActivityFeed, NeedsYou, RosterAgent } from '@automatos/theme-sdk'

/**
 * The party (the design's PARTY window) as data: each agent of the roster with its role and a state word from the
 * host's own data. NEEDS YOU when a row of the Needs-you list (a question, an approval, a review, a stuck or failed
 * ticket) names the agent; WORKING when a run in the activity feed that is working now is the agent's; IDLE
 * otherwise. The Needs-you rows name an agent by its name only, so the match is by name (trimmed, any case). Pure.
 */

export type PartyState = 'needs' | 'working' | 'idle'

export interface PartyMember {
  readonly id: number
  readonly name: string
  readonly role: string
  readonly state: PartyState
  /** The robot it is drawn as: its place in the roster. */
  readonly look: number
}

export const STATE_WORDS: Readonly<Record<PartyState, { readonly glyph: string; readonly word: string }>> = {
  needs: { glyph: '!', word: 'Needs you' },
  working: { glyph: '●', word: 'Working' },
  idle: { glyph: '—', word: 'Idle' },
}

const nameKey = (name: string | null | undefined): string => (name ?? '').trim().toLowerCase()

/** The names the Needs-you rows give, as keys. */
export function needyNames(needsYou: NeedsYou | null): ReadonlySet<string> {
  if (needsYou === null) return new Set()
  const { review, question, approval, stuck, failed } = needsYou.rows
  const rows = [...review, ...question, ...approval, ...stuck, ...failed]
  return new Set(rows.map((row) => nameKey(row.agent_name)).filter((key) => key.length > 0))
}

/** The ids of the agents a working run names. */
export function workingIds(feed: ActivityFeed | null): ReadonlySet<number> {
  if (feed === null) return new Set()
  const running = feed.items.filter((item) => item.status === 'running' || item.status === 'pending')
  const ids = running.flatMap((item) => [item.agent, ...item.agents].flatMap((agent) => (agent?.id == null ? [] : [agent.id])))
  return new Set(ids)
}

/** "research_analyst" as "Research analyst". */
function words(type: string): string {
  const text = type.replace(/[_-]+/g, ' ').trim()
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function roleOf(agent: RosterAgent): string {
  return agent.job_title?.trim() || words(agent.agent_type) || 'Agent'
}

export function partyOf(agents: readonly RosterAgent[], needy: ReadonlySet<string>, working: ReadonlySet<number>): readonly PartyMember[] {
  return agents.map((agent, index) => {
    const state: PartyState = needy.has(nameKey(agent.name)) ? 'needs' : working.has(agent.id) ? 'working' : 'idle'
    return { id: agent.id, name: agent.name, role: roleOf(agent), state, look: index }
  })
}

/** "1 agent", "4 agents". */
export function partyCount(count: number): string {
  return `${count} ${count === 1 ? 'agent' : 'agents'}`
}
