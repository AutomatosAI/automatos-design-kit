/**
 * PRD-268 (SDK 1.3.0): the proactive shapes read as core reads them off the wire, for the fake proactive area
 * (src/sdk/proactive.ts) and the cards area's proactive stand-ins (src/sdk/cards/*). Not an SDK name.
 *
 * Mirrors core's frontend/lib/proactive/wire.ts (at 1a8956c874dc42cff05b96f431c50b7d722a71aa): an id is a UUID before
 * it could reach a request path, a brief row, a readiness item or a suggestion that isn't what it says is left out
 * (the rest are kept), a readiness fix that isn't an app path loses its link, and unknown fields pass through. Also
 * the one refused line a card shows (components/proactive/use-suggestion-card.ts refusedLine). Pure; nothing here
 * mutates what it reads.
 */
import type { Brief, BriefRow, BriefSection, DisplayState, EvidenceRef, Readiness, ReadinessItem, ReadinessNeed, Suggestion } from '@automatos/theme-sdk'

type Fields = Readonly<Record<string, unknown>>

/** lib/proactive/types.ts: the brief's sections in Brief@1's order, the row states and Hide's reasons. */
export const BRIEF_SECTIONS: readonly BriefSection[] = Object.freeze(['needs_you', 'suggestions', 'today', 'since', 'unchecked'])
export const DISPLAY_STATES: readonly DisplayState[] = Object.freeze(['needs_you', 'working', 'ready', 'done', 'failed'])
export const HIDE_REASONS = Object.freeze(['not_now', 'not_useful', 'wrong_agent'] as const)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const READINESS_STATES: ReadonlySet<string> = new Set(['ready', 'not_checked', 'needs_setup'])
const READINESS_NEEDS: ReadonlySet<string> = new Set(['brief', 'voice', 'push', 'check_in'])
const OPENS_TYPES: ReadonlySet<string> = new Set(['ticket', 'mission', 'question', 'chat', 'deliverable', 'suggestion', 'settings'])
const ACTION_VERBS: ReadonlySet<string> = new Set(['start', 'answer', 'open', 'connect', 'hide'])
/** wire.ts APP_PATH: `/` then neither `/` nor `\`, and no control character or backslash anywhere. */
const APP_PATH = /^\/(?![/\\])[^\u0000-\u001f\u007f\\]*$/
/** use-suggestion-card.ts: the line when the server answered no sentence of its own, and where its own words stop. */
export const REFUSED_FALLBACK = "Couldn't reach Automatos. Try again in a moment."
const SERVER_ERROR_STATUS = 500

export function recordOf(value: unknown): Fields | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Fields) : null
}

export function textOf(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function listOf(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : []
}

/** wire.ts isProactiveId: a suggestion's, a chat's and a message's id. */
export function isProactiveId(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value)
}

export function isDisplayState(value: unknown): value is DisplayState {
  return DISPLAY_STATES.some((state) => state === value)
}

function evidenceOf(value: unknown): EvidenceRef[] {
  return listOf(value)
    .map(recordOf)
    .filter((ref): ref is Fields => ref !== null && typeof ref.type === 'string' && typeof ref.id === 'string')
    .map((ref) => ({ type: ref.type as string, id: ref.id as string }))
}

/** wire.ts suggestionOf: one suggestion, or null without its id, its title and what Start does. */
export function suggestionOf(value: unknown): Suggestion | null {
  const fields = recordOf(value)
  const action = recordOf(fields?.proposed_action)
  if (fields === null || !isProactiveId(fields.id) || typeof fields.title !== 'string' || typeof action?.kind !== 'string') return null
  return {
    ...(fields as unknown as Suggestion),
    detail: textOf(fields.detail) ?? '',
    evidence: evidenceOf(fields.evidence),
    proposed_action: { ...(action as unknown as Suggestion['proposed_action']), payload: recordOf(action?.payload) },
  }
}

function opensOf(value: unknown): BriefRow['opens'] {
  const opens = recordOf(value)
  const type = textOf(opens?.type)
  const id = textOf(opens?.id)
  return type !== undefined && OPENS_TYPES.has(type) && id !== undefined ? { type: type as NonNullable<BriefRow['opens']>['type'], id } : null
}

function actionOf(value: unknown): BriefRow['action'] {
  const action = recordOf(value)
  const verb = textOf(action?.verb)
  const label = textOf(action?.label)
  if (verb === undefined || !ACTION_VERBS.has(verb) || label === undefined) return null
  return { verb: verb as NonNullable<BriefRow['action']>['verb'], label, done_label: textOf(action?.done_label) ?? null }
}

function rowOf(value: unknown): BriefRow | null {
  const fields = recordOf(value)
  if (fields === null || typeof fields.id !== 'string' || typeof fields.title !== 'string' || typeof fields.why !== 'string') return null
  return {
    ...(fields as unknown as BriefRow),
    at: textOf(fields.at) ?? null,
    number: textOf(fields.number) ?? null,
    display_state: isDisplayState(fields.display_state) ? fields.display_state : null,
    opens: opensOf(fields.opens),
    action: actionOf(fields.action),
  }
}

function sectionsOf(value: unknown): Brief['sections'] {
  const fields = recordOf(value)
  const rows = (section: BriefSection): BriefRow[] => listOf(fields?.[section]).map(rowOf).filter((row): row is BriefRow => row !== null)
  return Object.fromEntries(BRIEF_SECTIONS.map((section) => [section, rows(section)])) as unknown as Brief['sections']
}

function countsOf(value: unknown): Brief['counts'] {
  const fields = recordOf(value)
  const count = (section: string): number => {
    const counted = fields?.[section]
    return typeof counted === 'number' && Number.isFinite(counted) ? counted : 0
  }
  return { needs_you: count('needs_you'), suggestions: count('suggestions'), today: count('today'), since: count('since') }
}

function wordsOf(value: unknown): Partial<Record<BriefSection, string>> {
  const fields = recordOf(value)
  const kept = BRIEF_SECTIONS.filter((section) => typeof fields?.[section] === 'string')
  return Object.fromEntries(kept.map((section) => [section, fields?.[section]])) as Partial<Record<BriefSection, string>>
}

/** wire.ts briefOf: a Brief@1, or null when it isn't one (v 1, with its date, greeting and prose). */
export function briefOf(value: unknown): Brief | null {
  const fields = recordOf(value)
  if (fields === null || fields.v !== 1) return null
  if (![fields.date, fields.greeting, fields.prose].every((field) => typeof field === 'string')) return null
  const labels = recordOf(fields.labels)
  return {
    ...(fields as unknown as Brief),
    spoken: textOf(fields.spoken) ?? '',
    sections: sectionsOf(fields.sections),
    counts: countsOf(fields.counts),
    labels: { sections: wordsOf(labels?.sections), more: wordsOf(labels?.more), empty: textOf(labels?.empty) },
    state_hash: textOf(fields.state_hash) ?? '',
    generated_at: textOf(fields.generated_at) ?? '',
  }
}

/** wire.ts appPath: a readiness fix links only to an app path. */
export function appPath(href: unknown): href is string {
  return typeof href === 'string' && APP_PATH.test(href)
}

function fixOf(value: unknown): ReadinessItem['fix'] {
  const fix = recordOf(value)
  const label = textOf(fix?.label)
  return label !== undefined && appPath(fix?.href) ? { label, href: fix?.href as string } : null
}

function itemOf(value: unknown): ReadinessItem | null {
  const fields = recordOf(value)
  const id = textOf(fields?.id)
  const state = textOf(fields?.state)
  if (fields === null || id === undefined || state === undefined || !READINESS_STATES.has(state)) return null
  return {
    ...(fields as unknown as ReadinessItem),
    label: textOf(fields.label) ?? id,
    detail: textOf(fields.detail) ?? '',
    fix: fixOf(fields.fix),
    needed_by: listOf(fields.needed_by).filter((need): need is ReadinessNeed => typeof need === 'string' && READINESS_NEEDS.has(need)),
  }
}

/** wire.ts readinessOf: Readiness@1, an item that isn't one left out. */
export function readinessOf(body: unknown): Readiness {
  const fields = recordOf(body)
  const items = listOf(fields?.items).map(itemOf).filter((item): item is ReadinessItem => item !== null)
  return { v: 1, checked_at: textOf(fields?.checked_at) ?? '', items }
}

/**
 * use-suggestion-card.ts refusedLine over wire.ts refusalOf: the one line a refused Start, Hide, Check again or
 * calibration answer shows. The server's own sentence (`body.detail`, else the message) when it answered one (a
 * `body.code`, or a `status` below 500), else REFUSED_FALLBACK; null for anything that is not an Error.
 */
export function refusedLine(error: unknown): string | null {
  if (!(error instanceof Error)) return null
  const failure = error as Error & { readonly status?: unknown; readonly body?: unknown }
  const body = recordOf(failure.body)
  const code = textOf(body?.code) ?? null
  const status = typeof failure.status === 'number' ? failure.status : null
  const detail = textOf(body?.detail) ?? failure.message
  const answered = code !== null || (status !== null && status < SERVER_ERROR_STATUS)
  return answered && detail ? detail : REFUSED_FALLBACK
}

/** The refusal's code (`body.code`), or null: Check again's `checked_recently`. */
export function refusalCode(error: unknown): string | null {
  return error instanceof Error ? textOf(recordOf((error as Error & { readonly body?: unknown }).body)?.code) ?? null : null
}
