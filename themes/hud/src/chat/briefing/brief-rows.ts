import {
  type Brief,
  type BriefOpensType,
  type BriefRow,
  type BriefSection,
  chatHref,
  missionHref,
  QUESTIONS_HREF,
  ticketHref,
} from '@automatos/theme-sdk'

import { deliverableHref, isDeliverableId } from '../deliverable-link'
import { MISSION_ID } from '../panels/mission-rows'
import { MONTHS, WEEKDAYS } from '../panels/panel-rows'

/**
 * HUD 1.2.0 (PRD-268): what BRIEFING shows of the day's brief (the SDK's Brief@1, from useBrief). Its sections in
 * Brief@1's order, each with the brief's own label and exact count; every row numbered across the sections in that
 * order, as the host's Listen numbers the titles it reads (so "start two" names a row); the line the brief gives for a
 * section it folded; where a row opens, on the SDK's routes; the brief's day and a row's time in HUD's mono words. The
 * words are the brief's (the server's, in the person's language); the labels below are the SDK's own English defaults,
 * for a brief that leaves one out. Pure but for the SDK's href builders.
 */

/** Brief@1's sections in its order: the order Listen numbers the rows in. */
export const BRIEF_SECTIONS: readonly BriefSection[] = ['needs_you', 'suggestions', 'today', 'since', 'unchecked']

/** Each section's label, as the SDK's defaults word it, for a brief whose labels leave one out. */
export const SECTION_LABELS: Readonly<Record<BriefSection, string>> = {
  needs_you: 'Needs you',
  suggestions: 'Suggested',
  today: 'Today',
  since: 'Since your last brief',
  unchecked: "Couldn't check",
}

/** The empty brief's sentence, as the SDK's defaults word it, for a brief that gives none. */
export const EMPTY_BRIEF = 'Nothing new needs you, and nothing is scheduled today.'
/** Where a row about a setting opens: the host's Settings. */
export const SETTINGS_HREF = '/settings'

export interface NumberedRow {
  /** Its number across the brief, from 1. */
  readonly number: number
  readonly row: BriefRow
}

export interface ShownSection {
  readonly section: BriefSection
  readonly label: string
  /** The exact count (the rows a section without one shows). */
  readonly count: number
  readonly rows: readonly NumberedRow[]
  /** The brief's "Show N more" for a section it folded; null for one shown whole. */
  readonly more: string | null
}

function rowsOf(brief: Brief, section: BriefSection): readonly BriefRow[] {
  return brief.sections[section] ?? []
}

function countOf(brief: Brief, section: BriefSection): number {
  if (section === 'unchecked') return rowsOf(brief, section).length
  return brief.counts[section] ?? rowsOf(brief, section).length
}

function moreOf(brief: Brief, section: BriefSection): string | null {
  const folded = countOf(brief, section) > rowsOf(brief, section).length
  return folded ? brief.labels?.more?.[section] ?? null : null
}

/** The sections with rows, in Brief@1's order, every row numbered across them. */
export function briefSections(brief: Brief): readonly ShownSection[] {
  const present = BRIEF_SECTIONS.filter((section) => rowsOf(brief, section).length > 0)
  return present.map((section, index) => {
    const before = present.slice(0, index).reduce((sum, name) => sum + rowsOf(brief, name).length, 0)
    return {
      section,
      label: brief.labels?.sections?.[section] ?? SECTION_LABELS[section],
      count: countOf(brief, section),
      rows: rowsOf(brief, section).map((row, at) => ({ number: before + at + 1, row })),
      more: moreOf(brief, section),
    }
  })
}

/** The brief's sentence for a day with nothing in it. */
export function emptyLine(brief: Brief): string {
  return brief.labels?.empty ?? EMPTY_BRIEF
}

const OPENS: Readonly<Record<BriefOpensType, (id: string) => string | null>> = {
  ticket: (id) => ticketHref(id),
  // The brief names the question, not its ticket: the Questions tab, where it is answered.
  question: () => QUESTIONS_HREF,
  mission: (id) => (MISSION_ID.test(id) ? missionHref(id) : null),
  chat: (id) => chatHref(id),
  deliverable: (id) => (isDeliverableId(id) ? deliverableHref(id) : null),
  // A suggestion's row is started or hidden where it stands; it opens nowhere.
  suggestion: () => null,
  settings: () => SETTINGS_HREF,
}

/** Where a row opens, or null for a row with nowhere to go. */
export function briefRowHref(row: BriefRow): string | null {
  const opens = row.opens
  if (!opens || !Object.prototype.hasOwnProperty.call(OPENS, opens.type)) return null
  return OPENS[opens.type](opens.id)
}

/** The id of the suggestion a row starts, or null for a row Start doesn't apply to. */
export function startsSuggestion(row: BriefRow): string | null {
  return row.action?.verb === 'start' && row.opens?.type === 'suggestion' ? row.opens.id : null
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/

function twoDigits(value: number): string {
  return String(value).padStart(2, '0')
}

/** The brief's day in HUD's words ("Wed 14 Oct"); the date as it is when it is not one. */
export function briefDay(date: string): string {
  const parts = DATE.exec(date)
  if (parts === null) return date
  const day = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]))
  if (Number.isNaN(day.getTime())) return date
  return `${WEEKDAYS[day.getDay()]} ${day.getDate()} ${MONTHS[day.getMonth()]}`
}

/** A row's time of day ("11:00"), or null without one it can read. */
export function rowTime(at: string | null | undefined): string | null {
  if (!at) return null
  const when = new Date(at)
  return Number.isNaN(when.getTime()) ? null : `${twoDigits(when.getHours())}:${twoDigits(when.getMinutes())}`
}

/** A row's number as BRIEFING draws it ("01"). */
export function rowNumber(number: number): string {
  return twoDigits(number)
}
