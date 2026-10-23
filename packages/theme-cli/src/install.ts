/**
 * `automatos-theme install <file.autotheme> --to <url> [--choose]`: installs a package privately in a
 * workspace of the local edition and opts the person in to it, as Settings, Appearance, Themes does
 * by hand; with `--choose` it also becomes their theme there.
 *
 * `--to` is the web app's URL or the API's; host-resolve.ts finds the API base from it. Core's routes
 * (orchestrator/api/themes_import.py and themes_install.py), each step only once the one before it
 * succeeded:
 * 1. `POST /api/themes/import`, the package as the multipart field `file` (gates: workspace:manage,
 *    who may install, the private-upload switch and setting, step-up): 201 with the package and its
 *    install, 200 when these exact bytes are in the workspace already;
 * 2. `POST /api/themes/installs/{installId}/opt-in` `{packageId}` (a member, step-up): 200;
 * 3. with `--choose` only, `PUT /api/themes/choice` `{choice: installId}` (a member): 200.
 * Step-up passes in the local edition.
 *
 * As whom comes from the environment, as for `submit` (submit-target.ts): AUTOMATOS_API_TOKEN
 * (optional) and AUTOMATOS_WORKSPACE_ID (optional). The token goes only to the API base, never to
 * host-resolve's questions, and is never printed: every line passes through `redacting`.
 *
 * Exit code 0 when the package is installed and opted in to (and chosen, with --choose); 1 when the
 * server refused a step, gave no answer, or stored the package without installing it; 2 for a usage
 * or environment problem, a package file that can't be read, or a --to that names no Automatos API
 * (nothing was sent).
 */
import { readFileSync, statSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import type { CommandDeps } from './cli-main.ts'
import { parseTo, resolveHost, shownAddress } from './host-resolve.ts'
import { describeChoice, describeImport, describeNoAnswer, describeOptIn, type Described, type Imported } from './install-answer.ts'
import { redacting, type Output } from './output.ts'
import type { ServerAnswer } from './submit-answer.ts'
import { ENV_TOKEN, readCredentials, requestHeaders, routeUrl, type Credentials } from './submit-target.ts'

export const INSTALL_USAGE = 'usage: automatos-theme install <file.autotheme> --to <url> [--choose]'
/** core orchestrator/services/themes/package.py THEME_IMPORT_ROUTE. */
export const IMPORT_ROUTE = '/api/themes/import'
/** core themes_import.py `import_theme(file: UploadFile = File(...))`. */
export const IMPORT_FIELD = 'file'
/** core themes_install.py `put_theme_choice`. */
export const CHOICE_ROUTE = '/api/themes/choice'
/** The review stage runs before the import answers, so its wait is long. */
export const IMPORT_TIMEOUT_SECONDS = 300
export const STEP_TIMEOUT_SECONDS = 60
export const CHOOSE_HINT = 'To see it, choose it in Settings, Appearance, Themes, or run install again with --choose.'
const PACKAGE_TYPE = 'application/zip'
const MS_PER_SECOND = 1000

type Json = Readonly<Record<string, unknown>>

const EXIT_INSTALLED = 0
const EXIT_REFUSED = 1
const EXIT_USAGE = 2

/** core themes_install.py `opt_in_to_theme`: the opt-in route of one install. */
export function optInRoute(installId: string): string {
  return `/api/themes/installs/${encodeURIComponent(installId)}/opt-in`
}

interface InstallArgs {
  readonly path: string
  readonly to: string
  readonly choose: boolean
}

/** What install checked before sending: the arguments, the credentials, the address and the package. */
interface Prepared {
  readonly args: InstallArgs
  readonly credentials: Credentials
  readonly to: URL
  readonly bytes: Buffer
}

/** Where the requests go, as whom, and through which fetch. */
interface Api {
  readonly base: URL
  readonly credentials: Credentials
  readonly fetch: typeof fetch
}

/** The arguments of `install <file> --to <url> [--choose]`, or null when they don't make one. */
function parseInstall(argv: readonly string[], cwd: string): InstallArgs | null {
  try {
    const { positionals, values } = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: { to: { type: 'string' }, choose: { type: 'boolean' } },
    })
    const [command, file, ...extra] = positionals
    if (command !== 'install' || file === undefined || extra.length > 0 || values.to === undefined) return null
    return { path: resolve(cwd, file), to: values.to, choose: values.choose === true }
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

function packageForm(path: string, bytes: Buffer): FormData {
  const form = new FormData()
  // A copy as a plain Uint8Array, which every Blob typing accepts.
  form.append(IMPORT_FIELD, new Blob([new Uint8Array(bytes)], { type: PACKAGE_TYPE }), basename(path))
  return form
}

interface Step<T> {
  readonly name: string
  readonly method: 'POST' | 'PUT'
  readonly route: string
  readonly body: FormData | Json
  readonly timeoutSeconds: number
  /** The step's outcome from the answer; `tokenSent` says whether a token went with it. */
  readonly describe: (answer: ServerAnswer, tokenSent: boolean) => Described<T>
}

/** Sends one step's request to the API base and reads the whole answer. */
async function call<T>(api: Api, step: Step<T>): Promise<ServerAnswer> {
  const form = step.body instanceof FormData
  const response = await api.fetch(routeUrl(api.base, step.route), {
    method: step.method,
    headers: { ...requestHeaders(api.credentials), ...(form ? {} : { 'Content-Type': 'application/json' }) },
    body: step.body instanceof FormData ? step.body : JSON.stringify(step.body),
    // A redirect is reported, never followed, so the token goes to the API base and nowhere else.
    redirect: 'manual',
    signal: AbortSignal.timeout(step.timeoutSeconds * MS_PER_SECOND),
  })
  const text = await response.text()
  return { status: response.status, statusText: response.statusText, headers: response.headers, text }
}

/** Runs one step and prints what came of it; its value when it succeeded, else null. */
async function runStep<T>(api: Api, output: Output, step: Step<T>): Promise<T | null> {
  let answer: ServerAnswer
  try {
    answer = await call(api, step)
  } catch (error) {
    describeNoAnswer(error, step.name, api.base.origin, step.timeoutSeconds).forEach((line) => output.err(line))
    return null
  }
  const described = step.describe(answer, api.credentials.token !== null)
  described.lines.forEach((line) => (described.ok ? output.out(line) : output.err(line)))
  return described.ok ? described.value : null
}

function importStep(path: string, bytes: Buffer): Step<Imported> {
  return {
    name: 'import', method: 'POST', route: IMPORT_ROUTE, body: packageForm(path, bytes),
    timeoutSeconds: IMPORT_TIMEOUT_SECONDS, describe: describeImport,
  }
}

function optInStep(imported: Imported): Step<true> {
  return {
    name: 'opt-in', method: 'POST', route: optInRoute(imported.installId), body: { packageId: imported.packageId },
    timeoutSeconds: STEP_TIMEOUT_SECONDS, describe: (answer, tokenSent) => describeOptIn(answer, imported, tokenSent),
  }
}

function choiceStep(imported: Imported): Step<true> {
  return {
    name: 'choice', method: 'PUT', route: CHOICE_ROUTE, body: { choice: imported.installId },
    timeoutSeconds: STEP_TIMEOUT_SECONDS, describe: (answer, tokenSent) => describeChoice(answer, imported, tokenSent),
  }
}

/** The three steps against the resolved API; returns the exit code. */
async function installAt(api: Api, args: InstallArgs, bytes: Buffer, output: Output): Promise<number> {
  output.out(`Installing ${basename(args.path)} (${bytes.length} bytes) at ${shownAddress(api.base)}`)
  const imported = await runStep(api, output, importStep(args.path, bytes))
  if (imported === null) return EXIT_REFUSED
  if ((await runStep(api, output, optInStep(imported))) === null) return EXIT_REFUSED
  if (!args.choose) {
    output.out(CHOOSE_HINT)
    return EXIT_INSTALLED
  }
  return (await runStep(api, output, choiceStep(imported))) === null ? EXIT_REFUSED : EXIT_INSTALLED
}

/** Everything install checks before it sends anything, or the one line that says what is wrong. */
function prepare(argv: readonly string[], deps: CommandDeps): Prepared | string {
  const args = parseInstall(argv, deps.cwd)
  if (args === null) return INSTALL_USAGE
  const read = readCredentials(deps.env)
  if (!read.ok) return read.message
  const to = parseTo(args.to)
  if (!to.ok) return to.message
  const bytes = readPackage(args.path)
  if (typeof bytes === 'string') return bytes
  return { args, credentials: read.credentials, to: to.url, bytes }
}

/** Runs `install`; returns the exit code. Nothing is sent until the arguments, file and address check out. */
export async function installCommand(argv: readonly string[], output: Output, deps: CommandDeps): Promise<number> {
  // Masked from the first line on, whatever the token holds.
  const safe = redacting(output, deps.env[ENV_TOKEN]?.trim() || null)
  const prepared = prepare(argv, deps)
  if (typeof prepared === 'string') {
    safe.err(prepared)
    return EXIT_USAGE
  }
  const host = await resolveHost(prepared.to, deps.fetch)
  if (!host.ok) {
    safe.err(host.message)
    return EXIT_USAGE
  }
  if (host.hostFile !== null) safe.out(`${host.hostFile} names the API: ${shownAddress(host.base)}`)
  const api: Api = { base: host.base, credentials: prepared.credentials, fetch: deps.fetch }
  return installAt(api, prepared.args, prepared.bytes, safe)
}
