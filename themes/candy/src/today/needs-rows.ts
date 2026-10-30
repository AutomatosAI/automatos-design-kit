import {
  missionHref,
  QUESTIONS_HREF,
  ticketHref,
  type NeedsYou,
  type NeedsYouAskRow,
  type NeedsYouTicketRow,
} from '@automatos/theme-sdk'

/**
 * The Needs-you window's rows as data: the SDK's useNeedsYou rows (in review, questions, approvals, stuck and failed)
 * in one list, newest first, each with its title, its agent, when it started waiting and where it opens. A row opens
 * the thing itself, as the Command Center's own Needs-you list links it: a ticket on the board (or its Mission, when
 * the row says the decision is the Mission's), a question inside its ticket, a Mission's plan at its Mission, and
 * anything with no ticket on the Command Center tab that lists it. Pure.
 */

/** The Command Center: its first tab sums up everything that needs the person. */
export const NEEDS_YOU_HREF = '/command-center'
/** The Command Center's approvals tab, where an approval with no ticket is decided. */
export const APPROVALS_HREF = '/command-center?tab=governance'
/** Who a row names when it names no agent. */
export const SOME_AGENT = 'An agent'

export type NeedKind = 'review' | 'question' | 'approval' | 'stuck' | 'failed'

export interface NeedRow {
  readonly key: string
  readonly kind: NeedKind
  readonly title: string
  /** The agent's name, or null when the row names none. */
  readonly agent: string | null
  readonly at: string | null
  readonly href: string
}

/** A ticket's row opens the ticket, or its Mission when the decision is the Mission's. */
export function ticketRowHref(row: NeedsYouTicketRow): string {
  return row.opens === 'mission' && row.mission_id ? missionHref(row.mission_id) : ticketHref(row.ticket_id)
}

/** A question or an approval opens inside its ticket, a Mission's plan at its Mission, anything else at `fallback`. */
export function askRowHref(row: NeedsYouAskRow, fallback: string): string {
  if (row.source === 'mission') return missionHref(row.id)
  return row.ticket_id !== null && row.ticket_id !== undefined ? ticketHref(row.ticket_id, row.id) : fallback
}

function ticketTitle(row: NeedsYouTicketRow): string {
  return row.title?.trim() || `Ticket ${row.number ?? row.ticket_id}`
}

function askTitle(row: NeedsYouAskRow, kind: 'question' | 'approval'): string {
  if (row.title?.trim()) return row.title.trim()
  if (kind === 'question') return 'A question'
  return row.source === 'mission' ? 'A Mission plan' : 'An approval'
}

function fromTicket(kind: NeedKind) {
  return (row: NeedsYouTicketRow): NeedRow => ({
    key: `${kind}-${row.ticket_id}`,
    kind,
    title: ticketTitle(row),
    agent: row.agent_name,
    at: row.at,
    href: ticketRowHref(row),
  })
}

function fromAsk(kind: 'question' | 'approval', fallback: string) {
  return (row: NeedsYouAskRow): NeedRow => ({
    key: `${kind}-${row.source}-${row.id}`,
    kind,
    title: askTitle(row, kind),
    agent: row.agent_name,
    at: row.at,
    href: askRowHref(row, fallback),
  })
}

function timeOf(at: string | null): number | null {
  const time = at ? Date.parse(at) : Number.NaN
  return Number.isFinite(time) ? time : null
}

/** Newest first; a row with no time after every row with one. */
function newestFirst(a: NeedRow, b: NeedRow): number {
  const [left, right] = [timeOf(a.at), timeOf(b.at)]
  if (left === null || right === null) return (left === null ? 1 : 0) - (right === null ? 1 : 0)
  return right - left
}

/** Every row that needs the person, newest first; a row with no time goes last. */
export function needRows(needs: NeedsYou): readonly NeedRow[] {
  const { rows } = needs
  const all: readonly NeedRow[] = [
    ...rows.review.map(fromTicket('review')),
    ...rows.question.map(fromAsk('question', QUESTIONS_HREF)),
    ...rows.approval.map(fromAsk('approval', APPROVALS_HREF)),
    ...rows.stuck.map(fromTicket('stuck')),
    ...rows.failed.map(fromTicket('failed')),
  ]
  return [...all].sort(newestFirst)
}
