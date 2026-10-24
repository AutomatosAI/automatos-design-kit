/**
 * The contrast measure: WCAG AA for theme.json's `mobile` block (host 1.1.0, PRD-261 M-03).
 *
 * A port of core's orchestrator/services/themes/mobile_contrast.py (`measure_mobile`) at the commit
 * report.ts's CORE_SHA names; report.ts's `contrastCheck` is review_stage.py's `contrast_check`, which
 * turns the outcome into the check's level. A phone draws a theme with a `mobile` block from its tokens
 * alone, so the review measures the pairs it puts text and marks on (MOBILE_CONTRAST_PAIRS,
 * src/core/mobile-manifest.ts): eight text pairs held to MOBILE_AA_TEXT (4.5:1) and two UI pairs held to
 * MOBILE_AA_UI (3:1). It measures exactly what the phone can be served:
 *
 * - each scheme of `mobile.tokens` (`light`, then `dark` when given), or, under `fromLooks`, the
 *   prepaint table's defaults (what a member with no stored look gets: kind `defaults`, id
 *   `boot/prepaint.json#defaults`, which no look id can be, so a preset named `defaults` keeps its own)
 *   and then each preset in looks/presets/ (kind `preset`), each painted as the web paints it
 *   (src/mobile-paint.ts `paintLook`: Studio tokens as "H S% L%" triplets only);
 * - a subject that gives no colour for a MOBILE_REQUIRED_TOKENS token fails, named with what it lacks.
 *   Otherwise a pair whose two tokens are not both set is `not_measured`; a measured pair is `pass` at
 *   or over its minimum (the unrounded ratio, as WCAG reads it) and `fail` under it, and each failure is
 *   a sentence naming the scheme, defaults or preset, both tokens and the ratio;
 * - the outcome is `fail` when any subject fails, `pass` when one was measured and none failed, else
 *   `not_measured`. A manifest without the block gives null, and the review keeps its unmeasured entry.
 *
 * The ratio is look-kit's `contrastRatio`, from @automatos/look-kit's contrast.ts (packages/look-kit, which
 * starts from Play's copy of core's frontend/lib/look-kit/contrast.ts, the same file at CORE_SHA). A token's
 * colour is mobile_tokens.py `parse_colour`: a #rrggbb upper-cased, or a triplet through look-kit hsl.ts
 * `hslToHex`, ported here step for step, so `check` loads look-kit's contrast.ts alone (`check design`'s
 * meter, check/contrast.ts, loads hsl.ts itself). test/check-mobile-contrast.test.ts holds both to the
 * corpus's `contrast` cases. Nothing here throws on a table or preset of the wrong shape: it paints nothing.
 */
import { contrastRatio, toHex, type Rgb } from '@automatos/look-kit/contrast'
import { hasOwn, isRecord, own, PREPAINT_PATH, type JsonRecord } from '../core/css-value.ts'
import {
  isMobileColour, MOBILE_AA_TEXT, MOBILE_AA_UI, MOBILE_CONTRAST_PAIRS, type MobileContrastKind, type MobileContrastPair,
} from '../core/mobile-manifest.ts'
import { parseJson } from '../json.ts'
import { presetFiles } from '../looks.ts'
import { missingTokens, paintLook } from '../mobile-paint.ts'
import type { CheckEntry, CheckText, Files, Manifest } from './report.ts'

export const OUTCOME_PASS = 'pass'
export const OUTCOME_FAIL = 'fail'
export const OUTCOME_NOT_MEASURED = 'not_measured'
export type MobileOutcome = typeof OUTCOME_PASS | typeof OUTCOME_FAIL | typeof OUTCOME_NOT_MEASURED

/** The block's two sources of colour; the report lists `tokens` under `schemes`, `fromLooks` under `presets`. */
export const SOURCE_TOKENS = 'tokens'
export const SOURCE_LOOKS = 'fromLooks'
export type MobileSource = typeof SOURCE_TOKENS | typeof SOURCE_LOOKS

/** Each subject's kind, so a page listing presets can leave the table's defaults out. */
export const SUBJECT_SCHEME = 'scheme'
export const SUBJECT_DEFAULTS = 'defaults'
export const SUBJECT_PRESET = 'preset'
export type SubjectKind = typeof SUBJECT_SCHEME | typeof SUBJECT_DEFAULTS | typeof SUBJECT_PRESET

/** The table's defaults: their id is their label, which no look id can be (it has a '/' and a '#'). */
export const DEFAULTS_ID = `${PREPAINT_PATH}#defaults`
/** The report's ratios, as the corpus writes them. */
export const RATIO_DECIMALS = 2

const MOBILE_FIELD = 'mobile'
/** mobile_manifest.py MOBILE_SCHEMES, in its order (mobile-manifest.ts keeps its copy to itself). */
const MOBILE_SCHEMES = ['light', 'dark'] as const
const MINIMUMS: Readonly<Record<MobileContrastKind, number>> = { text: MOBILE_AA_TEXT, ui: MOBILE_AA_UI }
const KIND_WORDS: Readonly<Record<MobileContrastKind, string>> = { text: 'text', ui: 'UI marks' }
const HEX_MARK = '#'
// hsl.ts: degrees and percents, the channel scale and hslToHex's twelve hue steps.
const FULL_TURN = 360
const PERCENT = 100
const CHANNEL_MAX = 255
const HUE_STEPS = 12

const AA_MINIMUMS = `WCAG AA (${MOBILE_AA_TEXT}:1 for text, ${MOBILE_AA_UI}:1 for UI marks)`
export const CONTRAST_REASONS: Readonly<Record<MobileOutcome, string>> = {
  [OUTCOME_FAIL]: (
    `{failed} measured colour pair(s) of the mobile block are under ${AA_MINIMUMS}, `
    + "so a phone can't be relied on to read this theme."
  ),
  [OUTCOME_PASS]: `Every measured colour pair of the mobile block meets ${AA_MINIMUMS}.`,
  [OUTCOME_NOT_MEASURED]: 'Not measured: no colour pair of the mobile block has both of its tokens set.',
}
export const UNPAINTED_REASON = (
  "{unpainted} of the mobile block's colour sets give no --background or --foreground, so a phone can't draw them."
)
export const UNMEASURED_NOTE = ' {unmeasured} pair(s) are not measured: their two tokens are not both set.'

/** One pair of a subject, measured. */
export interface ContrastPair {
  readonly foreground: string
  readonly background: string
  readonly kind: MobileContrastKind
  readonly minimum: number
  readonly status: MobileOutcome
  /** The ratio to two decimals; null when the pair is not measured. */
  readonly ratio: number | null
}

/** One colour set the phone can be served, measured: a scheme, the table's defaults or a preset. */
export interface ContrastSubject {
  readonly id: string
  readonly kind: SubjectKind
  readonly status: MobileOutcome
  readonly missing: readonly string[]
  readonly pairs: readonly ContrastPair[]
}

/** The block measured, as the review report stores it (report.ts adds the level). */
export interface MobileMeasure {
  readonly source: MobileSource
  readonly status: MobileOutcome
  readonly reason: string
  readonly problems: readonly string[]
  /** `tokens`: each scheme, light first. */
  readonly schemes?: readonly ContrastSubject[]
  /** `fromLooks`: the table's defaults, then each preset by id. */
  readonly presets?: readonly ContrastSubject[]
}

interface Subject {
  readonly id: string
  readonly kind: SubjectKind
  readonly tokens: unknown
}

/** hsl.ts `hslToHex` (mobile_tokens.py `_hsl_to_hex`), step for step, so both give the same channels. */
function hslToHex(hue: number, saturation: number, lightness: number): string {
  const sat = saturation / PERCENT
  const light = lightness / PERCENT
  const chroma = (1 - Math.abs(2 * light - 1)) * sat
  const channel = (offset: number): number => {
    const k = (offset + hue / (FULL_TURN / HUE_STEPS)) % HUE_STEPS
    return Math.round((light - chroma / 2 * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * CHANNEL_MAX)
  }
  const rgb: Rgb = [channel(0), channel(8), channel(4)]
  return toHex(rgb)
}

/** mobile_tokens.py `parse_colour`: a mobile token value as #RRGGBB when it is a triplet or a #rrggbb, else null. */
export function parseColour(value: unknown): string | null {
  if (!isMobileColour(value)) return null
  if (value.startsWith(HEX_MARK)) return value.toUpperCase()
  const [hue, saturation, lightness] = value.replaceAll('%', '').split(' ').map(Number)
  return hslToHex(hue, saturation, lightness)
}

/** A ratio as the report writes it: to two decimals, from the double's exact value (Python's `round`). */
export function roundRatio(ratio: number): number {
  return Number(ratio.toFixed(RATIO_DECIMALS))
}

/** `measure_pair`: one pair of a scheme or painted look, its ratio and `pass` or `fail`, or `not_measured`. */
export function measurePair(tokens: JsonRecord, [foreground, background, kind]: MobileContrastPair): ContrastPair {
  const entry = { foreground, background, kind, minimum: MINIMUMS[kind] }
  const fore = parseColour(own(tokens, foreground))
  const back = parseColour(own(tokens, background))
  if (fore === null || back === null) return { ...entry, status: OUTCOME_NOT_MEASURED, ratio: null }
  const ratio = contrastRatio(fore, back)
  return { ...entry, status: ratio >= entry.minimum ? OUTCOME_PASS : OUTCOME_FAIL, ratio: roundRatio(ratio) }
}

/** `outcome_of`: `fail` when any failed, `pass` when any passed and none failed, else `not_measured`. */
export function outcomeOf(statuses: Iterable<MobileOutcome>): MobileOutcome {
  const seen = new Set(statuses)
  if (seen.has(OUTCOME_FAIL)) return OUTCOME_FAIL
  return seen.has(OUTCOME_PASS) ? OUTCOME_PASS : OUTCOME_NOT_MEASURED
}

/** How a subject is named in a sentence: `mobile.tokens.light`, the defaults' id, or `Preset "<id>"`. */
export function subjectLabel(kind: SubjectKind, id: string): string {
  if (kind === SUBJECT_SCHEME) return `mobile.tokens.${id}`
  return kind === SUBJECT_PRESET ? `Preset "${id}"` : id
}

/** A package file's JSON document, or null when it is absent or not JSON (`_document`). */
function documentOf(files: Files, path: string): unknown {
  const raw = files.get(path)
  if (raw === undefined) return null
  const { data, error } = parseJson(raw, path)
  return error === null ? data : null
}

/** `_scheme_tokens`: each scheme of `mobile.tokens`, light first, with its tokens. */
function schemeSubjects(block: JsonRecord): Subject[] {
  const tokens = own(block, SOURCE_TOKENS)
  const schemes: JsonRecord = isRecord(tokens) ? tokens : {}
  return MOBILE_SCHEMES.filter((scheme) => hasOwn(schemes, scheme))
    .map((scheme): Subject => ({ id: scheme, kind: SUBJECT_SCHEME, tokens: schemes[scheme] }))
}

/** `_look_tokens`: the table's defaults (no stored look), then each preset by id, each painted as the web paints it. */
function lookSubjects(files: Files): Subject[] {
  const table = documentOf(files, PREPAINT_PATH)
  const presets = Array.from(presetFiles(files.keys()), ([id, path]): Subject => (
    { id, kind: SUBJECT_PRESET, tokens: paintLook(table, documentOf(files, path)) }
  ))
  return [{ id: DEFAULTS_ID, kind: SUBJECT_DEFAULTS, tokens: paintLook(table, null) }, ...presets]
}

function failedPair(label: string, pair: ContrastPair): string {
  const ratio = (pair.ratio ?? 0).toFixed(RATIO_DECIMALS)
  return `${label}: ${pair.foreground} on ${pair.background} is ${ratio}:1, `
    + `under the AA minimum of ${pair.minimum}:1 for ${KIND_WORDS[pair.kind]}.`
}

/** `_measure_subject`: one subject's entry and its problems; it fails on a missing required token, else on its pairs. */
function measureSubject(subject: Subject): { readonly entry: ContrastSubject; readonly problems: readonly string[] } {
  const given: JsonRecord = isRecord(subject.tokens) ? subject.tokens : {}
  const missing = missingTokens(given)
  const pairs = MOBILE_CONTRAST_PAIRS.map((pair) => measurePair(given, pair))
  const label = subjectLabel(subject.kind, subject.id)
  const problems = [
    ...(missing.length > 0 ? [`${label}: gives no ${missing.join(' or ')}, so a phone can't draw it.`] : []),
    ...pairs.filter((pair) => pair.status === OUTCOME_FAIL).map((pair) => failedPair(label, pair)),
  ]
  const status: MobileOutcome = missing.length > 0 ? OUTCOME_FAIL : outcomeOf(pairs.map((pair) => pair.status))
  return { entry: { id: subject.id, kind: subject.kind, status, missing, pairs }, problems }
}

/** `_reason`: what failed or passed, the subjects that paint no ground or text, and how many pairs went unmeasured. */
function reasonOf(outcome: MobileOutcome, subjects: readonly ContrastSubject[]): string {
  const pairs = subjects.flatMap((subject) => subject.pairs)
  const failed = pairs.filter((pair) => pair.status === OUTCOME_FAIL).length
  const unmeasured = pairs.filter((pair) => pair.status === OUTCOME_NOT_MEASURED).length
  const unpainted = subjects.filter((subject) => subject.missing.length > 0).length
  const sentences = [
    ...(outcome !== OUTCOME_FAIL || failed > 0 ? [CONTRAST_REASONS[outcome].replace('{failed}', String(failed))] : []),
    ...(unpainted > 0 ? [UNPAINTED_REASON.replace('{unpainted}', String(unpainted))] : []),
  ]
  const reason = sentences.join(' ')
  if (unmeasured > 0 && outcome !== OUTCOME_NOT_MEASURED) return reason + UNMEASURED_NOTE.replace('{unmeasured}', String(unmeasured))
  return reason
}

/**
 * `measure_mobile`: the block measured per scheme, or per painting under `fromLooks` (module comment);
 * null without one. `files` is the checked package's: the presets and the prepaint table under `fromLooks`.
 */
export function measureMobile(manifest: Manifest, files: Files): MobileMeasure | null {
  const block = own(manifest, MOBILE_FIELD)
  if (!isRecord(block)) return null
  const source: MobileSource = own(block, SOURCE_LOOKS) === true ? SOURCE_LOOKS : SOURCE_TOKENS
  const measured = (source === SOURCE_LOOKS ? lookSubjects(files) : schemeSubjects(block)).map(measureSubject)
  const subjects = measured.map(({ entry }) => entry)
  const status = outcomeOf(subjects.map((subject) => subject.status))
  const problems = measured.flatMap((subject) => subject.problems)
  const found = { source, status, reason: reasonOf(status, subjects), problems }
  return source === SOURCE_LOOKS ? { ...found, presets: subjects } : { ...found, schemes: subjects }
}

/** A `contrast` entry that measured a mobile block (it names its source), not the unmeasured one. */
export function isMeasured(entry: CheckEntry): entry is CheckEntry & MobileMeasure {
  return entry.source === SOURCE_TOKENS || entry.source === SOURCE_LOOKS
}

/** The `contrast` line of a measured block: its reason, then each problem, then each subject and its pairs measured. */
export function describeMeasure(measured: MobileMeasure): CheckText {
  const subjects = measured.presets ?? measured.schemes ?? []
  const lines = subjects.map((subject) => {
    const count = subject.pairs.filter((pair) => pair.status !== OUTCOME_NOT_MEASURED).length
    return `${subjectLabel(subject.kind, subject.id)}: ${subject.status}, ${count} of ${subject.pairs.length} pair(s) measured`
  })
  return { text: measured.reason, items: [...measured.problems, ...lines] }
}
