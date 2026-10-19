/**
 * The sign workflow's one command (.github/workflows/theme-sign.yml). Node runs this TypeScript
 * directly (type stripping, Node 22.18 or later); nothing is installed first.
 *
 * Reads the request from SIGN_REQUEST and the key from THEME_SIGNING_KEY, prints the signature and
 * appends the same lines to the job summary. Exit 0 when signed, 1 when refused (the reason is
 * printed as a workflow error; the key is never printed).
 */
import { appendFileSync } from 'node:fs'
import { KEY_ENV, signedReport, signRequest } from './sign.ts'

const REQUEST_ENV = 'SIGN_REQUEST'
const SUMMARY_ENV = 'GITHUB_STEP_SUMMARY'
const EXIT_OK = 0
const EXIT_REFUSED = 1

function writeSummary(lines: readonly string[]): void {
  const path = process.env[SUMMARY_ENV]
  if (path === undefined || path === '') return
  appendFileSync(path, ['## Theme signature', '', '```text', ...lines, '```', ''].join('\n'))
}

function run(): number {
  const pem = process.env[KEY_ENV]
  delete process.env[KEY_ENV]
  const result = signRequest(process.env[REQUEST_ENV] ?? '', pem)
  if (!result.ok) {
    process.stderr.write(`::error title=Not signed::${result.error}\n`)
    writeSummary([`Not signed: ${result.error}`])
    return EXIT_REFUSED
  }
  const lines = signedReport(result.value)
  process.stdout.write(`${lines.join('\n')}\n`)
  writeSummary(lines)
  return EXIT_OK
}

process.exitCode = run()
