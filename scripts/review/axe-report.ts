/**
 * The axe part of the review's "Previews and accessibility" section (PRD-261 B-02j): what axe found over the harness
 * shots of the submitted package, as plain text for the job summary. Report only: it is written after the review's own
 * text, by axe.ts, outside the no-network container, and never changes the outcome.
 *
 * `automatos-theme shots` writes one axe.json per set of shots (packages/theme-harness/shots/axe.ts, `{scans}`, each
 * scan a shot's violations with their impact, the rule's help and the elements found), in `<browser>/<group>/`. Every
 * one is read; the text counts the shots and the sets, the violations by impact, and each rule with its help, how
 * many elements it found and in which shots. Element selectors come from the package's page, so they are counted,
 * never printed; every line goes through the review summary's plain-line rule and sits indented under the heading.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, sep } from 'node:path'
import { AXE_FILE } from '../../packages/theme-harness/shots/axe.ts'
import { fenceFor, plainLine } from './summary.ts'

export const AXE_TITLE = 'Previews and accessibility, axe over harness shots of this package'
/** Axe's impacts, most severe first; a violation with none is counted as UNKNOWN_IMPACT. */
export const IMPACTS: readonly string[] = Object.freeze(['critical', 'serious', 'moderate', 'minor'])
export const UNKNOWN_IMPACT = 'unknown'
const UNNAMED_RULE = '(unnamed rule)'
const UNNAMED_SHOT = '(unnamed shot)'
const EXIT_OK = 0
const SHOTS_SHOWN = 3
/** Playwright's own output beside the shots: a failed test's trace, never a set of shots. */
const RESULTS_DIR = 'test-results'

export interface ScanViolation {
  readonly id: string
  readonly impact: string
  readonly help: string
  readonly elements: number
}

/** One shot's scan, as axe.json holds it. */
export interface Scan {
  readonly shot: string
  readonly violations: readonly ScanViolation[]
}

/** One axe.json: its folder under the shots' folder (`<browser>/<group>`) and its scans. */
export interface ScanSet {
  readonly folder: string
  readonly scans: readonly Scan[]
}

export interface RuleFinding {
  readonly id: string
  readonly impact: string
  readonly help: string
  readonly elements: number
  /** Each shot it was found in, as `<browser>/<group>/<shot>`. */
  readonly shots: readonly string[]
}

export interface AxeSummary {
  readonly sets: number
  readonly shots: number
  readonly browsers: readonly string[]
  /** How many violations (a rule in a shot) at each impact, IMPACTS first. */
  readonly byImpact: Readonly<Record<string, number>>
  readonly rules: readonly RuleFinding[]
}

/** What the pass did: not run, and why; or the shots' exit code and what axe found. */
export type AxeRun =
  | { readonly status: 'not_run'; readonly why: string }
  | { readonly status: 'ran'; readonly shotsExit: number; readonly summary: AxeSummary }

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
)
const textOf = (value: unknown, fallback: string): string => (typeof value === 'string' && value !== '' ? value : fallback)

function violationOf(value: unknown): ScanViolation | null {
  if (!isRecord(value)) return null
  const elements = Array.isArray(value.targets) ? value.targets.length : 0
  return { id: textOf(value.id, UNNAMED_RULE), impact: textOf(value.impact, UNKNOWN_IMPACT), help: textOf(value.help, ''), elements }
}

/** An axe.json's scans, read leniently: a file that isn't one gives none. */
export function scansOf(text: string): Scan[] {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return []
  }
  const scans = isRecord(data) && Array.isArray(data.scans) ? data.scans : []
  return scans.filter(isRecord).map((scan) => ({
    shot: textOf(scan.shot, UNNAMED_SHOT),
    violations: (Array.isArray(scan.violations) ? scan.violations : []).map(violationOf).filter((item): item is ScanViolation => item !== null),
  }))
}

/** Every axe.json under `outDir` (Playwright's test-results/ left out), by folder, sorted. */
export function readScanSets(outDir: string): ScanSet[] {
  if (!existsSync(outDir)) return []
  return readdirSync(outDir, { encoding: 'utf8', recursive: true })
    .map((rel) => rel.split(sep).join('/'))
    .filter((rel) => (rel === AXE_FILE || rel.endsWith(`/${AXE_FILE}`)) && !rel.split('/').includes(RESULTS_DIR))
    .sort()
    .map((rel) => ({ folder: rel.slice(0, -AXE_FILE.length).replace(/\/$/, ''), scans: scansOf(readFileSync(join(outDir, rel), 'utf8')) }))
}

function rulesOf(sets: readonly ScanSet[]): RuleFinding[] {
  const rules = new Map<string, RuleFinding>()
  sets.forEach(({ folder, scans }) => scans.forEach(({ shot, violations }) => violations.forEach((violation) => {
    const held = rules.get(violation.id)
    const where = folder === '' ? shot : `${folder}/${shot}`
    rules.set(violation.id, {
      ...violation,
      elements: (held?.elements ?? 0) + violation.elements,
      shots: [...(held?.shots ?? []), where],
    })
  })))
  const rank = (impact: string): number => (IMPACTS.includes(impact) ? IMPACTS.indexOf(impact) : IMPACTS.length)
  return Array.from(rules.values()).sort((a, b) => rank(a.impact) - rank(b.impact) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/** The sets' shots, browsers, violations by impact and rules. */
export function summarize(sets: readonly ScanSet[]): AxeSummary {
  const rules = rulesOf(sets)
  const impacts = [...IMPACTS, UNKNOWN_IMPACT]
  const byImpact = Object.fromEntries(impacts.map((impact) => [
    impact, rules.filter((rule) => rule.impact === impact).reduce((sum, rule) => sum + rule.shots.length, 0),
  ]))
  const browsers = Array.from(new Set(sets.map((set) => set.folder.split('/')[0]).filter((name) => name !== ''))).sort()
  return { sets: sets.length, shots: sets.reduce((sum, set) => sum + set.scans.length, 0), browsers, byImpact, rules }
}

function ruleLines(rule: RuleFinding): string[] {
  const shown = rule.shots.slice(0, SHOTS_SHOWN).join(', ')
  const more = rule.shots.length > SHOTS_SHOWN ? `, and ${rule.shots.length - SHOTS_SHOWN} more` : ''
  return [
    `- ${rule.impact} ${rule.id}: ${rule.help}`,
    `    ${rule.elements} elements in ${rule.shots.length} shots: ${shown}${more}`,
  ]
}

function ranLines(shotsExit: number, summary: AxeSummary): string[] {
  const browsers = summary.browsers.length === 0 ? 'no browser' : summary.browsers.join(' and ')
  const ended = shotsExit === EXIT_OK
    ? '`automatos-theme shots` passed.'
    : `\`automatos-theme shots\` ended with exit code ${shotsExit} (a missing shot, a request to another origin or a critical `
      + 'violation fails it); the scans it wrote are counted here.'
  const impacts = Object.entries(summary.byImpact).filter(([impact, count]) => IMPACTS.includes(impact) || count > 0)
  const counted = `Violations by impact: ${impacts.map(([impact, count]) => `${impact} ${count}`).join(', ')}.`
  const rules = summary.rules.length === 0 ? ['No violations in any shot.'] : [counted, ...summary.rules.flatMap(ruleLines)]
  return [`Shots: ${summary.shots} in ${summary.sets} sets, on ${browsers}. ${ended}`, ...rules]
}

/** The axe part as plain text: its heading, then what was found, or why it did not run. */
export function axeText(run: AxeRun): string {
  if (run.status === 'not_run') return plainLine(`${AXE_TITLE} (report only): not run: ${run.why}`)
  const lines = [`${AXE_TITLE} (report only: the review's outcome does not count it; the person reviewing decides):`]
  return [...lines, ...ranLines(run.shotsExit, run.summary).map((line) => `  ${line}`)].map(plainLine).join('\n')
}

/** The job summary's part: a heading, then the text in a fence, so nothing from the package renders as Markdown. */
export function axeJobSummary(text: string): string {
  const fence = fenceFor(text)
  return ['', '### Previews and accessibility: axe', '', `${fence}text`, text, fence, ''].join('\n')
}
