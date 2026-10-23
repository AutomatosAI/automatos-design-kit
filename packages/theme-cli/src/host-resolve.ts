/**
 * Where `install --to <url>` finds the Automatos API. `--to` takes either address a person has: the
 * API's own (`http://localhost:8000` in the local edition) or the web app's (`http://localhost:3000`).
 * Two questions are asked, in order, with no credential and following no redirect:
 *
 * 1. `GET <to>/health`: when it answers the API's health JSON (core orchestrator/main.py
 *    `health_check`: `{status, service: "automatos-ai-api", components, ...}`), `<to>` is the API base.
 * 2. `GET <to>/automatos-host.json`: the web app's host file (core PRD-261 B-03j: `{schema: 1, apiUrl}`)
 *    names the API base. Core's web app serves it only once B-03j has shipped; against an older core
 *    only the API's own address works.
 *
 * When neither answers, one sentence names both forms and nothing is sent. A question that gets no
 * answer, or an answer that isn't the form asked about, just moves on to the next one.
 *
 * Every address, `--to` and the host file's `apiUrl` alike, must be http:// or https:// with no user,
 * password, query or fragment, and plain http:// only to this machine (localhost, 127.0.0.1, [::1]),
 * since the token goes to the API base. No message repeats a refused address.
 */
import { plain } from './submit-answer.ts'
import { ENV_TOKEN, isLoopback, parseUrl, routeUrl } from './submit-target.ts'

export const TO_FLAG = '--to'
export const HEALTH_ROUTE = '/health'
/** core PRD-261 B-03j: frontend/app/automatos-host.json/route.ts. */
export const HOST_FILE_ROUTE = '/automatos-host.json'
export const HOST_FILE_SCHEMA = 1
/** The `service` core's health answer names (orchestrator/main.py `health_check`). */
export const API_SERVICE = 'automatos-ai-api'
/** The local edition's two addresses, as the sentences name them. */
export const WEB_APP_EXAMPLE = 'http://localhost:3000'
export const API_EXAMPLE = 'http://localhost:8000'
export const PROBE_TIMEOUT_SECONDS = 10
const MS_PER_SECOND = 1000
const STATUS_OK = 200

type Json = Record<string, unknown>
type AddressProblem = 'scheme' | 'credentials' | 'query' | 'plainHttp'

export type ToResult = { readonly ok: true; readonly url: URL } | { readonly ok: false; readonly message: string }

export type ResolvedHost =
  | {
      readonly ok: true
      /** The API base every install request goes to. */
      readonly base: URL
      /** The host file that named the base, or null when `--to` is the API itself. */
      readonly hostFile: string | null
    }
  | { readonly ok: false; readonly message: string }

const TO_PROBLEMS: Readonly<Record<AddressProblem, string>> = {
  scheme: `${TO_FLAG} must be an http:// or https:// address.`,
  credentials: `${TO_FLAG} must not carry a user or password; put the token in ${ENV_TOKEN}.`,
  query: `${TO_FLAG} must be an address with no query or fragment.`,
  plainHttp:
    `${TO_FLAG} is plain http:// to another machine, which would send the package and the token unencrypted; `
    + 'use https:// (plain http:// is only for localhost or 127.0.0.1).',
}

const API_URL_PROBLEMS: Readonly<Record<AddressProblem, string>> = {
  scheme: 'names an apiUrl that is not an http:// or https:// address',
  credentials: 'names an apiUrl that carries a user or password',
  query: 'names an apiUrl with a query or fragment',
  plainHttp: 'names a plain http:// apiUrl on another machine, which would send the package and the token unencrypted',
}

function isJson(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** What keeps `url` from being an address install may send to, or null when nothing does. */
function addressProblem(url: URL): AddressProblem | null {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return 'scheme'
  if (url.username !== '' || url.password !== '') return 'credentials'
  if (url.search !== '' || url.hash !== '') return 'query'
  if (url.protocol === 'http:' && !isLoopback(url)) return 'plainHttp'
  return null
}

/** The address as printed: scheme, host, port and any path prefix (a refused one is never printed). */
export function shownAddress(url: URL): string {
  return routeUrl(url, '')
}

/** `--to`'s address, or the one sentence that says why it can't be used. */
export function parseTo(raw: string): ToResult {
  const url = parseUrl(raw.trim())
  if (url === null) {
    return { ok: false, message: `${TO_FLAG} is not a URL: give the web app's URL (${WEB_APP_EXAMPLE}) or the API's (${API_EXAMPLE}).` }
  }
  const problem = addressProblem(url)
  return problem === null ? { ok: true, url } : { ok: false, message: TO_PROBLEMS[problem] }
}

/** The JSON a GET answered with 200, or undefined for anything else (no answer, another status, not JSON). */
async function probe(url: string, fetchImpl: typeof fetch): Promise<unknown> {
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      // A redirect is not the answer asked about, so it is never followed.
      redirect: 'manual',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_SECONDS * MS_PER_SECOND),
    })
    if (response.status !== STATUS_OK) return undefined
    return JSON.parse(await response.text()) as unknown
  } catch {
    // No answer, or not JSON: this form is not there, and the caller asks the next one.
    return undefined
  }
}

/** True when `body` is core's health answer, so the address that gave it is the API's. */
export function isApiHealth(body: unknown): boolean {
  return isJson(body) && body.service === API_SERVICE && typeof body.status === 'string' && isJson(body.components)
}

/** The sentence for a `--to` that is neither form; it names both. */
export function neitherSentence(shown: string): string {
  return (
    `${shown} answered neither as the Automatos API (GET ${HEALTH_ROUTE}) nor as its web app `
    + `(GET ${HOST_FILE_ROUTE}): ${TO_FLAG} takes the web app's URL, such as ${WEB_APP_EXAMPLE}, `
    + `or the API's, such as ${API_EXAMPLE}, and nothing was sent.`
  )
}

function refuseHostFile(fileUrl: string, why: string): ResolvedHost {
  return { ok: false, message: `${fileUrl} ${why}: nothing was sent.` }
}

/** The API base a host file names, or why it can't be used. */
function hostFileBase(file: Json, fileUrl: string): ResolvedHost {
  if (file.schema !== HOST_FILE_SCHEMA) {
    return refuseHostFile(fileUrl, `has schema ${plain(file.schema)}, and this command reads schema ${HOST_FILE_SCHEMA}`)
  }
  const apiUrl = file.apiUrl
  const url = typeof apiUrl === 'string' ? parseUrl(apiUrl.trim()) : null
  if (url === null) return refuseHostFile(fileUrl, 'names no apiUrl this command can read')
  const problem = addressProblem(url)
  if (problem !== null) return refuseHostFile(fileUrl, API_URL_PROBLEMS[problem])
  return { ok: true, base: url, hostFile: fileUrl }
}

/** The API base for `to` (already checked by parseTo): `to` itself, or the one its host file names. */
export async function resolveHost(to: URL, fetchImpl: typeof fetch): Promise<ResolvedHost> {
  if (isApiHealth(await probe(routeUrl(to, HEALTH_ROUTE), fetchImpl))) return { ok: true, base: to, hostFile: null }
  const fileUrl = routeUrl(to, HOST_FILE_ROUTE)
  const file = await probe(fileUrl, fetchImpl)
  if (!isJson(file) || !('schema' in file)) return { ok: false, message: neitherSentence(shownAddress(to)) }
  return hostFileBase(file, fileUrl)
}
