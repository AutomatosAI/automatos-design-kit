/**
 * Where `submit` sends the package and as whom, read from the environment only (never a file).
 * `install` reads the same credentials (readCredentials) and checks its own address with the same
 * rules (parseUrl, isLoopback, routeUrl).
 *
 * - AUTOMATOS_API_URL: the Automatos API's address (`https://...`; plain `http://` only to this
 *   machine, or when no token is sent). A path prefix is kept; no user, password, query or fragment.
 * - AUTOMATOS_API_TOKEN: optional. Sent as `Authorization: Bearer <token>`, which core's
 *   `core/auth/hybrid.py` reads as a Clerk session token. The local edition needs none.
 * - AUTOMATOS_WORKSPACE_ID: optional. Sent as `X-Workspace-ID`; without it core picks the
 *   person's own workspace.
 *
 * No message here ever repeats the token or the URL's value, since either may hold a secret.
 */

export const ENV_URL = 'AUTOMATOS_API_URL'
export const ENV_TOKEN = 'AUTOMATOS_API_TOKEN'
export const ENV_WORKSPACE = 'AUTOMATOS_WORKSPACE_ID'

/** core orchestrator/services/themes/submissions.py THEME_SUBMIT_ROUTE. */
export const SUBMIT_ROUTE = '/api/marketplace/themes/submit'

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])
/** Visible ASCII only: anything else can't travel in a header (and fetch's error would quote it). */
const TOKEN_PATTERN = /^[\x21-\x7e]+$/
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type Environment = Readonly<Record<string, string | undefined>>

/** As whom a request is sent: the token and the workspace, each optional. */
export interface Credentials {
  readonly token: string | null
  readonly workspaceId: string | null
}

export interface SubmitTarget extends Credentials {
  /** The submit route's full URL. */
  readonly endpoint: string
  /** scheme://host[:port] of the API, the only part of the URL ever printed. */
  readonly origin: string
}

export type CredentialsResult =
  | { readonly ok: true; readonly credentials: Credentials }
  | { readonly ok: false; readonly message: string }

export type TargetResult =
  | { readonly ok: true; readonly target: SubmitTarget }
  | { readonly ok: false; readonly message: string }

function refuse(message: string): TargetResult {
  return { ok: false, message }
}

function present(value: string | undefined): string | null {
  const trimmed = (value ?? '').trim()
  return trimmed === '' ? null : trimmed
}

/** `raw` as a URL, or null when it isn't one. */
export function parseUrl(raw: string): URL | null {
  try {
    return new URL(raw)
  } catch {
    return null
  }
}

/** True when `url` names this machine (localhost, 127.0.0.1 or [::1]), where plain http:// stays on it. */
export function isLoopback(url: URL): boolean {
  return LOOPBACK_HOSTS.has(url.hostname)
}

/** True when `value` is a UUID, the form of a workspace, install or package id. */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

/** Why the API address can't be used, or null when it can. */
function urlProblem(url: URL, sendsToken: boolean): string | null {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return `${ENV_URL} must be an https:// address.`
  if (url.username !== '' || url.password !== '') {
    return `${ENV_URL} must not carry a user or password; put the token in ${ENV_TOKEN}.`
  }
  if (url.search !== '' || url.hash !== '') return `${ENV_URL} must be the API's address, with no query or fragment.`
  if (url.protocol === 'http:' && sendsToken && !isLoopback(url)) {
    return `${ENV_URL} is plain http:// to another machine, which would send ${ENV_TOKEN} unencrypted; use https://.`
  }
  return null
}

function tokenProblem(token: string | null): string | null {
  if (token === null || TOKEN_PATTERN.test(token)) return null
  return `${ENV_TOKEN} holds spaces or characters a request header can't carry.`
}

function workspaceProblem(workspaceId: string | null): string | null {
  if (workspaceId === null || isUuid(workspaceId)) return null
  return `${ENV_WORKSPACE} must be a workspace id (a UUID).`
}

/** `route` under the address `url`, keeping any path prefix (`route` '' gives the address itself). */
export function routeUrl(url: URL, route: string): string {
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}${route}`
}

/** The submit route's URL under the API address, keeping any path prefix. */
export function submitEndpoint(url: URL): string {
  return routeUrl(url, SUBMIT_ROUTE)
}

/** The token and workspace from `env`; a refusal names the variable to fix and never repeats its value. */
export function readCredentials(env: Environment): CredentialsResult {
  const token = present(env[ENV_TOKEN])
  const workspaceId = present(env[ENV_WORKSPACE])
  const problem = tokenProblem(token) ?? workspaceProblem(workspaceId)
  if (problem !== null) return { ok: false, message: problem }
  return { ok: true, credentials: { token, workspaceId } }
}

/** Reads the target from `env`; a refusal names the variable to fix and never repeats its value. */
export function readTarget(env: Environment): TargetResult {
  const raw = present(env[ENV_URL])
  if (raw === null) return refuse(`${ENV_URL} is not set: set it to the Automatos API's address (https://...).`)
  const url = parseUrl(raw)
  if (url === null) return refuse(`${ENV_URL} is not a URL: set it to the Automatos API's address (https://...).`)
  const token = present(env[ENV_TOKEN])
  const workspaceId = present(env[ENV_WORKSPACE])
  const problem = tokenProblem(token) ?? urlProblem(url, token !== null) ?? workspaceProblem(workspaceId)
  if (problem !== null) return refuse(problem)
  return { ok: true, target: { endpoint: submitEndpoint(url), origin: url.origin, token, workspaceId } }
}

/** The request's headers: JSON answers, the token as a bearer credential, the workspace when named. */
export function requestHeaders(target: Credentials): Record<string, string> {
  return {
    Accept: 'application/json',
    ...(target.token === null ? {} : { Authorization: `Bearer ${target.token}` }),
    ...(target.workspaceId === null ? {} : { 'X-Workspace-ID': target.workspaceId }),
  }
}
