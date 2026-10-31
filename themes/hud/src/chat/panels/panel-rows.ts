import type { ActivityFeedItem, Deliverable, RosterAgent } from '@automatos/theme-sdk'

/**
 * What the core screen's side panels show, read off the SDK's data: an agent's status as a glyph and a word (the
 * Command design's README, "Status": never colour alone), the order the roster is listed in, a Mission step's glyph
 * (✓ done, ▸ running, ○ to do, ✕ failed), and when a Deliverable was made, in words. Pure.
 */

/** live: the accent; quiet: the secondary text; failed: the error colour. */
export type StatusTone = 'live' | 'quiet' | 'failed'

export interface StatusMark {
  readonly glyph: string
  readonly word: string
  readonly tone: StatusTone
}

const AGENT_STATUS: Readonly<Record<string, StatusMark>> = {
  active: { glyph: '●', word: 'Active', tone: 'live' },
  inactive: { glyph: '—', word: 'Inactive', tone: 'quiet' },
  error: { glyph: '✕', word: 'Error', tone: 'failed' },
}
const UNAVAILABLE: StatusMark = { glyph: '○', word: 'Unavailable', tone: 'quiet' }
const OTHER_GLYPH = '◆'

function wordOf(status: string): string {
  const words = status.replace(/_+/g, ' ').trim()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Unknown'
}

/** An agent's status: unavailable (it can't run now) first, then the backend's own status. */
export function agentStatus(agent: Pick<RosterAgent, 'status' | 'unavailable'>): StatusMark {
  if (agent.unavailable) return UNAVAILABLE
  const known = Object.prototype.hasOwnProperty.call(AGENT_STATUS, agent.status) ? AGENT_STATUS[agent.status] : undefined
  return known ?? { glyph: OTHER_GLYPH, word: wordOf(agent.status), tone: 'quiet' }
}

/** The line under an agent's name: why it can't run, else its job, its description or its type. */
export function agentDetail(agent: Pick<RosterAgent, 'unavailable' | 'job_title' | 'description' | 'agent_type'>): string {
  return agent.unavailable || agent.job_title || agent.description || agent.agent_type
}

const RANK: Readonly<Record<StatusTone, number>> = { live: 0, failed: 1, quiet: 2 }

/** The roster as the panel lists it: active first, then failing, then the rest, each in the host's order. */
export function agentRows(agents: readonly RosterAgent[]): readonly RosterAgent[] {
  return [...agents].sort((a, b) => RANK[agentStatus(a).tone] - RANK[agentStatus(b).tone])
}

/** How many agents are active, of how many. */
export function activeCount(agents: readonly RosterAgent[]): string {
  const active = agents.filter((agent) => agentStatus(agent).tone === 'live').length
  return `${active} / ${agents.length}`
}

type StepStatus = NonNullable<ActivityFeedItem['step_progress']>['steps'][number]['status']

export const STEP_MARKS: Readonly<Record<StepStatus, string>> = {
  completed: '✓',
  running: '▸',
  pending: '○',
  failed: '✕',
}

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const
const DAY_MS = 86_400_000
/** Up to this many days back a Deliverable is named by its weekday. */
const WEEKDAY_DAYS = 6
export const TODAY = 'Today'

function dayStart(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/** When a Deliverable was made: Today, a weekday within the week, else the day and month; '' for no date. */
export function madeWhen(iso: string, now: Date): string {
  const made = new Date(iso)
  if (Number.isNaN(made.getTime())) return ''
  const days = Math.round((dayStart(now) - dayStart(made)) / DAY_MS)
  if (days <= 0) return TODAY
  if (days <= WEEKDAY_DAYS) return WEEKDAYS[made.getDay()]
  return `${made.getDate()} ${MONTHS[made.getMonth()]}`
}

/** A Deliverable's type as a tag: its artifact type in words ("blog_post" is "blog post"). */
export function deliverableTag(deliverable: Pick<Deliverable, 'artifact_type'>): string {
  return deliverable.artifact_type.replace(/_+/g, ' ').trim()
}
