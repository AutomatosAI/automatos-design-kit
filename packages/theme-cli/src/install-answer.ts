/**
 * The server's answers to `install`'s steps, as lines for the person who ran it.
 *
 * Shapes read from core (orchestrator/api/themes_import.py, orchestrator/api/themes_install.py and
 * their gates):
 * - import, 201 (new) or 200 (these exact bytes are in this workspace already): `{package: {id,
 *   themeId, version, name, digest, ownerType, reviewed, scanVerdict, scanReport}, install: {id,
 *   themeId, packageId, pendingPackageId, isDefault}, status, duplicate}`, `status` being
 *   `installed`, `update_available` (a newer version, offered as the install's update) or `stored`
 *   (kept, while the install runs another version);
 * - update, 200: the install as `GET /api/themes/installed` lists it, `{installId, themeId, packageId,
 *   version, previousPackageId, ...}`, `packageId` being the package it runs now (services/themes/updates.py);
 * - opt-in, 200: `{installId, optIn: {required, wording, packageId}}`;
 * - choice, 200: the theme this member now sees, `{choice, source, theme, revoked?}`;
 * - a refusal: `{detail: "<sentence>"}` (403 when private uploads are off or the publisher is
 *   reserved, 404, 409, 429, 503, and the body limit's 413); `{detail: {message, errors: [{code,
 *   path, message}]}}` for a refused package (400, 413); `{code: "step_up_required", detail,
 *   clerk_error}` or `{detail: {code: "step_up_unavailable", message}}` from step-up; a list of
 *   `{loc, msg}` for a request the server could not read (422).
 *
 * Every text the server sent is printed through `plain`, so an answer can't move the cursor or
 * recolour the terminal.
 */
import { plain, type ServerAnswer } from './submit-answer.ts'
import { ENV_TOKEN, isUuid } from './submit-target.ts'

/** A step's outcome: what the next step needs when it succeeded, and the lines to print either way. */
export type Described<T> =
  | { readonly ok: true; readonly value: T; readonly lines: readonly string[] }
  | { readonly ok: false; readonly lines: readonly string[] }

/** What the update, the opt-in and the choice need from the import. */
export interface Imported {
  readonly installId: string
  readonly packageId: string
  readonly themeId: string
  readonly version: string
  /** The install runs another version of the theme, so the update step moves it to this package first. */
  readonly update: boolean
}

type Json = Record<string, unknown>

const STATUS_CREATED = 201
const STATUS_OK = 200
const STATUS_INSTALLED = 'installed'
/** How much of an answer that isn't JSON (an HTML error page, say) is printed. */
const RAW_TEXT_MAX = 300
const STEP_UP_CODES = new Set(['step_up_required', 'step_up_unavailable'])
const NOTHING_FOLLOWED = 'Nothing was opted in to or chosen.'

/**
 * The import outcomes where the install runs another version (core themes_import.py
 * `_install_status`): install asks the server to move the install to this package before it opts in.
 */
const MOVES_INSTALL: ReadonlyMap<string, string> = new Map([
  ['update_available', 'It is an update to the version installed now: moving the install to it.'],
  ['stored', 'Another version of this theme is installed now: moving the install to it.'],
])
/** After the update: where the version the install ran before is kept. */
export const ROLLBACK_HINT = 'The version it ran before is kept: roll back to it in Settings, Appearance, Themes.'

function isJson(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseBody(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

function statusOf(answer: ServerAnswer): string {
  return `${answer.status}${answer.statusText === '' ? '' : ` ${plain(answer.statusText)}`}`
}

function headline(step: string, answer: ServerAnswer): string {
  if (answer.status >= 500) return `The server could not take the ${step} (${statusOf(answer)}):`
  if (answer.status >= 200 && answer.status < 300) {
    return `The server answered the ${step} with ${statusOf(answer)}, but not in the form this command reads:`
  }
  return `The server refused the ${step} (${statusOf(answer)}):`
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

/** Every sentence the server gave, in its own words, each error with its code. */
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

/** The refusal's own code (`code`, or `detail.code`), or null when it has none. */
function refusalCode(body: unknown): string | null {
  if (!isJson(body)) return null
  const detail: Json = isJson(body.detail) ? body.detail : {}
  const code = typeof body.code === 'string' ? body.code : detail.code
  return typeof code === 'string' && code !== '' ? plain(code) : null
}

/** The command's own notes after the server's sentences, each marked as a note. */
function notes(answer: ServerAnswer, code: string | null, tokenSent: boolean): string[] {
  if (answer.status === 401) {
    return tokenSent
      ? [`Note: the server did not accept ${ENV_TOKEN}. The local edition needs no token: leave it unset there.`]
      : [`Note: ${ENV_TOKEN} is not set, and this server needs a signed-in person; install targets the local edition.`]
  }
  if (answer.status === 403 && code !== null && STEP_UP_CODES.has(code)) {
    return ['Note: this step needs step-up, a recent sign-in to Automatos. The local edition passes it; an API key cannot.']
  }
  const retryAfter = answer.headers.get('retry-after')
  if (answer.status === 503 && retryAfter !== null) return [`Try again in ${plain(retryAfter)} seconds.`]
  return []
}

function redirectLines(step: string, answer: ServerAnswer): string[] {
  const location = answer.headers.get('location')
  return [
    `The server answered the ${step} with a redirect (${answer.status})${location === null ? '' : ` to ${plain(location)}`}.`,
    'It was not followed: --to must reach the API itself, or the web app whose host file names it.',
  ]
}

/** The lines for an answer that is not the step's success: the status, the server's words and code, notes. */
export function refusalLines(step: string, answer: ServerAnswer, tokenSent: boolean): string[] {
  if (answer.status >= 300 && answer.status < 400) return redirectLines(step, answer)
  const body = parseBody(answer.text)
  const code = refusalCode(body)
  return [
    headline(step, answer),
    ...serverSentences(body, answer.text),
    ...(code === null ? [] : [`Code: ${code}`]),
    ...notes(answer, code, tokenSent),
  ]
}

function themeName(item: Json): string {
  return `${plain(item.themeId)} ${plain(item.version)}`
}

function importedLines(item: Json, duplicate: boolean): string[] {
  return [
    duplicate
      ? `These exact bytes were in this workspace already: ${themeName(item)}.`
      : `Imported ${themeName(item)} into this workspace: private, not reviewed.`,
    `Automated review: ${plain(item.scanVerdict ?? 'unknown')}.`,
    `Digest ${plain(item.digest)}`,
  ]
}

/**
 * The ids the next steps send, or null when the answer names no install: one that runs this package,
 * or, with `update`, one of the theme that the update step moves to it.
 */
function importedOf(item: Json, install: unknown, update: boolean): Imported | null {
  if (!isJson(install)) return null
  const installId = install.id
  const packageId = item.id
  if (!isUuid(installId) || !isUuid(packageId) || (!update && install.packageId !== packageId)) return null
  return { installId, packageId, themeId: plain(item.themeId), version: plain(item.version), update }
}

/** The import's answer: the install to opt in to, or why install stops here. */
export function describeImport(answer: ServerAnswer, tokenSent: boolean): Described<Imported> {
  const body = parseBody(answer.text)
  const taken = answer.status === STATUS_CREATED || answer.status === STATUS_OK
  if (!taken || !isJson(body) || !isJson(body.package)) return { ok: false, lines: refusalLines('import', answer, tokenSent) }
  const lines = importedLines(body.package, body.duplicate === true)
  const status = plain(body.status)
  const moving = MOVES_INSTALL.get(status)
  if (status !== STATUS_INSTALLED && moving === undefined) {
    return { ok: false, lines: [...lines, `The server stored it with the status ${status}, not installed.`, NOTHING_FOLLOWED] }
  }
  const imported = importedOf(body.package, body.install, moving !== undefined)
  if (imported === null) {
    return { ok: false, lines: [...lines, 'The answer named no install of this package.', NOTHING_FOLLOWED] }
  }
  return { ok: true, value: imported, lines: moving === undefined ? lines : [...lines, moving] }
}

function importedName(imported: Imported): string {
  return `${imported.themeId} ${imported.version}`
}

/** The update's answer: done when the install runs the imported package now. */
export function describeUpdate(answer: ServerAnswer, imported: Imported, tokenSent: boolean): Described<true> {
  const body = parseBody(answer.text)
  const moved = answer.status === STATUS_OK && isJson(body) && body.packageId === imported.packageId
  if (!moved) return { ok: false, lines: refusalLines('update', answer, tokenSent) }
  return { ok: true, value: true, lines: [`Moved the install to ${importedName(imported)}. ${ROLLBACK_HINT}`] }
}

/** The opt-in's answer: done once the server says no opt-in is required any more. */
export function describeOptIn(answer: ServerAnswer, imported: Imported, tokenSent: boolean): Described<true> {
  const body = parseBody(answer.text)
  const optIn = answer.status === STATUS_OK && isJson(body) && isJson(body.optIn) ? body.optIn : null
  if (optIn === null || optIn.required !== false) return { ok: false, lines: refusalLines('opt-in', answer, tokenSent) }
  const wording = typeof optIn.wording === 'string' && optIn.wording !== '' ? ` ${plain(optIn.wording)}` : ''
  return { ok: true, value: true, lines: [`Opted in to ${importedName(imported)}.${wording}`] }
}

/** The choice's answer: done when the theme this member now sees is the install. */
export function describeChoice(answer: ServerAnswer, imported: Imported, tokenSent: boolean): Described<true> {
  const body = parseBody(answer.text)
  if (answer.status !== STATUS_OK || !isJson(body)) return { ok: false, lines: refusalLines('choice', answer, tokenSent) }
  if (body.choice === imported.installId) {
    return { ok: true, value: true, lines: [`Chosen: ${importedName(imported)} is your theme in this workspace now.`] }
  }
  const withdrawn = isJson(body.revoked) ? ' This version was withdrawn.' : ''
  return {
    ok: false,
    lines: [`The server kept the choice ${plain(body.choice)} (${plain(body.source)}), not ${importedName(imported)}.${withdrawn}`],
  }
}

/** The lines to print when a step got no answer (no connection, or the time ran out). */
export function describeNoAnswer(error: unknown, step: string, origin: string, timeoutSeconds: number): string[] {
  const name = error instanceof Error ? error.name : ''
  if (name === 'TimeoutError' || name === 'AbortError') {
    return [`No answer from ${origin} to the ${step} within ${timeoutSeconds} seconds; it may still have been taken.`]
  }
  const message = error instanceof Error ? error.message : String(error)
  const cause: Json = error instanceof Error && isJson(error.cause) ? error.cause : {}
  const reason = typeof cause.code === 'string' ? ` (${plain(cause.code)})` : ''
  return [`No answer from ${origin} to the ${step}: ${plain(message)}${reason}.`]
}
