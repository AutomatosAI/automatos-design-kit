/**
 * `install` against a mocked fetch: core's calls in order (import, the update only when the install
 * runs another version, opt-in, and the choice only with --choose) against the API base, each body as
 * core reads it; the server's refusals printed with their sentence and code; nothing sent for a bad
 * --to or a missing file; the token never printed.
 *
 * The answers are the shapes core's routes and gates send (orchestrator/api/themes_import.py,
 * orchestrator/api/themes_install.py, services/themes/records.py, services/themes/updates.py,
 * core/auth/step_up.py).
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { run } from '../src/cli-main.ts'
import { API_SERVICE, HEALTH_ROUTE, HOST_FILE_ROUTE, HOST_FILE_SCHEMA } from '../src/host-resolve.ts'
import { ROLLBACK_HINT } from '../src/install-answer.ts'
import { CHOICE_ROUTE, CHOOSE_HINT, IMPORT_FIELD, IMPORT_ROUTE, INSTALL_USAGE, optInRoute, updateRoute } from '../src/install.ts'
import { SECRET_MASK } from '../src/output.ts'
import { ENV_TOKEN, ENV_WORKSPACE, type Environment } from '../src/submit-target.ts'

const API = 'http://localhost:8000'
const WEB = 'http://localhost:3000'
const TOKEN = 'eyJhbGciOiJSUzI1NiJ9.test-only-session-token.c2lnbmF0dXJl'
const WORKSPACE = '00000000-0000-4000-8000-000000000001'
const INSTALL_ID = '5f0c1d2e-0000-4000-8000-000000000011'
const PACKAGE_ID = '7b0c5d8e-0000-4000-8000-000000000012'
/** The newer version's package, uploaded while the install runs PACKAGE_ID. */
const NEWER_ID = '9d0e7f1a-0000-4000-8000-000000000013'
const PACKAGE_NAME = 'automatos-e2e.hello-1.0.0.autotheme'
const PACKAGE_BYTES = Buffer.from('PK\u0003\u0004 the package bytes, read and sent as they are')
const WORDING = 'This theme was not reviewed. Its code runs with your access to all your workspaces.'
const HEALTH = { status: 'healthy', service: API_SERVICE, components: { api_server: 'healthy' }, edition: 'local' }
const IMPORTED = {
  package: {
    id: PACKAGE_ID, themeId: 'automatos-e2e/hello', version: '1.0.0', name: 'Hello',
    digest: '38b9333e778879f49d655efaa4007e4aeafaef140803145a187e441286ceb83f', ownerType: 'workspace',
    reviewed: false, scanVerdict: 'pass', scanReport: { verdict: 'pass', checks: { sizes: { level: 'pass' } } },
  },
  install: { id: INSTALL_ID, themeId: 'automatos-e2e/hello', packageId: PACKAGE_ID, pendingPackageId: null, isDefault: false },
  status: 'installed',
  duplicate: false,
}
const OPTED_IN = { installId: INSTALL_ID, optIn: { required: false, wording: WORDING, packageId: PACKAGE_ID } }
const CHOSEN = { choice: INSTALL_ID, source: 'choice', theme: { installId: INSTALL_ID, themeId: 'automatos-e2e/hello' } }
/** core records.py `_offer_update`: a newer version, stored and offered as the install's update. */
const NEWER = {
  ...IMPORTED,
  package: { ...IMPORTED.package, id: NEWER_ID, version: '1.1.0', digest: 'a'.repeat(64) },
  install: { ...IMPORTED.install, pendingPackageId: NEWER_ID },
  status: 'update_available',
}
/** core updates.py `install_row`: the install after the update, running the newer package. */
const UPDATED = {
  installId: INSTALL_ID, themeId: 'automatos-e2e/hello', name: 'Hello', packageId: NEWER_ID, version: '1.1.0',
  ownerType: 'workspace', reviewed: false, private: true, isDefault: false, pinnedVersion: null,
  previousPackageId: PACKAGE_ID, pendingPackageId: null, pendingVersion: null,
  optIn: { required: true, wording: WORDING, packageId: NEWER_ID },
}

const IMPORT = `POST ${API}${IMPORT_ROUTE}`
const OPT_IN = `POST ${API}${optInRoute(INSTALL_ID)}`
const CHOICE = `PUT ${API}${CHOICE_ROUTE}`
const UPDATE = `POST ${API}${updateRoute(INSTALL_ID)}`
const HEALTH_CALL = `GET ${API}${HEALTH_ROUTE}`

interface Call {
  readonly key: string
  readonly init: RequestInit
}

type Answer = () => Response | Promise<Response>

interface Ran {
  readonly code: number
  readonly out: string[]
  readonly err: string[]
  /** Every request but the health question. */
  readonly sent: Call[]
  /** How many requests went out, the health question included. */
  readonly asked: number
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })
}

/** The local API: healthy, and every step answered as given (by default, each succeeds). */
function answers(overrides: Readonly<Record<string, Answer>> = {}): Readonly<Record<string, Answer>> {
  return {
    [HEALTH_CALL]: () => json(200, HEALTH),
    [IMPORT]: () => json(201, IMPORTED),
    [OPT_IN]: () => json(200, OPTED_IN),
    [CHOICE]: () => json(200, CHOSEN),
    ...overrides,
  }
}

const folders: string[] = []

afterEach(() => {
  folders.splice(0).forEach((folder) => rmSync(folder, { recursive: true, force: true }))
})

function packageFolder(): string {
  const folder = mkdtempSync(join(tmpdir(), 'automatos-install-'))
  folders.push(folder)
  writeFileSync(join(folder, PACKAGE_NAME), PACKAGE_BYTES)
  return folder
}

async function install(
  extra: readonly string[] = [], routes = answers(), env: Environment = {}, argv?: readonly string[],
): Promise<Ran> {
  const calls: Call[] = []
  const fetchStub = (async (input: unknown, init?: RequestInit): Promise<Response> => {
    const key = `${init?.method ?? 'GET'} ${String(input)}`
    calls.push({ key, init: init ?? {} })
    const route = routes[key]
    return route === undefined ? new Response('<html>Not found</html>', { status: 404 }) : route()
  }) as typeof fetch
  const out: string[] = []
  const err: string[] = []
  const output = { out: (line: string) => out.push(line), err: (line: string) => err.push(line) }
  const args = argv ?? ['install', PACKAGE_NAME, '--to', API, ...extra]
  const code = await run(args, output, { env, fetch: fetchStub, cwd: packageFolder() })
  return { code, out, err, sent: calls.filter((call) => call.key !== HEALTH_CALL), asked: calls.length }
}

function bodyOf(call: Call): unknown {
  return JSON.parse(String(call.init.body))
}

function printed(ran: Ran): string {
  return [...ran.out, ...ran.err].join('\n')
}

/** The origin a call went to. */
function originOf(call: Call): string {
  return new URL(call.key.slice(call.key.indexOf(' ') + 1)).origin
}

describe('install: the three calls', () => {
  it('imports, opts in and, with --choose, chooses, in that order and with the bodies core reads', async () => {
    const ran = await install(['--choose'])
    expect(ran.code).toBe(0)
    expect(ran.sent.map((call) => call.key)).toEqual([IMPORT, OPT_IN, CHOICE])
    const [imported, optedIn, chosen] = ran.sent
    const file = (imported.init.body as FormData).get(IMPORT_FIELD)
    if (file === null || typeof file === 'string') throw new Error('the form has no file field')
    expect(file.name).toBe(PACKAGE_NAME)
    expect(Buffer.from(await file.arrayBuffer()).equals(PACKAGE_BYTES)).toBe(true)
    expect(bodyOf(optedIn)).toEqual({ packageId: PACKAGE_ID })
    expect(bodyOf(chosen)).toEqual({ choice: INSTALL_ID })
    expect(optedIn.init.headers).toEqual({ Accept: 'application/json', 'Content-Type': 'application/json' })
    ran.sent.forEach((call) => expect(call.init.redirect).toBe('manual'))
    const text = ran.out.join('\n')
    expect(text).toContain('Imported automatos-e2e/hello 1.0.0 into this workspace: private, not reviewed.')
    expect(text).toContain(`Opted in to automatos-e2e/hello 1.0.0. ${WORDING}`)
    expect(text).toContain('Chosen: automatos-e2e/hello 1.0.0 is your theme in this workspace now.')
  })

  it('does not choose without --choose, and says how to', async () => {
    const ran = await install()
    expect(ran.code).toBe(0)
    expect(ran.sent.map((call) => call.key)).toEqual([IMPORT, OPT_IN])
    expect(ran.out).toContain(CHOOSE_HINT)
  })

  it('goes on after a 200 for bytes the workspace has already', async () => {
    const ran = await install([], answers({ [IMPORT]: () => json(200, { ...IMPORTED, duplicate: true }) }))
    expect(ran.code).toBe(0)
    expect(ran.sent.map((call) => call.key)).toEqual([IMPORT, OPT_IN])
    expect(ran.out.join('\n')).toContain('These exact bytes were in this workspace already: automatos-e2e/hello 1.0.0.')
  })

  it('sends the token and the workspace to the API base on every call', async () => {
    const ran = await install(['--choose'], answers(), { [ENV_TOKEN]: TOKEN, [ENV_WORKSPACE]: WORKSPACE })
    expect(ran.code).toBe(0)
    expect(ran.sent).toHaveLength(3)
    ran.sent.forEach((call) => {
      const headers = call.init.headers as Record<string, string>
      expect(headers.Authorization).toBe(`Bearer ${TOKEN}`)
      expect(headers['X-Workspace-ID']).toBe(WORKSPACE)
    })
  })

  it('sends every step to the API the host file names, never to the web app given as --to, the token only there', async () => {
    const hostFile = { [`GET ${WEB}${HOST_FILE_ROUTE}`]: () => json(200, { schema: HOST_FILE_SCHEMA, apiUrl: API }) }
    const ran = await install([], answers(hostFile), { [ENV_TOKEN]: TOKEN }, ['install', PACKAGE_NAME, '--to', WEB, '--choose'])
    expect(ran.code).toBe(0)
    expect(ran.sent.filter((call) => call.init.method !== 'GET').map((call) => call.key)).toEqual([IMPORT, OPT_IN, CHOICE])
    expect(ran.sent.filter((call) => originOf(call) === WEB).map((call) => call.key))
      .toEqual([`GET ${WEB}${HEALTH_ROUTE}`, `GET ${WEB}${HOST_FILE_ROUTE}`])
    ran.sent.forEach((call) => {
      const headers = call.init.headers as Record<string, string>
      expect(headers.Authorization).toBe(originOf(call) === API ? `Bearer ${TOKEN}` : undefined)
    })
    expect(ran.out).toContain(`${WEB}${HOST_FILE_ROUTE} names the API: ${API}`)
  })

  it.each<[string, number, unknown]>([
    ['a newer version offered as the update (201)', 201, NEWER],
    ['a version stored while another runs (200, bytes held already)', 200,
      { ...NEWER, install: IMPORTED.install, status: 'stored', duplicate: true }],
  ])('moves the install to %s, then opts in to it and chooses it', async (_case, status, body) => {
    const routes = answers({
      [IMPORT]: () => json(status, body),
      [UPDATE]: () => json(200, UPDATED),
      [OPT_IN]: () => json(200, { installId: INSTALL_ID, optIn: { required: false, wording: WORDING, packageId: NEWER_ID } }),
    })
    const ran = await install(['--choose'], routes)
    expect(ran.code).toBe(0)
    expect(ran.sent.map((call) => call.key)).toEqual([IMPORT, UPDATE, OPT_IN, CHOICE])
    const [, updated, optedIn, chosen] = ran.sent
    expect(bodyOf(updated)).toEqual({ packageId: NEWER_ID })
    expect(updated.init.redirect).toBe('manual')
    expect(bodyOf(optedIn)).toEqual({ packageId: NEWER_ID })
    expect(bodyOf(chosen)).toEqual({ choice: INSTALL_ID })
    expect(ran.out).toContain(`Moved the install to automatos-e2e/hello 1.1.0. ${ROLLBACK_HINT}`)
  })

  it('prints the update refused for a version not newer, exit 1, and never opts in', async () => {
    const sentence = 'That version is not newer than the one installed. Use rollback to go back to the previous version.'
    const ran = await install(['--choose'], answers({ [IMPORT]: () => json(201, NEWER), [UPDATE]: () => json(409, { detail: sentence }) }))
    expect(ran.code).toBe(1)
    expect(ran.sent.map((call) => call.key)).toEqual([IMPORT, UPDATE])
    expect(ran.err).toContain('The server refused the update (409):')
    expect(ran.err).toContain(sentence)
  })

  it('stops, exit 1, when the update answers with an install that runs another package', async () => {
    const ran = await install([], answers({ [IMPORT]: () => json(201, NEWER), [UPDATE]: () => json(200, { ...UPDATED, packageId: PACKAGE_ID }) }))
    expect(ran.code).toBe(1)
    expect(ran.sent.map((call) => call.key)).toEqual([IMPORT, UPDATE])
    expect(ran.err[0]).toBe('The server answered the update with 200, but not in the form this command reads:')
  })

  it.each<[string, unknown]>([
    ['no install in the answer', { ...IMPORTED, install: null }],
    ['no install in an update answer', { ...NEWER, install: null }],
    ['a status this command does not know', { ...IMPORTED, status: 'quarantined' }],
  ])('stops after the import, exit 1, when it is %s', async (_case, body) => {
    const ran = await install(['--choose'], answers({ [IMPORT]: () => json(201, body) }))
    expect(ran.code).toBe(1)
    expect(ran.sent.map((call) => call.key)).toEqual([IMPORT])
    expect(ran.err).toContain('Nothing was opted in to or chosen.')
  })
})

describe('install: the server refused a step', () => {
  const stepUp = {
    clerk_error: { type: 'forbidden', reason: 'reverification-error', metadata: { reverification: { level: 'first_factor', afterMinutes: 10 } } },
    code: 'step_up_required',
    detail: "Confirm it's you to continue: this action needs a sign-in from the last 10 minutes.",
  }
  const tooLarge = {
    detail: { message: "This theme can't be installed.", errors: [{ code: 'PACKAGE_TOO_LARGE', path: '', message: 'A theme package must be 15 MB or smaller.' }] },
  }

  it.each<[string, number, unknown, readonly string[]]>([
    ['private uploads off', 403, { detail: 'Private theme uploads are turned off on this platform.' }, ['Private theme uploads are turned off on this platform.']],
    ['a reserved publisher', 403, { detail: 'Only an Automatos admin can upload a theme under the "automatos" publisher.' },
      ['Only an Automatos admin can upload a theme under the "automatos" publisher.']],
    ['a version clash', 409, { detail: 'This workspace already has automatos-e2e/hello 1.0.0 with different files. Raise the version in theme.json and upload it again.' },
      ['This workspace already has automatos-e2e/hello 1.0.0 with different files. Raise the version in theme.json and upload it again.']],
    ['a package over the cap', 413, tooLarge, ["This theme can't be installed.", '  PACKAGE_TOO_LARGE: A theme package must be 15 MB or smaller.']],
    ['the body limit', 413, { detail: 'Payload too large' }, ['Payload too large']],
    ['step-up', 403, stepUp, [stepUp.detail, 'Code: step_up_required']],
    ['a caller step-up cannot confirm', 403, { detail: { code: 'step_up_unavailable', message: 'Keys cannot confirm it.' } },
      ['Keys cannot confirm it.', 'Code: step_up_unavailable']],
  ])('prints the import refusal for %s with its status and code, exit 1, and stops', async (_case, status, body, lines) => {
    const ran = await install(['--choose'], answers({ [IMPORT]: () => json(status, body) }))
    expect(ran.code).toBe(1)
    expect(ran.sent.map((call) => call.key)).toEqual([IMPORT])
    expect(ran.err[0]).toBe(`The server refused the import (${status}):`)
    lines.forEach((line) => expect(ran.err).toContain(line))
  })

  it('notes that step-up is a recent sign-in the local edition passes', async () => {
    const ran = await install([], answers({ [IMPORT]: () => json(403, stepUp) }))
    expect(ran.err.join('\n')).toContain('Note: this step needs step-up')
  })

  it('prints a step-up 403 on the opt-in, and never chooses', async () => {
    const ran = await install(['--choose'], answers({ [OPT_IN]: () => json(403, stepUp) }))
    expect(ran.code).toBe(1)
    expect(ran.sent.map((call) => call.key)).toEqual([IMPORT, OPT_IN])
    expect(ran.err).toContain('The server refused the opt-in (403):')
    expect(ran.err).toContain('Code: step_up_required')
  })

  it('prints a 409 on the opt-in', async () => {
    const sentence = "That version is no longer this theme's current one. Reload to see the version installed now."
    const ran = await install([], answers({ [OPT_IN]: () => json(409, { detail: sentence }) }))
    expect(ran.code).toBe(1)
    expect(ran.err).toContain('The server refused the opt-in (409):')
    expect(ran.err).toContain(sentence)
  })

  it('prints a 403 on the choice, and a choice the server did not keep', async () => {
    const locked = "This workspace's admins choose its theme; the workspace default applies."
    const refused = await install(['--choose'], answers({ [CHOICE]: () => json(403, { detail: locked }) }))
    expect(refused.code).toBe(1)
    expect(refused.err).toContain(locked)
    const kept = await install(['--choose'], answers({ [CHOICE]: () => json(200, { choice: 'studio', source: 'fallback', theme: null }) }))
    expect(kept.code).toBe(1)
    expect(kept.err.join('\n')).toContain('The server kept the choice studio (fallback)')
  })

  it('reports a redirect without following it, and no answer, each exit 1', async () => {
    const moved = await install([], answers({ [IMPORT]: () => new Response(null, { status: 302, headers: { location: `${API}/sign-in` } }) }))
    expect(moved.code).toBe(1)
    expect(moved.sent).toHaveLength(1)
    expect(moved.err.join('\n')).toContain(`redirect (302) to ${API}/sign-in`)
    const refused = Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } })
    const silent = await install([], answers({ [IMPORT]: () => Promise.reject(refused) }))
    expect(silent.code).toBe(1)
    expect(silent.err).toContain(`No answer from ${API} to the import: fetch failed (ECONNREFUSED).`)
  })
})

describe('install: nothing is sent before the arguments, the address and the file check out', () => {
  it.each<[string, readonly string[]]>([
    ['no --to', ['install', PACKAGE_NAME]],
    ['no file', ['install', '--to', API]],
    ['two files', ['install', PACKAGE_NAME, 'b.autotheme', '--to', API]],
    ['an unknown flag', ['install', PACKAGE_NAME, '--to', API, '--force']],
    ['--to with no value', ['install', PACKAGE_NAME, '--to']],
  ])('prints the usage and exits 2 for %s', async (_case, argv) => {
    const ran = await install([], answers(), {}, argv)
    expect(ran.code).toBe(2)
    expect(ran.err).toEqual([INSTALL_USAGE])
    expect(ran.asked).toBe(0)
  })

  it.each<[string, string]>([
    ['not a URL', 'nothing-here'],
    ['plain http:// to another machine', 'http://app.example.test'],
    ['a scheme that is not http(s)', 'ftp://localhost:3000'],
    ['a user and password', 'https://me:pw@app.example.test'],
  ])('exits 2 for a --to that is %s, asking nothing', async (_case, to) => {
    const ran = await install([], answers(), {}, ['install', PACKAGE_NAME, '--to', to])
    expect(ran.code).toBe(2)
    expect(ran.err).toHaveLength(1)
    expect(ran.asked).toBe(0)
    expect(printed(ran)).not.toContain('me:pw')
  })

  it.each(['http://localhost:8000', 'http://127.0.0.1:8000'])('takes plain http:// to this machine: %s', async (to) => {
    const routes = { [`GET ${to}${HEALTH_ROUTE}`]: () => json(200, HEALTH), [`POST ${to}${IMPORT_ROUTE}`]: () => json(201, IMPORTED),
      [`POST ${to}${optInRoute(INSTALL_ID)}`]: () => json(200, OPTED_IN) }
    const ran = await install([], routes, {}, ['install', PACKAGE_NAME, '--to', to])
    expect(ran.code).toBe(0)
  })

  it('exits 2 for a missing package file, asking nothing', async () => {
    const ran = await install([], answers(), {}, ['install', 'missing.autotheme', '--to', API])
    expect(ran.code).toBe(2)
    expect(ran.asked).toBe(0)
    expect(ran.err.join('\n')).toContain("missing.autotheme can't be read.")
  })

  it('exits 2 for a token a header cannot carry, never printing it', async () => {
    const ran = await install([], answers(), { [ENV_TOKEN]: `${TOKEN}\nX-Injected: 1` })
    expect(ran.code).toBe(2)
    expect(ran.asked).toBe(0)
    expect(printed(ran)).not.toContain(TOKEN)
    expect(ran.err.join('\n')).toContain(`${ENV_TOKEN} holds spaces or characters`)
  })
})

describe('install: the token is never printed', () => {
  const withToken: Environment = { [ENV_TOKEN]: TOKEN }
  const echoes: Array<[string, Readonly<Record<string, Answer>>]> = [
    ['a 201', answers()],
    ['an import 401', answers({ [IMPORT]: () => json(401, { detail: `Invalid token ${TOKEN}` }) })],
    ['an import 403', answers({ [IMPORT]: () => json(403, { code: 'step_up_required', detail: `Bearer ${TOKEN} is stale` }) })],
    ['an opt-in 409', answers({ [OPT_IN]: () => json(409, { detail: `superseded for ${TOKEN}` }) })],
    ['a 502 that is not JSON', answers({ [IMPORT]: () => new Response(`upstream said ${TOKEN}`, { status: 502 }) })],
    ['a network error quoting it', answers({ [IMPORT]: () => Promise.reject(new TypeError(`bad header Bearer ${TOKEN}`)) })],
  ]

  it.each(echoes)('not after %s, even when the server repeats it', async (_case, routes) => {
    const ran = await install(['--choose'], routes, withToken)
    expect(printed(ran)).not.toContain(TOKEN)
  })

  it('shows it masked where the server repeated it', async () => {
    const ran = await install([], answers({ [IMPORT]: () => json(401, { detail: `Invalid token ${TOKEN}` }) }), withToken)
    expect(ran.err).toContain(`Invalid token ${SECRET_MASK}`)
  })
})
