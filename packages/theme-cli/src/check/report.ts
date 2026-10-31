/**
 * The report `check` builds: core's review stage report, schema `automatos-theme-scan/v2`.
 *
 * A port of core's orchestrator/services/themes/review_stage.py (`run_review_stage`, `verdict_of`)
 * and scan.py (`build_scan_report`) at CORE_SHA, the commit src/core/README.md names. Every check
 * has a `level`: `pass`, `warning`, `error`, or `not_measured` for a check that can't be made here.
 * The verdict is `blocked` on any error, `review_required` on any warning, else `pass`;
 * `not_measured` never moves it.
 *
 * The reader's checks (`sizes`, `cssScope`, `looks`) run on a package core's reader accepted, so
 * each is a pass with what it measured. `contrast` (review_stage.py `contrast_check`) measures the
 * colour pairs of theme.json's `mobile` block (mobile-contrast.ts, PRD-261 M-03): a pair under its AA
 * minimum, or a colour set with no ground or text, is an error (MOBILE_CONTRAST_FAIL_LEVEL), every
 * measured pair at AA a pass. Without the block it is `not_measured` per preset: a look is knob values,
 * and nothing else in the package says which painted colour is text on which ground. `llm` is the
 * Marketplace's own stage, which runs only on the server.
 */
import { STYLE_PATH } from '@automatos/vite-preset/css-scope'
import { ENTRY_PATH } from '../check-package.ts'
import { byText } from '../collect.ts'
import { CAPS, CODE_KINDS, fileKind } from '../files.ts'
import { presetIds } from '../looks.ts'
import {
  describeMeasure, isMeasured, measureMobile, OUTCOME_FAIL, OUTCOME_NOT_MEASURED, OUTCOME_PASS, type MobileOutcome,
} from './mobile-contrast.ts'

/**
 * The core repo and commit whose review checks this port reproduces (src/core/README.md's Source line). A temporary
 * pin: the head of core pull request #1383 (SDK 1.4.0); re-pin to core `main` after it merges.
 */
export const CORE_REPO = 'AutomatosAI/automatos-ai'
export const CORE_SHA = '27478124f146460fb9477d1ac372f0991f3410d0'

export const REPORT_SCHEMA = 'automatos-theme-scan/v2'
export const STAGE = 'C-02a'
export const LEVEL_PASS = 'pass'
export const LEVEL_WARNING = 'warning'
export const LEVEL_ERROR = 'error'
export const LEVEL_NOT_MEASURED = 'not_measured'
export const LEVELS = [LEVEL_PASS, LEVEL_WARNING, LEVEL_ERROR, LEVEL_NOT_MEASURED] as const
export type Level = (typeof LEVELS)[number]

export const VERDICT_PASS = 'pass'
export const VERDICT_REVIEW = 'review_required'
export const VERDICT_BLOCKED = 'blocked'
export type Verdict = typeof VERDICT_PASS | typeof VERDICT_REVIEW | typeof VERDICT_BLOCKED

const STATUS_PASS = 'pass'
const STATUS_ABSENT = 'absent'
const STATUS_NOT_RUN = 'not_run'
const CLIP_KINDS: ReadonlySet<string> = new Set(['clip'])
/** contract.py CAP_SETTINGS, in its order: the caps the sizes check reports. */
const CAP_NAMES = ['package', 'code', 'entry', 'clip'] as const

export const CONTRAST_NOT_RUN = (
  'Not measured: the package declares no text and ground colour pairs for its looks, '
  + 'so the server has nothing to check AA contrast against.'
)
/** The `contrast` line's second sentence for a theme without the block (the report keeps core's reason alone). */
export const NO_MOBILE_BLOCK = 'The review measures the colour pairs of a "mobile" block, and theme.json has none.'
/** review_stage.py: a mobile pair under AA blocks the review, since a phone must read a theme that claims it. */
export const MOBILE_CONTRAST_FAIL_LEVEL: Level = LEVEL_ERROR
/** review_stage.py CONTRAST_LEVELS: the measure's outcome as the check's level. */
export const CONTRAST_LEVELS: Readonly<Record<MobileOutcome, Level>> = {
  [OUTCOME_FAIL]: MOBILE_CONTRAST_FAIL_LEVEL, [OUTCOME_PASS]: LEVEL_PASS, [OUTCOME_NOT_MEASURED]: LEVEL_NOT_MEASURED,
}
export const LLM_SERVER_ONLY = 'server only: the Marketplace runs it'

/** A package's files by path. */
export type Files = ReadonlyMap<string, Uint8Array>
/** A checked theme.json. */
export type Manifest = Readonly<Record<string, unknown>>

/** One check of the report: its level and what it measured. */
export interface CheckEntry {
  readonly level: Level
  readonly [field: string]: unknown
}

/** What a check's line says: one sentence, and the plain lines under it. */
export interface CheckText {
  readonly text: string
  readonly items: readonly string[]
}

export interface SizeEntry extends CheckEntry {
  readonly packageBytes: number
  readonly codeBytes: number
  readonly entryBytes: number
  readonly largestClipBytes: number
  readonly limits: Readonly<Record<(typeof CAP_NAMES)[number], number>>
}

/** The `contrast` entry: the mobile block measured (mobile-contrast.ts `MobileMeasure`), or not run per preset. */
export type ContrastEntry = CheckEntry & { readonly reason: string }

export interface ReaderChecks {
  readonly sizes: SizeEntry
  readonly cssScope: CheckEntry & { readonly status: string; readonly path: string }
  readonly looks: CheckEntry & { readonly presets: readonly string[] }
  readonly contrast: ContrastEntry
}

export type Checks = Readonly<Record<string, CheckEntry>>

export interface ScanReport {
  readonly schema: typeof REPORT_SCHEMA
  readonly stage: typeof STAGE
  readonly verdict: Verdict
  readonly summary: Readonly<Record<Level, number>>
  readonly checks: Checks
}

function bytesOf(files: Files, kinds: ReadonlySet<string>): number[] {
  return Array.from(files).filter(([path]) => kinds.has(fileKind(path)?.name ?? '')).map(([, data]) => data.length)
}

/** scan.py `size_check`: what the size caps measured, and the caps in force, in bytes. */
export function sizeCheck(files: Files, packageBytes: number): SizeEntry {
  const code = bytesOf(files, CODE_KINDS).reduce((sum, size) => sum + size, 0)
  return {
    status: STATUS_PASS,
    packageBytes,
    codeBytes: code,
    entryBytes: files.get(ENTRY_PATH)?.length ?? 0,
    largestClipBytes: Math.max(0, ...bytesOf(files, CLIP_KINDS)),
    limits: { package: CAPS.package, code: CAPS.code, entry: CAPS.entry, clip: CAPS.clip },
    level: LEVEL_PASS,
  }
}

/** The package's preset ids, in order. */
export function presetList(files: Files): string[] {
  return Array.from(presetIds(files.keys())).sort(byText)
}

/**
 * review_stage.py `contrast_check`: the mobile block's pairs measured, at the level its outcome gives,
 * else scan.py's unmeasured entry, each preset listed as not run.
 */
export function contrastCheck(manifest: Manifest, files: Files, presets: readonly string[]): ContrastEntry {
  const measured = measureMobile(manifest, files)
  if (measured === null) {
    return {
      status: STATUS_NOT_RUN,
      reason: CONTRAST_NOT_RUN,
      presets: presets.map((id) => ({ id, status: STATUS_NOT_RUN })),
      level: LEVEL_NOT_MEASURED,
    }
  }
  return { ...measured, level: CONTRAST_LEVELS[measured.status] }
}

/** review_stage.py `_reader_checks`: the reader's checks, passed with what they measured, and the contrast check. */
export function readerChecks(files: Files, packageBytes: number, manifest: Manifest): ReaderChecks {
  const presets = presetList(files)
  return {
    sizes: sizeCheck(files, packageBytes),
    cssScope: { status: files.has(STYLE_PATH) ? STATUS_PASS : STATUS_ABSENT, path: STYLE_PATH, level: LEVEL_PASS },
    looks: { status: STATUS_PASS, presets, level: LEVEL_PASS },
    contrast: contrastCheck(manifest, files, presets),
  }
}

/** The `llm` entry: the Marketplace's LLM stage runs only on the server. */
export function llmCheck(): CheckEntry & { readonly reason: string } {
  return { level: LEVEL_NOT_MEASURED, status: 'server_only', reason: LLM_SERVER_ONLY }
}

/** The reader's checks, each as its line says it. */
export function describeReader(checks: ReaderChecks): Readonly<Record<keyof ReaderChecks, CheckText>> {
  const { sizes, cssScope, looks, contrast } = checks
  const sized = (name: string, bytes: number, cap: number): string => `${name} ${bytes} of ${cap} bytes`
  const sizeText = [
    sized('package', sizes.packageBytes, sizes.limits.package),
    sized('JS and CSS', sizes.codeBytes, sizes.limits.code),
    sized('entry', sizes.entryBytes, sizes.limits.entry),
    sized('largest clip', sizes.largestClipBytes, sizes.limits.clip),
  ].join('; ')
  const scoped = cssScope.status === STATUS_PASS ? `${cssScope.path} is scoped under the theme's class.` : `No ${cssScope.path}.`
  return {
    sizes: { text: `${sizeText}.`, items: [] },
    cssScope: { text: scoped, items: [] },
    looks: { text: `${looks.presets.length} preset(s) pass looks/schema.json: ${looks.presets.join(', ')}.`, items: [] },
    contrast: isMeasured(contrast) ? describeMeasure(contrast) : { text: `${contrast.reason} ${NO_MOBILE_BLOCK}`, items: [] },
  }
}

/** review_stage.py `verdict_of`: `blocked` on any error, `review_required` on any warning, else `pass`. */
export function verdictOf(checks: Checks): Verdict {
  const levels = new Set(Object.values(checks).map((check) => check.level))
  if (levels.has(LEVEL_ERROR)) return VERDICT_BLOCKED
  return levels.has(LEVEL_WARNING) ? VERDICT_REVIEW : VERDICT_PASS
}

/** The number of checks at each level, in LEVELS order. */
export function countsOf(checks: Checks): Record<Level, number> {
  const all = Object.values(checks)
  return Object.fromEntries(LEVELS.map((level) => [level, all.filter((check) => check.level === level).length])) as Record<Level, number>
}

/** The report of `checks`, with its verdict and level counts. */
export function scanReport(checks: Checks): ScanReport {
  return { schema: REPORT_SCHEMA, stage: STAGE, verdict: verdictOf(checks), summary: countsOf(checks), checks }
}
