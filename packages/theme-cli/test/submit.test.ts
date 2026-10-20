/**
 * `submit` against a mocked fetch: the request core's submit route reads, the server's answer
 * printed in its own words, and the token kept out of every line.
 *
 * The answers are the shapes core's route and gates send at the pinned commit
 * (orchestrator/api/marketplace_themes_submit.py, core/auth/hybrid.py, core/auth/step_up.py).
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { run, USAGE } from '../src/cli-main.ts'
import { SECRET_MASK } from '../src/output.ts'
import { FORM_FIELD, SUBMIT_USAGE, submitCommand } from '../src/submit.ts'
import { ENV_TOKEN, ENV_URL, ENV_WORKSPACE, SUBMIT_ROUTE, type Environment } from '../src/submit-target.ts'

const TOKEN = 'eyJhbGciOiJSUzI1NiJ9.test-only-session-token.c2lnbmF0dXJl'
const API = 'https://api.example.test'
const WORKSPACE = '00000000-0000-4000-8000-000000000001'
const PACKAGE_NAME = 'automatos-e2e.hello-1.0.0.autotheme'
const PACKAGE_BYTES = Buffer.from('PK\u0003\u0004 not a real zip; the server is mocked')

interface Call {
  readonly url: string
  readonly init: RequestInit
}

interface Mock {
  readonly fetch: typeof fetch
  readonly calls: Call[]
}

interface Ran {
  readonly code: number
  readonly out: string[]
  readonly err: string[]
  readonly calls: Call[]
}

const folders: string[] = []

afterEach(() => {
  folders.splice(0).forEach((folder) => rmSync(folder, { recursive: true, force: true }))
})

/** A folder holding the package file, used as the working folder. */
function packageFolder(): string {
  const folder = mkdtempSync(join(tmpdir(), 'automatos-submit-'))
  folders.push(folder)
  writeFileSync(join(folder, PACKAGE_NAME), PACKAGE_BYTES)
  return folder
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })
}

function mockFetch(respond: () => Response | Promise<Response>): Mock {
  const calls: Call[] = []
  const impl = async (input: unknown, init?: RequestInit): Promise<Response> => {
    calls.push({ url: String(input), init: init ?? {} })
    return respond()
  }
  return { fetch: impl as typeof fetch, calls }
}

function failingFetch(error: Error): Mock {
  return mockFetch(() => Promise.reject(error))
}

async function submit(mock: Mock, env: Environment, argv: readonly string[] = ['submit', PACKAGE_NAME]): Promise<Ran> {
  const out: string[] = []
  const err: string[] = []
  const output = { out: (line: string) => out.push(line), err: (line: string) => err.push(line) }
  const code = await run(argv, output, { env, fetch: mock.fetch, cwd: packageFolder() })
  return { code, out, err, calls: mock.calls }
}

const WITH_TOKEN: Environment = { [ENV_URL]: API, [ENV_TOKEN]: TOKEN }
const NO_TOKEN: Environment = { [ENV_URL]: API }

function headersOf(call: Call): Record<string, string> {
  return (call.init.headers ?? {}) as Record<string, string>
}

function printed(ran: Ran): string {
  return [...ran.out, ...ran.err].join('\n')
}

const PENDING = {
  package: {
    id: '7b0c5d8e-0000-4000-8000-000000000002', themeId: 'automatos-e2e/hello', version: '1.0.0', name: 'Hello',
    digest: '38b9333e778879f49d655efaa4007e4aeafaef140803145a187e441286ceb83f', ownerType: 'marketplace',
    status: 'pending', reviewed: false, scanVerdict: 'review_required',
    scanReport: {
      schema: 'automatos-theme-scan/v2', stage: 'C-02a', verdict: 'review_required',
      checks: {
        sizes: { level: 'pass' },
        contrast: { level: 'not_measured', reason: 'The package declares no text and ground pairs.' },
        uses: { level: 'warning', status: 'checked', problems: ['Undeclared SDK areas: notices'] },
      },
    },
  },
  duplicate: false,
}

describe('submit: the request', () => {
  it('posts the package as the multipart field core reads, with the token as a bearer credential', async () => {
    const ran = await submit(mockFetch(() => jsonResponse(201, PENDING)), { ...WITH_TOKEN, [ENV_WORKSPACE]: WORKSPACE })
    expect(ran.calls).toHaveLength(1)
    const [call] = ran.calls
    expect(call.url).toBe(`${API}${SUBMIT_ROUTE}`)
    expect(call.init.method).toBe('POST')
    expect(call.init.redirect).toBe('manual')
    expect(headersOf(call)).toEqual({ Accept: 'application/json', Authorization: `Bearer ${TOKEN}`, 'X-Workspace-ID': WORKSPACE })
    const entry = (call.init.body as FormData).get(FORM_FIELD)
    if (entry === null || typeof entry === 'string') throw new Error('the form has no file field')
    expect(entry.name).toBe(PACKAGE_NAME)
    expect(Buffer.from(await entry.arrayBuffer()).equals(PACKAGE_BYTES)).toBe(true)
  })

  it('keeps a path prefix on the API address', async () => {
    const ran = await submit(mockFetch(() => jsonResponse(201, PENDING)), { ...WITH_TOKEN, [ENV_URL]: `${API}/backend/` })
    expect(ran.calls[0].url).toBe(`${API}/backend${SUBMIT_ROUTE}`)
  })

  it('sends no Authorization header when no token is set, and says so', async () => {
    const ran = await submit(mockFetch(() => jsonResponse(201, PENDING)), { [ENV_URL]: 'http://localhost:8000' })
    expect(headersOf(ran.calls[0])).toEqual({ Accept: 'application/json' })
    expect(ran.err.join('\n')).toContain(`${ENV_TOKEN} is not set`)
  })
})

describe('submit: the server took it', () => {
  it('prints pending review, the automated verdict and each check, and exits 0', async () => {
    const ran = await submit(mockFetch(() => jsonResponse(201, PENDING)), WITH_TOKEN)
    expect(ran.code).toBe(0)
    const text = ran.out.join('\n')
    expect(text).toContain('Submitted automatos-e2e/hello 1.0.0: pending review.')
    expect(text).toContain('A person reviews every version')
    expect(text).toContain('Automated review: review_required')
    expect(text).toContain('contrast: not_measured - The package declares no text and ground pairs.')
    expect(text).toContain('uses: warning')
    expect(text).toContain('Undeclared SDK areas: notices')
    expect(text).toContain(`Digest ${PENDING.package.digest}`)
  })

  it('says so when these exact bytes were submitted already (200)', async () => {
    const ran = await submit(mockFetch(() => jsonResponse(200, { ...PENDING, duplicate: true })), WITH_TOKEN)
    expect(ran.code).toBe(0)
    expect(ran.out.join('\n')).toContain('These exact bytes were submitted already: automatos-e2e/hello 1.0.0, status pending.')
  })
})

describe('submit: the server refused it', () => {
  it('prints the 400 sentence and every error with its code, and exits 1', async () => {
    const body = {
      detail: {
        message: "This theme can't be submitted.",
        errors: [
          { code: 'CSS_UNSCOPED', path: 'dist/theme.css', message: 'A rule sits outside html.hello.' },
          { code: 'MISSING_SLOT', path: 'theme.json', message: 'slots must include lookEditor@1.' },
        ],
      },
    }
    const ran = await submit(mockFetch(() => jsonResponse(400, body)), WITH_TOKEN)
    expect(ran.code).toBe(1)
    expect(ran.err[0]).toBe('The server refused the submission (400):')
    expect(ran.err).toContain("This theme can't be submitted.")
    expect(ran.err).toContain('  CSS_UNSCOPED dist/theme.css: A rule sits outside html.hello.')
    expect(ran.err).toContain('  MISSING_SLOT theme.json: slots must include lookEditor@1.')
  })

  it('prints the 409 sentence for a second open submission', async () => {
    const sentence = 'You already have automatos-e2e/hello 1.0.0 waiting for review. Submit again once it has been reviewed.'
    const ran = await submit(mockFetch(() => jsonResponse(409, { detail: sentence })), WITH_TOKEN)
    expect(ran.code).toBe(1)
    expect(ran.err).toContain(sentence)
  })

  it('prints the 401 without a token and notes the token is not set', async () => {
    const ran = await submit(mockFetch(() => jsonResponse(401, { detail: 'Authentication required' })), NO_TOKEN)
    expect(ran.code).toBe(1)
    expect(ran.err).toContain('Authentication required')
    expect(ran.err.join('\n')).toContain(`Note: ${ENV_TOKEN} is not set`)
  })

  it('prints the 401 for a token the server did not accept', async () => {
    const ran = await submit(mockFetch(() => jsonResponse(401, { detail: 'Invalid or expired token' })), WITH_TOKEN)
    expect(ran.code).toBe(1)
    expect(ran.err).toContain('Invalid or expired token')
    expect(ran.err.join('\n')).toContain(`did not accept ${ENV_TOKEN}`)
  })

  it('prints the 403 step-up refusal with the minutes the server asks for', async () => {
    const body = {
      clerk_error: { type: 'forbidden', reason: 'reverification-error', metadata: { reverification: { level: 'first_factor', afterMinutes: 10 } } },
      code: 'step_up_required',
      detail: "Confirm it's you to continue: this action needs a sign-in from the last 10 minutes.",
    }
    const ran = await submit(mockFetch(() => jsonResponse(403, body)), WITH_TOKEN)
    expect(ran.code).toBe(1)
    expect(ran.err).toContain(body.detail)
    expect(ran.err.join('\n')).toContain('signed in to Automatos within the last 10 minutes')
  })

  it('prints the 403 for a caller step-up cannot confirm, and the plain 403 sentences', async () => {
    const keys = { detail: { code: 'step_up_unavailable', message: 'This action needs a person signed in to Automatos; keys cannot confirm it.' } }
    const keyRun = await submit(mockFetch(() => jsonResponse(403, keys)), NO_TOKEN)
    expect(keyRun.err).toContain(keys.detail.message)
    const off = await submit(mockFetch(() => jsonResponse(403, { detail: 'The theme Marketplace is turned off on this platform.' })), WITH_TOKEN)
    expect(off.code).toBe(1)
    expect(off.err).toContain('The theme Marketplace is turned off on this platform.')
  })

  it('prints a busy 503 with its Retry-After, and a 422 field by field', async () => {
    const busy = { detail: 'Theme reviews are busy right now. Try again in a minute.' }
    const busyRun = await submit(mockFetch(() => jsonResponse(503, busy, { 'retry-after': '30' })), WITH_TOKEN)
    expect(busyRun.err[0]).toContain('could not take the submission (503')
    expect(busyRun.err).toContain(busy.detail)
    expect(busyRun.err).toContain('Try again in 30 seconds.')
    const invalid = { detail: [{ loc: ['body', 'file'], msg: 'Field required', type: 'missing' }] }
    const invalidRun = await submit(mockFetch(() => jsonResponse(422, invalid)), WITH_TOKEN)
    expect(invalidRun.err).toContain('  body.file: Field required')
  })

  it('prints an answer that is not JSON, and reports a redirect without following it', async () => {
    const html = await submit(mockFetch(() => new Response('<html>Bad gateway</html>', { status: 502 })), WITH_TOKEN)
    expect(html.code).toBe(1)
    expect(html.err.join('\n')).toContain('(The answer was not JSON.) <html>Bad gateway</html>')
    const moved = await submit(mockFetch(() => new Response(null, { status: 302, headers: { location: 'https://app.example.test/sign-in' } })), WITH_TOKEN)
    expect(moved.code).toBe(1)
    expect(moved.calls).toHaveLength(1)
    expect(moved.err.join('\n')).toContain('redirect (302) to https://app.example.test/sign-in')
  })

  it('replaces control characters in what the server sent', async () => {
    const ran = await submit(mockFetch(() => jsonResponse(409, { detail: 'Taken\u001b[2J by another publisher.' })), WITH_TOKEN)
    expect(ran.err).toContain('Taken [2J by another publisher.')
  })

  it('exits 1 with the reason when no answer comes back', async () => {
    const refused = Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } })
    const ran = await submit(failingFetch(refused), WITH_TOKEN)
    expect(ran.code).toBe(1)
    expect(ran.err.join('\n')).toContain(`No answer from ${API}: fetch failed (ECONNREFUSED).`)
  })
})

describe('submit: the token is never printed', () => {
  const answers: Array<[string, () => Response]> = [
    ['201', () => jsonResponse(201, PENDING)],
    ['400', () => jsonResponse(400, { detail: { message: 'refused', errors: [{ code: 'X', path: 'theme.json', message: TOKEN }] } })],
    ['401', () => jsonResponse(401, { detail: `Invalid token ${TOKEN}` })],
    ['403', () => jsonResponse(403, { detail: `Bearer ${TOKEN} is stale` })],
    ['409', () => jsonResponse(409, { detail: 'One open submission' })],
    ['502', () => new Response(`upstream said ${TOKEN}`, { status: 502 })],
  ]

  it.each(answers)('not after a %s, even when the server repeats it', async (_status, respond) => {
    const ran = await submit(mockFetch(respond), WITH_TOKEN)
    expect(printed(ran)).not.toContain(TOKEN)
  })

  it('not when the server repeats it, which is shown masked', async () => {
    const ran = await submit(mockFetch(() => jsonResponse(401, { detail: `Invalid token ${TOKEN}` })), WITH_TOKEN)
    expect(ran.err).toContain(`Invalid token ${SECRET_MASK}`)
  })

  it('not in a network error that quotes it', async () => {
    const ran = await submit(failingFetch(new TypeError(`bad header Bearer ${TOKEN}`)), WITH_TOKEN)
    expect(printed(ran)).not.toContain(TOKEN)
  })

  it('not when the token itself is refused before sending', async () => {
    const bad = `${TOKEN}\nX-Injected: 1`
    const ran = await submit(mockFetch(() => jsonResponse(201, PENDING)), { [ENV_URL]: API, [ENV_TOKEN]: bad })
    expect(ran.code).toBe(2)
    expect(ran.calls).toHaveLength(0)
    expect(printed(ran)).not.toContain(TOKEN)
    expect(ran.err.join('\n')).toContain(`${ENV_TOKEN} holds spaces or characters`)
  })
})

describe('submit: usage and environment', () => {
  it.each([[['submit']], [['submit', 'a.autotheme', 'b.autotheme']], [['submit', 'a.autotheme', '--force']]])(
    'exits 2 on %j and sends nothing',
    async (argv) => {
      const ran = await submit(mockFetch(() => jsonResponse(201, PENDING)), WITH_TOKEN, argv)
      expect(ran.code).toBe(2)
      expect(ran.err).toEqual([SUBMIT_USAGE])
      expect(ran.calls).toHaveLength(0)
    },
  )

  it.each<[string, Environment, string]>([
    ['no API address', { [ENV_TOKEN]: TOKEN }, `${ENV_URL} is not set`],
    ['an address that is not a URL', { [ENV_URL]: 'api.example.test', [ENV_TOKEN]: TOKEN }, `${ENV_URL} is not a URL`],
    ['plain http to another machine with a token', { [ENV_URL]: 'http://api.example.test', [ENV_TOKEN]: TOKEN }, 'unencrypted'],
    ['a user in the address', { [ENV_URL]: 'https://me:secret@api.example.test', [ENV_TOKEN]: TOKEN }, 'user or password'],
    ['a query in the address', { [ENV_URL]: `${API}/?key=1`, [ENV_TOKEN]: TOKEN }, 'no query or fragment'],
    ['a workspace that is not a UUID', { ...WITH_TOKEN, [ENV_WORKSPACE]: 'mine' }, `${ENV_WORKSPACE} must be a workspace id`],
  ])('exits 2 on %s and sends nothing', async (_case, env, message) => {
    const ran = await submit(mockFetch(() => jsonResponse(201, PENDING)), env)
    expect(ran.code).toBe(2)
    expect(ran.calls).toHaveLength(0)
    expect(ran.err.join('\n')).toContain(message)
    expect(printed(ran)).not.toContain('secret')
  })

  it('exits 2 when the package file is missing', async () => {
    const ran = await submit(mockFetch(() => jsonResponse(201, PENDING)), WITH_TOKEN, ['submit', 'missing.autotheme'])
    expect(ran.code).toBe(2)
    expect(ran.calls).toHaveLength(0)
    expect(ran.err.join('\n')).toContain("missing.autotheme can't be read.")
  })

  it('is listed in the command usage, and pack still runs through run()', async () => {
    expect(USAGE).toContain(SUBMIT_USAGE)
    const ran = await submit(mockFetch(() => jsonResponse(201, PENDING)), WITH_TOKEN, ['pack'])
    expect(ran.code).toBe(2)
    expect(ran.err).toEqual([USAGE])
  })

  it('submitCommand reads only its own arguments', async () => {
    const err: string[] = []
    const mock = mockFetch(() => jsonResponse(201, PENDING))
    const code = await submitCommand(['pack', PACKAGE_NAME], { out: () => undefined, err: (line) => err.push(line) },
      { env: WITH_TOKEN, fetch: mock.fetch, cwd: packageFolder() })
    expect(code).toBe(2)
    expect(mock.calls).toHaveLength(0)
  })
})
