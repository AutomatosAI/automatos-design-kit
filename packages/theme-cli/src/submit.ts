/**
 * `automatos-theme submit <file.autotheme>`: sends a package to the Automatos Marketplace for review
 * and prints the server's answer.
 *
 * The route is core's `POST /api/marketplace/themes/submit` (orchestrator/api/marketplace_themes_submit.py):
 * a multipart form whose `file` field is the package. The server checks the package as a private
 * upload is checked, runs the automated review stage inline and stores the version as pending; a
 * person reviews every version before it is listed. Its gates, in order: workspace membership
 * (`members:read`), the Marketplace switch, then step-up (core/auth/step_up.py). Step-up passes in
 * the local edition; in the SaaS edition it passes only a Clerk session token whose sign-in is
 * fresher than the server's STEP_UP_MAX_AGE_MINUTES, and refuses every key. This command sends what
 * the environment gives (submit-target.ts) and prints the server's answer as it is.
 *
 * The token is never printed: every line this command writes passes through `redacting`.
 * Before sending, the package's zip entries are read: a package with no source/ can't pass the
 * Marketplace review (its reproducible-build check rebuilds dist/ from source/), so it is refused
 * here with one line and nothing is sent (C-06p3). pack writes source/ from the theme folder's src/.
 *
 * Exit code 0 when the server took the submission, 1 when it refused it or gave no answer, 2 for a
 * usage or environment problem or a package refused before sending (nothing was sent).
 */
import { readFileSync, statSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { redacting, type Output } from './output.ts'
import { SOURCE_DIR, SOURCE_FOLDER } from './source.ts'
import { describeAnswer, describeNoAnswer, plain, type ServerAnswer } from './submit-answer.ts'
import { ENV_TOKEN, readTarget, requestHeaders, type Environment, type SubmitTarget } from './submit-target.ts'
import { readZip } from './zip.ts'

export const SUBMIT_USAGE = 'usage: automatos-theme submit <file.autotheme>'
/** The review stage runs before the server answers, so the wait is long. */
export const SUBMIT_TIMEOUT_SECONDS = 300
const MS_PER_SECOND = 1000
/** core marketplace_themes_submit.py `submit_theme(file: UploadFile = File(...))`. */
export const FORM_FIELD = 'file'
const PACKAGE_TYPE = 'application/zip'

const EXIT_TAKEN = 0
const EXIT_REFUSED = 1
const EXIT_USAGE = 2

export interface SubmitDeps {
  readonly env: Environment
  readonly fetch: typeof fetch
  readonly cwd: string
}

/** The package path from `submit <file>`, or null when the arguments don't make one. */
function parseSubmit(argv: readonly string[], cwd: string): string | null {
  try {
    const { positionals } = parseArgs({ args: [...argv], allowPositionals: true, options: {} })
    const [command, file, ...extra] = positionals
    if (command !== 'submit' || file === undefined || extra.length > 0) return null
    return resolve(cwd, file)
  } catch {
    return null
  }
}

/** The package's bytes, or why they can't be read. */
function readPackage(path: string): Buffer | string {
  try {
    if (!statSync(path).isFile()) return `${path} is not a file.`
    return readFileSync(path)
  } catch {
    return `${path} can't be read.`
  }
}

const SOURCE_PREFIX = `${SOURCE_FOLDER}/`

/** True when a member path is a file under source/ (a bare `source/` folder entry carries nothing). */
function isSourceFile(path: string): boolean {
  return path.startsWith(SOURCE_PREFIX) && path.length > SOURCE_PREFIX.length
}

type Members = { readonly ok: true; readonly paths: readonly string[] } | { readonly ok: false; readonly reason: string }

/** The package's member paths, or why its zip can't be read. */
function memberPaths(bytes: Buffer): Members {
  try {
    return { ok: true, paths: readZip(bytes).map((entry) => entry.path) }
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  }
}

/** Why the package can't pass review and so is not sent, or null when it may be sent; always one line. */
export function sourceProblem(fileName: string, bytes: Buffer): string | null {
  const name = plain(fileName)
  const members = memberPaths(bytes)
  if (!members.ok) return `${name} can't be read as a package zip (${plain(members.reason)}): nothing was sent.`
  if (members.paths.some(isSourceFile)) return null
  return (
    `${name} has no ${SOURCE_PREFIX}, so the Marketplace review can't rebuild it: nothing was sent. `
    + `Pack it with automatos-theme pack from a theme folder with a ${SOURCE_DIR}/ and submit that package.`
  )
}

async function postPackage(target: SubmitTarget, path: string, bytes: Buffer, fetchImpl: typeof fetch): Promise<ServerAnswer> {
  const form = new FormData()
  // A copy as a plain Uint8Array, which every Blob typing accepts.
  form.append(FORM_FIELD, new Blob([new Uint8Array(bytes)], { type: PACKAGE_TYPE }), basename(path))
  const response = await fetchImpl(target.endpoint, {
    method: 'POST',
    headers: requestHeaders(target),
    body: form,
    // A redirect is reported, never followed, so the token goes to the address named and nowhere else.
    redirect: 'manual',
    signal: AbortSignal.timeout(SUBMIT_TIMEOUT_SECONDS * MS_PER_SECOND),
  })
  const text = await response.text()
  return { status: response.status, statusText: response.statusText, headers: response.headers, text }
}

/** Sends the package and prints the answer through `output` (already redacting the token). */
async function send(target: SubmitTarget, path: string, bytes: Buffer, output: Output, fetchImpl: typeof fetch): Promise<number> {
  output.out(`Submitting ${basename(path)} (${bytes.length} bytes) to ${target.origin}`)
  if (target.token === null) {
    output.err(`${ENV_TOKEN} is not set: sending with no credential, which only the local edition accepts.`)
  }
  let answer: ServerAnswer
  try {
    answer = await postPackage(target, path, bytes, fetchImpl)
  } catch (error) {
    describeNoAnswer(error, target.origin, SUBMIT_TIMEOUT_SECONDS).forEach((line) => output.err(line))
    return EXIT_REFUSED
  }
  const described = describeAnswer(answer, target.token !== null)
  described.lines.forEach((line) => (described.ok ? output.out(line) : output.err(line)))
  return described.ok ? EXIT_TAKEN : EXIT_REFUSED
}

/** Runs `submit`; returns the exit code. */
export async function submitCommand(argv: readonly string[], output: Output, deps: SubmitDeps): Promise<number> {
  const path = parseSubmit(argv, deps.cwd)
  if (path === null) {
    output.err(SUBMIT_USAGE)
    return EXIT_USAGE
  }
  const read = readTarget(deps.env)
  if (!read.ok) {
    output.err(read.message)
    return EXIT_USAGE
  }
  const safe = redacting(output, read.target.token)
  const bytes = readPackage(path)
  if (typeof bytes === 'string') {
    safe.err(bytes)
    return EXIT_USAGE
  }
  const problem = sourceProblem(basename(path), bytes)
  if (problem !== null) {
    safe.err(problem)
    return EXIT_USAGE
  }
  return send(read.target, path, bytes, safe, deps.fetch)
}
