import {
  BOARD_HREF,
  missionHref,
  type NeedsYou,
  type NeedsYouAskRow,
  type NeedsYouTicketRow,
  QUESTIONS_HREF,
  type ScheduleItem,
  ticketHref,
} from '@automatos/theme-sdk'

import type { StatusTone } from './panel-rows'

/**
 * What the core screen's work panels show, read off the SDK's Command Center data: NEEDS YOU's rows in the core's
 * own order (in review, questions, approvals, stuck, failed), each a title, a glyph and a word (never colour alone)
 * and the page it opens, as the core's Needs-you widget links them (a ticket on the board, or its Mission; a
 * question inside its ticket, else the Questions tab); NEXT UP's runs, soonest first, and when each runs, in words.
 * Pure but for the SDK's href builders.
 */

export type NeedsYouKind = keyof NeedsYou['rows']

export interface NeedsYouRow {
  readonly key: string
  readonly kind: NeedsYouKind
  readonly title: string
  readonly href: string
  /** Who it is waiting with (the agent), or null. */
  readonly detail: string | null
}

export interface KindMark {
  readonly glyph: string
  readonly word: string
  readonly tone: StatusTone
}

export const NEEDS_YOU_ORDER: readonly NeedsYouKind[] = ['review', 'question', 'approval', 'stuck', 'failed']

export const KIND_MARKS: Readonly<Record<NeedsYouKind, KindMark>> = {
  review: { glyph: '◆', word: 'Review', tone: 'live' },
  question: { glyph: '◆', word: 'Question', tone: 'live' },
  approval: { glyph: '◆', word: 'Approval', tone: 'live' },
  stuck: { glyph: '—', word: 'Stuck', tone: 'quiet' },
  failed: { glyph: '✕', word: 'Failed', tone: 'failed' },
}

const UNTITLED: Readonly<Record<NeedsYouKind, string>> = {
  review: 'A ticket to review',
  question: 'A question',
  approval: 'An approval',
  stuck: 'A stuck ticket',
  failed: 'A failed ticket',
}

function numbered(number: string | null | undefined, title: string): string {
  return number ? `${number} · ${title}` : title
}

/** A ticket opens on the board, or at its Mission when the row says so (the core's ticketRowHref). */
function ticketRow(kind: NeedsYouKind, row: NeedsYouTicketRow): NeedsYouRow {
  const href = row.opens === 'mission' && row.mission_id ? missionHref(row.mission_id) : ticketHref(row.ticket_id)
  const title = numbered(row.number, row.title ?? UNTITLED[kind])
  return { key: `${kind}-t${row.ticket_id}`, kind, title, href, detail: row.agent_name }
}

/** A Mission's ask opens at its plan, any other inside its ticket, else on its tab (the core's askRowHref). */
function askRow(kind: NeedsYouKind, row: NeedsYouAskRow): NeedsYouRow {
  const fallback = kind === 'question' ? QUESTIONS_HREF : BOARD_HREF
  const ticket = row.ticket_id !== null ? ticketHref(row.ticket_id, row.id) : fallback
  const href = row.source === 'mission' ? missionHref(row.id) : ticket
  const title = numbered(row.number, row.title ?? (row.source === 'mission' ? 'A Mission plan' : UNTITLED[kind]))
  return { key: `${kind}-${row.source}${row.id}`, kind, title, href, detail: row.agent_name }
}

/** Every row behind the Needs-you number, in the core's order. */
export function needsYouRows(needs: NeedsYou): readonly NeedsYouRow[] {
  const { rows } = needs
  return [
    ...rows.review.map((row) => ticketRow('review', row)),
    ...rows.question.map((row) => askRow('question', row)),
    ...rows.approval.map((row) => askRow('approval', row)),
    ...rows.stuck.map((row) => ticketRow('stuck', row)),
    ...rows.failed.map((row) => ticketRow('failed', row)),
  ]
}

export interface UpcomingRun {
  readonly item: ScheduleItem
  readonly at: Date
}

/** The runs with a time, soonest first. */
export function upcomingRuns(scheduled: readonly ScheduleItem[]): readonly UpcomingRun[] {
  return scheduled
    .flatMap((item) => {
      const at = item.next_run_at ? new Date(item.next_run_at) : null
      return at === null || Number.isNaN(at.getTime()) ? [] : [{ item, at }]
    })
    .sort((a, b) => a.at.getTime() - b.at.getTime())
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const
const DAY_MS = 86_400_000
/** Up to this many days ahead a run is named by its weekday. */
const WEEKDAY_DAYS = 6

function dayStart(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

function clock(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/** When a run is: its time today (or earlier), its weekday and time within the week, else its day and month. */
export function runsWhen(at: Date, now: Date): string {
  const days = Math.round((dayStart(at) - dayStart(now)) / DAY_MS)
  if (days <= 0) return clock(at)
  if (days <= WEEKDAY_DAYS) return `${WEEKDAYS[at.getDay()]} ${clock(at)}`
  return `${at.getDate()} ${MONTHS[at.getMonth()]} ${clock(at)}`
}
