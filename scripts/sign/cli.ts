/**
 * The sign workflow's one command (.github/workflows/theme-sign.yml). Node runs this TypeScript
 * directly (type stripping, Node 22.18 or later); nothing is installed first.
 *
 * Reads the request from SIGN_REQUEST and the key from THEME_SIGNING_KEY, prints the signature and
 * appends the same lines to the job summary. Exit 0 when signed, 1 when refused (the reason is
 * printed as a workflow error; the key is never printed).
 *
 * Every line printed is checked first: no line break and no `::` (request.ts `isEchoSafe`), so
 * nothing from the request can start a workflow command (`::add-mask::`, `::stop-commands::`, ...)
 * on a line of its own. The fields themselves are already held to core's patterns.
 */
import { appendFileSync } from 'node:fs'
import { isEchoSafe } from './request.ts'
import { KEY_ENV, signedReport, signRequest } from './sign.ts'

const REQUEST_ENV = 'SIGN_REQUEST'
const SUMMARY_ENV = 'GITHUB_STEP_SUMMARY'
const EXIT_OK = 0
const EXIT_REFUSED = 1
const UNSAFE_OUTPUT = 'The output would have held a line break or a double colon, so nothing was printed.'

/** A backtick fence longer than any run of backticks in the lines, so none of them can close it. */
function fenceFor(lines: readonly string[]): string {
  const longest = Math.max(0, ...lines.flatMap((line) => Array.from(line.matchAll(/`+/g), (match) => match[0].length)))
  return '`'.repeat(Math.max(3, longest + 1))
}

function writeSummary(lines: readonly string[]): void {
  const path = process.env[SUMMARY_ENV]
  if (path === undefined || path === '') return
  const fence = fenceFor(lines)
  appendFileSync(path, ['## Theme signature', '', `${fence}text`, ...lines, fence, ''].join('\n'))
}

function refuse(reason: string): number {
  const shown = isEchoSafe(reason) ? reason : UNSAFE_OUTPUT
  // A workflow command's message decodes %XX escapes: write % as %25 so the reason reads as given.
  process.stderr.write(`::error title=Not signed::${shown.replace(/%/g, '%25')}\n`)
  writeSummary([`Not signed: ${shown}`])
  return EXIT_REFUSED
}

function run(): number {
  const pem = process.env[KEY_ENV]
  delete process.env[KEY_ENV]
  const result = signRequest(process.env[REQUEST_ENV] ?? '', pem)
  if (!result.ok) return refuse(result.error)
  const lines = signedReport(result.value)
  if (!lines.every(isEchoSafe)) return refuse(UNSAFE_OUTPUT)
  process.stdout.write(`${lines.join('\n')}\n`)
  writeSummary(lines)
  return EXIT_OK
}

process.exitCode = run()
