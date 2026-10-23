/**
 * How `install --to` finds the API, against a mocked fetch: the API's own address (its GET /health is
 * the backend's health JSON), the web app's (its GET /automatos-host.json names the API, core PRD-261
 * B-03j), neither (one sentence naming both forms, nothing sent), and the host files and addresses
 * that are refused. The health answer is the shape core's orchestrator/main.py `health_check` sends.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { run } from '../src/cli-main.ts'
import {
  API_EXAMPLE, API_SERVICE, HEALTH_ROUTE, HOST_FILE_ROUTE, isApiHealth, neitherSentence, parseTo, resolveHost, WEB_APP_EXAMPLE,
} from '../src/host-resolve.ts'
import { IMPORT_ROUTE } from '../src/install.ts'
import { ENV_TOKEN, type Environment } from '../src/submit-target.ts'

const WEB = 'http://localhost:3000'
const API = 'http://localhost:8000'
const TOKEN = 'test-only-token-value-0123456789'
const PACKAGE_NAME = 'automatos-e2e.hello-1.0.0.autotheme'
const HEALTH = {
  status: 'healthy', service: API_SERVICE, version: '1.0.0', timestamp: '2026-01-01T00:00:00',
  components: { api_server: 'healthy', database: 'healthy', config: 'healthy' }, metrics: {}, extensions: null,
  edition: 'local', cli_runtime_enabled: false,
}
const HOST_FILE = { schema: 1, apiUrl: API }

interface Call {
  readonly method: string
  readonly url: string
  readonly init: RequestInit
}

type Routes = Readonly<Record<string, () => Response | Promise<Response>>>

interface Mock {
  readonly fetch: typeof fetch
  readonly calls: Call[]
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function notFound(): Response {
  return new Response('<html>Not found</html>', { status: 404, headers: { 'content-type': 'text/html' } })
}

/** A fetch that answers `"<METHOD> <url>"` from `routes`, and 404 for anything else. */
function server(routes: Routes): Mock {
  const calls: Call[] = []
  const impl = async (input: unknown, init?: RequestInit): Promise<Response> => {
    const call = { method: init?.method ?? 'GET', url: String(input), init: init ?? {} }
    calls.push(call)
    const route = routes[`${call.method} ${call.url}`]
    return route === undefined ? notFound() : route()
  }
  return { fetch: impl as typeof fetch, calls }
}

function toUrl(raw: string): URL {
  const parsed = parseTo(raw)
  if (!parsed.ok) throw new Error(parsed.message)
  return parsed.url
}

const folders: string[] = []

afterEach(() => {
  folders.splice(0).forEach((folder) => rmSync(folder, { recursive: true, force: true }))
})

interface Ran {
  readonly code: number
  readonly out: string[]
  readonly err: string[]
}

/** `install <package> --to <to>` through the command table, in a folder holding the package. */
async function install(mock: Mock, to: string, env: Environment = {}): Promise<Ran> {
  const folder = mkdtempSync(join(tmpdir(), 'automatos-host-'))
  folders.push(folder)
  writeFileSync(join(folder, PACKAGE_NAME), Buffer.from('PK test package'))
  const out: string[] = []
  const err: string[] = []
  const output = { out: (line: string) => out.push(line), err: (line: string) => err.push(line) }
  const code = await run(['install', PACKAGE_NAME, '--to', to], output, { env, fetch: mock.fetch, cwd: folder })
  return { code, out, err }
}

describe('host-resolve: --to is the API', () => {
  it('is the API base when its GET /health answers the backend health JSON, and the host file is not asked', async () => {
    const mock = server({ [`GET ${API}${HEALTH_ROUTE}`]: () => json(200, HEALTH) })
    const resolved = await resolveHost(toUrl(API), mock.fetch)
    expect(resolved.ok && resolved.base.href).toBe(`${API}/`)
    expect(resolved.ok && resolved.hostFile).toBeNull()
    expect(mock.calls.map((call) => `${call.method} ${call.url}`)).toEqual([`GET ${API}${HEALTH_ROUTE}`])
  })

  it('keeps a path prefix: /health is asked under it, and it stays the base', async () => {
    const prefixed = 'https://api.example.test/backend/'
    const mock = server({ ['GET https://api.example.test/backend/health']: () => json(200, HEALTH) })
    const resolved = await resolveHost(toUrl(prefixed), mock.fetch)
    expect(resolved.ok && resolved.base.href).toBe(prefixed)
  })

  it('tells the backend health JSON from other health answers', () => {
    expect(isApiHealth(HEALTH)).toBe(true)
    expect(isApiHealth({ ...HEALTH, status: 'unhealthy' })).toBe(true)
    expect(isApiHealth({ status: 'ok' })).toBe(false)
    expect(isApiHealth({ ...HEALTH, service: 'another-service' })).toBe(false)
    expect(isApiHealth({ ...HEALTH, components: 'healthy' })).toBe(false)
    expect(isApiHealth([HEALTH])).toBe(false)
  })
})

describe('host-resolve: --to is the web app', () => {
  it('reads <to>/automatos-host.json when /health is not the backend, and its apiUrl is the base', async () => {
    const mock = server({ [`GET ${WEB}${HOST_FILE_ROUTE}`]: () => json(200, HOST_FILE) })
    const resolved = await resolveHost(toUrl(WEB), mock.fetch)
    expect(resolved.ok && resolved.base.href).toBe(`${API}/`)
    expect(resolved.ok && resolved.hostFile).toBe(`${WEB}${HOST_FILE_ROUTE}`)
    expect(mock.calls.map((call) => `${call.method} ${call.url}`)).toEqual([`GET ${WEB}${HEALTH_ROUTE}`, `GET ${WEB}${HOST_FILE_ROUTE}`])
  })

  it.each<[string, () => Response | Promise<Response>]>([
    ['a health JSON that is not the backend', () => json(200, { status: 'ok' })],
    ['a redirect to a sign-in page', () => new Response(null, { status: 307, headers: { location: `${WEB}/sign-in` } })],
    ['no answer at all', () => Promise.reject(new TypeError('fetch failed'))],
  ])('moves on to the host file after %s', async (_case, health) => {
    const mock = server({ [`GET ${WEB}${HEALTH_ROUTE}`]: health, [`GET ${WEB}${HOST_FILE_ROUTE}`]: () => json(200, HOST_FILE) })
    const resolved = await resolveHost(toUrl(WEB), mock.fetch)
    expect(resolved.ok && resolved.base.href).toBe(`${API}/`)
  })

  it('asks both questions with no credential, following no redirect', async () => {
    const mock = server({ [`GET ${WEB}${HOST_FILE_ROUTE}`]: () => json(200, HOST_FILE), [`POST ${API}${IMPORT_ROUTE}`]: () => json(403, { detail: 'stop here' }) })
    await install(mock, WEB, { [ENV_TOKEN]: TOKEN })
    const probes = mock.calls.filter((call) => call.method === 'GET')
    expect(probes).toHaveLength(2)
    probes.forEach((call) => {
      expect(call.init.redirect).toBe('manual')
      expect(call.init.headers).toEqual({ Accept: 'application/json' })
    })
  })

  it.each(['https://api.example.test', 'https://api.example.test/backend', 'http://127.0.0.1:8000', 'http://[::1]:8000'])(
    'takes the apiUrl %s',
    async (apiUrl) => {
      const mock = server({ [`GET ${WEB}${HOST_FILE_ROUTE}`]: () => json(200, { schema: 1, apiUrl }) })
      const resolved = await resolveHost(toUrl(WEB), mock.fetch)
      expect(resolved.ok && resolved.base.href).toBe(new URL(apiUrl).href)
    },
  )
})

describe('host-resolve: neither form answers', () => {
  it.each<[string, Routes]>([
    ['both 404', {}],
    ['a host file that is not JSON', { [`GET ${WEB}${HOST_FILE_ROUTE}`]: () => new Response('<html>app</html>', { status: 200 }) }],
    ['a JSON file with no schema', { [`GET ${WEB}${HOST_FILE_ROUTE}`]: () => json(200, { apiUrl: API }) }],
    ['no answer from either', { [`GET ${WEB}${HEALTH_ROUTE}`]: () => Promise.reject(new TypeError('fetch failed')) }],
  ])('exits 2 with one sentence naming both forms, and sends nothing: %s', async (_case, routes) => {
    const mock = server(routes)
    const ran = await install(mock, WEB)
    expect(ran.code).toBe(2)
    expect(ran.out).toEqual([])
    expect(ran.err).toEqual([neitherSentence(WEB)])
    expect(mock.calls.every((call) => call.method === 'GET')).toBe(true)
  })

  it('names both forms and both examples in the sentence', () => {
    const sentence = neitherSentence(WEB)
    expect(sentence).toContain(`GET ${HEALTH_ROUTE}`)
    expect(sentence).toContain(`GET ${HOST_FILE_ROUTE}`)
    expect(sentence).toContain(WEB_APP_EXAMPLE)
    expect(sentence).toContain(API_EXAMPLE)
    expect(sentence).toContain('nothing was sent')
  })
})

describe('host-resolve: a host file that is refused', () => {
  it.each<[string, unknown, string]>([
    ['an apiUrl that is not http(s)', { schema: 1, apiUrl: 'ftp://localhost:8000' }, 'not an http:// or https:// address'],
    ['a javascript: apiUrl', { schema: 1, apiUrl: 'javascript:alert(1)' }, 'not an http:// or https:// address'],
    ['a file: apiUrl', { schema: 1, apiUrl: 'file:///etc/hosts' }, 'not an http:// or https:// address'],
    ['plain http:// off loopback', { schema: 1, apiUrl: 'http://api.example.test' }, 'plain http:// apiUrl on another machine'],
    ['a user and password', { schema: 1, apiUrl: 'https://me:pw@api.example.test' }, 'carries a user or password'],
    ['a query', { schema: 1, apiUrl: 'https://api.example.test/?k=1' }, 'query or fragment'],
    ['no apiUrl', { schema: 1 }, 'names no apiUrl'],
    ['an apiUrl that is not a string', { schema: 1, apiUrl: 8000 }, 'names no apiUrl'],
    ['another schema', { schema: 2, apiUrl: API }, 'has schema 2'],
  ])('exits 2 for %s, and sends nothing', async (_case, file, reason) => {
    const mock = server({ [`GET ${WEB}${HOST_FILE_ROUTE}`]: () => json(200, file) })
    const ran = await install(mock, WEB, { [ENV_TOKEN]: TOKEN })
    expect(ran.code).toBe(2)
    expect(ran.err).toHaveLength(1)
    expect(ran.err[0]).toContain(`${WEB}${HOST_FILE_ROUTE}`)
    expect(ran.err[0]).toContain(reason)
    expect(ran.err[0]).toContain('nothing was sent')
    expect(ran.err[0]).not.toContain('me:pw')
    expect(mock.calls.every((call) => call.method === 'GET')).toBe(true)
  })
})

describe('host-resolve: the --to address', () => {
  it.each(['http://localhost:3000', 'http://127.0.0.1:8000', 'http://[::1]:8000', 'https://app.example.test', ' http://localhost:3000/ '])(
    'takes %j',
    (raw) => {
      expect(parseTo(raw).ok).toBe(true)
    },
  )

  it.each<[string, string]>([
    ['localhost:3000', 'must be an http:// or https:// address'],
    ['nothing-here', 'is not a URL'],
    ['ftp://localhost:3000', 'must be an http:// or https:// address'],
    ['http://app.example.test', 'plain http:// to another machine'],
    ['http://192.168.1.20:3000', 'plain http:// to another machine'],
    ['https://me:pw@app.example.test', 'user or password'],
    ['https://app.example.test/#here', 'no query or fragment'],
  ])('refuses %j, never repeating it', (raw, reason) => {
    const parsed = parseTo(raw)
    expect(parsed.ok).toBe(false)
    const message = parsed.ok ? '' : parsed.message
    expect(message).toContain(reason)
    expect(message).not.toContain(raw)
  })
})
