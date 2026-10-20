/**
 * The server's answer to a submission, as lines for the person who ran `submit`.
 *
 * Shapes read from core (orchestrator/api/marketplace_themes_submit.py and its gates):
 * - 201 (new) or 200 (these exact bytes were submitted already): `{package: {themeId, version,
 *   digest, status, scanVerdict, scanReport}, duplicate}`; `scanReport` is the member view of the
 *   automated stage's report (`checks.<name>.level`, with `reason` or `problems` when it has them).
 * - a refusal: `{detail: "<sentence>"}`; `{detail: {message, errors: [{code, path, message}]}}`
 *   for a refused package (400, 413); `{detail: {code, message}}` when keys can't do step-up;
 *   `{code: "step_up_required", detail, clerk_error}` when the sign-in is too old; a list of
 *   `{loc, msg}` from FastAPI's request validation (422).
 *
 * Every text the server sent is printed with control characters replaced, so an answer can't
 * move the cursor or recolour the terminal.
 */
import { ENV_TOKEN, ENV_URL } from './submit-target.ts'

export interface ServerAnswer {
  readonly status: number
  readonly statusText: string
  readonly headers: Headers
  readonly text: string
}

export interface DescribedAnswer {
  /** True only when the server took the submission. */
  readonly ok: boolean
  readonly lines: readonly string[]
}

type Json = Record<string, unknown>

/** How much of an answer that isn't JSON (an HTML error page, say) is printed. */
const RAW_TEXT_MAX = 300
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]+/g
const STATUS_CREATED = 201
const STATUS_DUPLICATE = 200
const STEP_UP_CODES = new Set(['step_up_required', 'step_up_unavailable'])

const VERDICT_MEANING: Readonly<Record<string, string>> = {
  pass: 'no automated check found a problem',
  review_required: 'the reviewer looks closely at the warnings below',
  blocked: 'an error below must be fixed; this version cannot be approved',
}

function isJson(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** `value` as one printable line: control characters become spaces. */
export function plain(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value) ?? String(value)
  return text.replace(CONTROL_CHARACTERS, ' ').trim()
}

function parseBody(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

function checkLines(report: unknown): string[] {
  if (!isJson(report) || !isJson(report.checks)) return []
  return Object.entries(report.checks).flatMap(([name, check]) => {
    if (!isJson(check)) return []
    const reason = typeof check.reason === 'string' && check.reason !== '' ? ` - ${plain(check.reason)}` : ''
    const problems = Array.isArray(check.problems) ? check.problems.map((problem) => `    ${plain(problem)}`) : []
    return [`  ${plain(name)}: ${plain(check.level ?? 'unknown')}${reason}`, ...problems]
  })
}

function acceptedLines(item: Json, duplicate: boolean): string[] {
  const name = `${plain(item.themeId)} ${plain(item.version)}`
  const status = plain(item.status)
  const report: Json = isJson(item.scanReport) ? item.scanReport : {}
  const verdict = plain(item.scanVerdict ?? report.verdict ?? 'unknown')
  const meaning = VERDICT_MEANING[verdict]
  return [
    duplicate
      ? `These exact bytes were submitted already: ${name}, status ${status}.`
      : `Submitted ${name}: ${status === 'pending' ? 'pending review' : `status ${status}`}.`,
    'A person reviews every version before it is listed in the Marketplace.',
    `Automated review: ${verdict}${meaning === undefined ? '' : ` (${meaning})`}.`,
    ...checkLines(report),
    `Digest ${plain(item.digest)}`,
  ]
}

function errorLine(error: unknown): string {
  if (!isJson(error)) return `  ${plain(error)}`
  const where = typeof error.path === 'string' && error.path !== '' ? ` ${plain(error.path)}` : ''
  return `  ${plain(error.code ?? 'ERROR')}${where}: ${plain(error.message ?? '')}`
}

function validationLine(item: unknown): string {
  if (!isJson(item)) return `  ${plain(item)}`
  const where = Array.isArray(item.loc) ? item.loc.map((part) => plain(part)).join('.') : 'request'
  return `  ${where}: ${plain(item.msg ?? '')}`
}

function rawText(text: string): string {
  const line = plain(text)
  if (line === '') return '(The answer had no body.)'
  const cut = line.length > RAW_TEXT_MAX ? `${line.slice(0, RAW_TEXT_MAX)}...` : line
  return `(The answer was not JSON.) ${cut}`
}

/** Every sentence the server gave for a refusal, in its own words. */
function serverSentences(body: unknown, text: string): string[] {
  if (!isJson(body)) return [body === undefined ? rawText(text) : plain(body)]
  const detail = body.detail
  if (typeof detail === 'string') return [plain(detail)]
  if (Array.isArray(detail)) return ['The request was not in the form the server expects:', ...detail.map(validationLine)]
  if (!isJson(detail)) return [plain(body)]
  const head = typeof detail.message === 'string' ? plain(detail.message) : plain(detail)
  const errors = Array.isArray(detail.errors) ? detail.errors.map(errorLine) : []
  return [head, ...errors]
}

function headline(answer: ServerAnswer): string {
  const status = `${answer.status}${answer.statusText === '' ? '' : ` ${plain(answer.statusText)}`}`
  if (answer.status >= 500) return `The server could not take the submission (${status}):`
  if (answer.status >= 200 && answer.status < 300) return `The server answered ${status}, but not with a submission:`
  return `The server refused the submission (${status}):`
}

function stepUpMinutes(body: Json): string {
  const clerk: Json = isJson(body.clerk_error) ? body.clerk_error : {}
  const metadata: Json = isJson(clerk.metadata) ? clerk.metadata : {}
  const reverification: Json = isJson(metadata.reverification) ? metadata.reverification : {}
  const minutes = reverification.afterMinutes
  return typeof minutes === 'number' ? `the last ${minutes} minutes` : 'the last few minutes'
}

function stepUpCode(body: Json): string | null {
  const detail: Json = isJson(body.detail) ? body.detail : {}
  const code = typeof body.code === 'string' ? body.code : detail.code
  return typeof code === 'string' && STEP_UP_CODES.has(code) ? code : null
}

/** The CLI's own notes after the server's sentences, each marked as a note. */
function notes(answer: ServerAnswer, body: unknown, tokenSent: boolean): string[] {
  const json: Json = isJson(body) ? body : {}
  if (answer.status === 401) {
    return tokenSent
      ? [
          `Note: the server did not accept ${ENV_TOKEN}. It reads a bearer token as a Clerk session token, which expires quickly.`,
          `The local edition needs no token: leave ${ENV_TOKEN} unset there.`,
        ]
      : [`Note: ${ENV_TOKEN} is not set, and this server needs a signed-in person.`]
  }
  if (answer.status === 403 && stepUpCode(json) !== null) {
    return [
      `Note: submitting needs step-up: the token must come from a person who signed in to Automatos within ${stepUpMinutes(json)}.`,
      'An API key cannot confirm that.',
    ]
  }
  const retryAfter = answer.headers.get('retry-after')
  if (answer.status === 503 && retryAfter !== null) return [`Try again in ${plain(retryAfter)} seconds.`]
  return []
}

function redirectLines(answer: ServerAnswer): string[] {
  const location = answer.headers.get('location')
  return [
    `The server answered with a redirect (${answer.status})${location === null ? '' : ` to ${plain(location)}`}.`,
    `Nothing was submitted: set ${ENV_URL} to the API's own address.`,
  ]
}

/** The lines to print for the server's answer, and whether it took the submission. */
export function describeAnswer(answer: ServerAnswer, tokenSent: boolean): DescribedAnswer {
  const body = parseBody(answer.text)
  const taken = answer.status === STATUS_CREATED || answer.status === STATUS_DUPLICATE
  if (taken && isJson(body) && isJson(body.package)) {
    return { ok: true, lines: acceptedLines(body.package, body.duplicate === true) }
  }
  if (answer.status >= 300 && answer.status < 400) return { ok: false, lines: redirectLines(answer) }
  return { ok: false, lines: [headline(answer), ...serverSentences(body, answer.text), ...notes(answer, body, tokenSent)] }
}

/** The lines to print when no answer came back (no connection, or the time ran out). */
export function describeNoAnswer(error: unknown, origin: string, timeoutSeconds: number): string[] {
  const name = error instanceof Error ? error.name : ''
  if (name === 'TimeoutError' || name === 'AbortError') {
    return [`No answer from ${origin} within ${timeoutSeconds} seconds; the submission may still have been taken.`]
  }
  const message = error instanceof Error ? error.message : String(error)
  const cause: Json = error instanceof Error && isJson(error.cause) ? error.cause : {}
  const reason = typeof cause.code === 'string' ? ` (${plain(cause.code)})` : ''
  return [`No answer from ${origin}: ${plain(message)}${reason}.`, `Check ${ENV_URL} and try again.`]
}
