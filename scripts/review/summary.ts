/**
 * The review's summary: plain text the reviewer pastes into the admin queue's report note
 * (`POST /api/admin/themes/{id}/report-note`, `{summary, outcome}`; core keeps at most 20,000
 * characters), and the job summary that shows it on the workflow run inside a fenced block, so
 * nothing from the package renders as Markdown.
 */
import type { ReviewReport } from './review.ts'

/** Core's report-note limit is 20,000 characters (admin_themes.py `SUMMARY_MAX`); stay well under. */
export const SUMMARY_MAX_CHARS = 12_000
const ITEMS_PER_CHECK = 25
const LINE_MAX = 240

/** Every line break a reader or renderer may honour: \r\n, \n, \r, \v, \f, NEL, LS and PS. */
const LINE_BREAK = /\r\n|[\n\r\v\f\x85\u2028\u2029]/

/** One line of plain text: control characters made spaces, cut to LINE_MAX. */
function plainLine(text: string): string {
  const plain = text.replace(/[\x00-\x1f\x7f\x85\u2028\u2029]/g, ' ')
  return plain.length > LINE_MAX ? `${plain.slice(0, LINE_MAX - 1)}…` : plain
}

/** Text from the package (an item, a detail, a manifest field) as plain lines, never a line of the frame. */
function textLines(text: string): string[] {
  return text.split(LINE_BREAK).map(plainLine)
}

function header(report: ReviewReport): string[] {
  const theme = report.id === null ? '(unread package)' : plainLine(`${report.id} ${report.version ?? ''}`.trim())
  const { kitCommit, node, vite, preset } = report.tools
  return [
    `Automatos theme review (${report.schema}): ${theme}`,
    `Outcome: ${report.outcome}`,
    `Expected digest: ${report.expectedDigest}`,
    `Package digest:  ${report.digest ?? '(not read)'}`,
    `Zip sha256:      ${report.zipSha256}`,
    `Kit: ${kitCommit} · Node ${node} · vite ${vite} · @automatos/vite-preset ${preset}`,
    'Isolation: docker run --network none, no secrets, kit installed from its lockfile with --ignore-scripts.',
  ]
}

function checkLines(report: ReviewReport): string[] {
  return report.checks.flatMap((item) => {
    // An item or detail split over lines keeps every line indented under its check, so text from
    // the package can't start a line of its own (a fake `Outcome: pass`).
    const shown = item.items.slice(0, ITEMS_PER_CHECK).flatMap((text) => (
      textLines(text).map((line, index) => `${index === 0 ? '    - ' : '      '}${line}`)
    ))
    const more = item.items.length > ITEMS_PER_CHECK ? [`    - … and ${item.items.length - ITEMS_PER_CHECK} more`] : []
    const [first, ...rest] = textLines(item.detail)
    const head = `  ${item.status.toUpperCase().padEnd(7)} ${item.name}: ${first}`
    return [head, ...rest.map((line) => `      ${line}`), ...shown, ...more]
  })
}

/** The text to paste, at most SUMMARY_MAX_CHARS characters. */
export function summaryText(report: ReviewReport): string {
  const lines = [...header(report), '', 'Checks:', ...checkLines(report)].map(plainLine)
  const text = lines.join('\n')
  if (text.length <= SUMMARY_MAX_CHARS) return text
  return `${text.slice(0, SUMMARY_MAX_CHARS - 40)}\n… (cut to fit the admin queue's note)`
}

/** A backtick fence longer than any run of backticks in `text`. */
function fenceFor(text: string): string {
  const longest = Math.max(0, ...Array.from(text.matchAll(/`+/g), (match) => match[0].length))
  return '`'.repeat(Math.max(3, longest + 1))
}

/** The job summary: what to do with the text, then the text in a fence. */
export function jobSummary(report: ReviewReport): string {
  const text = summaryText(report)
  const fence = fenceFor(text)
  return [
    `## Theme review: ${report.outcome === 'pass' ? 'pass' : 'FAIL'}`,
    '',
    `Paste the text below into the admin queue's report note for this version, with outcome **${report.outcome}**.`,
    '',
    `${fence}text`,
    text,
    fence,
    '',
  ].join('\n')
}
