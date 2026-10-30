/**
 * PRD-261 B-02h: the Lighthouse runs' scores as one Markdown table for the harness job's summary. Report only: the
 * table shows each score and each run that failed, and nothing here judges a score (the bars are not set yet).
 */
import { CATEGORIES, type LighthouseRun } from './plan.ts'

/** Each category's score, 0 to 1, or null when Lighthouse gave none. */
export type Scores = Readonly<Record<string, number | null>>

/** A run's scores, or why it has none. */
export type RunResult =
  | { readonly run: LighthouseRun; readonly scores: Scores }
  | { readonly run: LighthouseRun; readonly failure: string }

export const NO_SCORE = '–'
const PERCENT = 100
const CELL_MAX = 200

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** The categories' scores from a JSON report's text, or why it holds none. */
export function scoresOf(text: string): Scores | string {
  let report: unknown
  try {
    report = JSON.parse(text)
  } catch (error) {
    return `the JSON report can't be read (${String(error)})`
  }
  const categories = isRecord(report) ? report.categories : undefined
  if (!isRecord(categories)) return 'the JSON report has no categories'
  return Object.fromEntries(CATEGORIES.map(({ id }) => {
    const category = categories[id]
    const score = isRecord(category) ? category.score : null
    return [id, typeof score === 'number' ? score : null]
  }))
}

/** A score as Lighthouse shows it, 0 to 100, or NO_SCORE. */
export function scoreText(score: number | null | undefined): string {
  return typeof score === 'number' ? String(Math.round(score * PERCENT)) : NO_SCORE
}

/** Text in one table cell: one line, no column bar, cut to CELL_MAX. */
export function cellText(text: string): string {
  const plain = text.replace(/[\r\n\t]+/g, ' ').replace(/\|/g, '\\|').trim()
  return plain.length > CELL_MAX ? `${plain.slice(0, CELL_MAX - 1)}…` : plain
}

function row(result: RunResult): string {
  const { theme, factor, page } = result.run
  const head = [theme, `${factor.name} ${factor.width} × ${factor.height}`, page]
  const cells = 'scores' in result
    ? CATEGORIES.map(({ id }) => scoreText(result.scores[id]))
    : [`failed: ${result.failure}`, ...CATEGORIES.slice(1).map(() => '')]
  return `| ${[...head, ...cells].map(cellText).join(' | ')} |`
}

/** The job summary's section: what was measured, then one row per run. */
export function summaryTable(results: readonly RunResult[], version: string): string {
  const header = ['Theme', 'Width', 'Page', ...CATEGORIES.map((category) => category.label)]
  const rule = ['---', '---', '---', ...CATEGORIES.map(() => '---:')]
  const rows = results.length === 0 ? ['', 'No theme folder under themes/ holds a theme.json, so nothing was measured.'] : [
    '',
    `| ${header.join(' | ')} |`,
    `| ${rule.join(' | ')} |`,
    ...results.map(row),
  ]
  return [
    '## Lighthouse on the harness (report only)',
    '',
    `Lighthouse ${cellText(version)} on the harness's Chromium, over each theme under themes/ drawn by \`automatos-theme dev\` `
      + 'in its default look with the toolbar off. Report only: no score fails the build, and no bar is applied yet. '
      + 'Each run\'s HTML and JSON reports are in the kit-lighthouse artifact.',
    ...rows,
    '',
  ].join('\n')
}
