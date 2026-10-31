/**
 * PRD-268 (SDK 1.3.0): the checks the cards area's proactive stand-ins make on a theme's props before they draw. Not
 * an SDK name.
 *
 * Mirrors core's frontend/lib/theme-sdk/host-cards/proactive-props.ts (at 1a8956c874dc42cff05b96f431c50b7d722a71aa): a
 * brief, a suggestion, a readiness answer or a calibration is read as the host reads one off the wire (wire.ts), so a
 * row, an item or a line that isn't one is left out, and a value of the wrong kind throws a TypeError naming the card
 * and the prop, in the SDK's words.
 */
import type {
  Brief, Calibration, CalibrationLine, CalibrationSource, Readiness, ReadinessItem, Retry, Suggestion, SuggestionCardVariant,
} from '@automatos/theme-sdk'
import { briefOf, readinessOf, recordOf, suggestionOf, textOf } from './wire.ts'

const SDK_PREFIX = 'Automatos theme SDK: '
const VARIANTS: readonly SuggestionCardVariant[] = ['card', 'pinned']
export const RETRIES: readonly Retry[] = Object.freeze(['rerun_mission', 'replan_mission', 'retry_ticket'])
const SOURCE_TYPES: readonly CalibrationSource['type'][] = ['deliverable', 'conversation', 'document', 'skill']

function rejected(card: string, what: string): TypeError {
  return new TypeError(`${SDK_PREFIX}${card} needs ${what}.`)
}

/** A theme's handler: a function, or left out; anything else throws. */
export function handlerOf<F extends (...args: never[]) => unknown>(value: F | undefined, card: string, prop: string): F | undefined {
  if (value === undefined || typeof value === 'function') return value
  throw rejected(card, `${prop} to be a function`)
}

export function requiredHandler<F extends (...args: never[]) => unknown>(value: F | undefined, card: string, prop: string): F {
  const handler = handlerOf(value, card, prop)
  if (handler === undefined) throw rejected(card, `${prop} to be a function`)
  return handler
}

/** Some text, null where null is allowed, or left out; anything else throws. */
export function optionalText(value: unknown, card: string, prop: string): string | null | undefined {
  if (value === undefined || value === null || typeof value === 'string') return value
  throw rejected(card, `${prop} to be some text`)
}

export function checkedFlag(value: unknown, card: string, prop: string): boolean {
  if (typeof value === 'boolean') return value
  throw rejected(card, `${prop} to be true or false`)
}

export function checkedBrief(value: unknown): Brief {
  const brief = briefOf(value)
  if (brief === null) throw rejected('BriefCard', 'brief to be a Brief@1 (v 1, with its date, greeting and prose)')
  return brief
}

export function checkedSuggestion(value: unknown): Suggestion {
  const suggestion = suggestionOf(value)
  if (suggestion === null) throw rejected('SuggestionCard', "suggestion to be one of useSuggestions' rows (its id, title and proposed_action)")
  return suggestion
}

export function checkedVariant(value: unknown): SuggestionCardVariant | undefined {
  if (value === undefined) return undefined
  const variant = VARIANTS.find((known) => known === value)
  if (variant === undefined) throw rejected('SuggestionCard', `variant to be one of ${VARIANTS.join(', ')}`)
  return variant
}

export function checkedRetry(value: unknown): Retry | null | undefined {
  if (value === undefined || value === null) return value
  const retry = RETRIES.find((known) => known === value)
  if (retry === undefined) throw rejected('StatusLabel', `retry to be one of ${RETRIES.join(', ')}`)
  return retry
}

/** Readiness@1 as the host reads it, or null while it loads. */
export function checkedReadiness(value: unknown): Readiness | null {
  if (value === null || value === undefined) return null
  if (recordOf(value) === null) throw rejected('ReadinessList', 'readiness to be a Readiness@1, or null while it loads')
  return readinessOf(value)
}

/** The browser's own rows, read as the server's are. */
export function checkedClientItems(value: unknown): readonly ReadinessItem[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw rejected('ReadinessList', 'clientItems to be a list of readiness items')
  return readinessOf({ items: value }).items
}

/** The read's failure as the host's list takes it: an error whose message it never shows (it says its own line). */
export function readFailure(value: unknown): Error | undefined {
  const message = optionalText(value, 'ReadinessList', 'error')
  return message ? new Error(message) : undefined
}

function sourceOf(value: unknown): CalibrationSource | null {
  const fields = recordOf(value)
  const type = SOURCE_TYPES.find((known) => known === fields?.type)
  const id = textOf(fields?.id)
  if (type === undefined || id === undefined) return null
  return { type, id, label: textOf(fields?.label) ?? id }
}

function lineOf(value: unknown): CalibrationLine | null {
  const fields = recordOf(value)
  const id = textOf(fields?.id)
  const text = textOf(fields?.text)
  const sources = fields?.sources
  if (id === undefined || text === undefined) return null
  const read = Array.isArray(sources) ? sources.map(sourceOf) : []
  return { id, text, sources: read.filter((source): source is CalibrationSource => source !== null) }
}

/** Calibration@1 as the card takes it: a line without its id and text is left out, and so is an offer that isn't text. */
export function checkedCalibration(value: unknown): Calibration {
  const fields = recordOf(value)
  const id = textOf(fields?.id)
  const lines = fields?.lines
  const offers = fields?.offers
  if (fields?.v !== 1 || id === undefined || !Array.isArray(lines) || !Array.isArray(offers)) {
    throw rejected('CalibrationCard', 'calibration to be a Calibration@1 (v 1, its id, lines and offers)')
  }
  return {
    v: 1,
    id,
    lines: lines.map(lineOf).filter((line): line is CalibrationLine => line !== null),
    offers: offers.filter((offer): offer is string => typeof offer === 'string'),
    empty: fields?.empty === true,
  }
}

/** The chips a theme gave, as a list ReplyChips filters; throws when there is no list. */
export function checkedChips(value: unknown): readonly string[] {
  if (!Array.isArray(value)) throw rejected('ReplyChips', 'chips to be a list of short answers')
  return value.filter((chip): chip is string => typeof chip === 'string')
}
