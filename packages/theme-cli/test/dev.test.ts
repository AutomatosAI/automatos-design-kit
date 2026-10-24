/**
 * `automatos-theme dev` (PRD-261 B-02i). The arguments; a folder the harness can't draw, and a port in use, refused
 * before anything is built. Then, over a stand-in harness build (made-up files in the system temp folder) and the real
 * node:http server on 127.0.0.1: 503 until a build passed, then only that build is served, never the theme folder,
 * the harness or anything outside them, however the path is spelled. A change under src/ builds again and the new
 * build is served (the old one goes); a failed build leaves the last good one served; stopping closes the port and
 * removes the builds. Kit CI's harness job runs the real command over Play (theme-harness shots/dev-smoke.spec.ts).
 */
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { request as httpRequest, type IncomingHttpHeaders } from 'node:http'
import { createServer, type Server } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { DEV_PORT, HARNESS_HOST, THEME_ENV } from '@automatos/theme-harness/router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { run, type CommandDeps } from '../src/cli-main.ts'
import {
  BUILDS_DIR, DEV_USAGE, failedLine, installedDevTools, parseDev, readyLine, rebuiltLine, runDev, type DevTools,
} from '../src/dev.ts'
import { HARNESS_BUILD_CONFIG } from '../src/shots.ts'

const SECRET = 'not for the browser'
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const WAIT = Object.freeze({ timeout: 5_000, interval: 10 })
const DEBOUNCE_MS = 40
const TEST_TIMEOUT_MS = 20_000
const ORIGIN_IN_LINE = /http:\/\/127\.0\.0\.1:(\d+)\//
const FAILED_BUILD = 4

interface Answer {
  readonly status: number
  readonly headers: IncomingHttpHeaders
  readonly body: string
}

const folders: string[] = []
const stops: (() => Promise<unknown>)[] = []

afterEach(async () => {
  await Promise.all(stops.splice(0).map((stop) => stop()))
  folders.splice(0).forEach((folder) => rmSync(folder, { recursive: true, force: true }))
})

function tempFolder(): string {
  const folder = mkdtempSync(join(tmpdir(), 'automatos-dev-'))
  folders.push(folder)
  return folder
}

function writeFile(path: string, data: string | Buffer): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, data)
}

/** A theme folder (no default look, so no presets to build), with a secret beside its src/, and the harness's folder. */
function folderPair(): { readonly theme: string; readonly harness: string; readonly outside: string } {
  const root = tempFolder()
  const theme = join(root, 'theme')
  writeFile(join(theme, 'theme.json'), JSON.stringify({ id: 'acme/sample', htmlClass: 'sample' }))
  writeFile(join(theme, 'src/entry.ts'), 'export default {}\n')
  writeFile(join(theme, 'secret.txt'), SECRET)
  const harness = join(root, 'harness')
  writeFile(join(harness, HARNESS_BUILD_CONFIG), `// ${SECRET}\n`)
  const outside = join(root, 'outside/secret.txt')
  writeFile(outside, SECRET)
  return { theme, harness, outside }
}

/** What the harness build writes, numbered: the page, a script, an asset, a dotfile and a link out of the build. */
function standInBuild(outDir: string, count: number, outside: string): void {
  writeFile(join(outDir, 'index.html'), `<p>build ${count}</p>`)
  writeFile(join(outDir, 'harness/app.js'), `export const build = ${count}\n`)
  writeFile(join(outDir, 'assets/mascot.png'), PNG)
  writeFile(join(outDir, '.hidden.txt'), SECRET)
  symlinkSync(outside, join(outDir, 'harness/link.js'))
}

/** One GET (or `method`) of `path` exactly as written: no client tidies it first. */
function ask(port: number, path: string, method = 'GET'): Promise<Answer> {
  return new Promise((done, fail) => {
    const sent = httpRequest({ host: HARNESS_HOST, port, path, method, agent: false }, (response) => {
      const chunks: Buffer[] = []
      response.on('data', (chunk: Buffer) => chunks.push(chunk))
      response.on('end', () => {
        done({ status: response.statusCode ?? 0, headers: response.headers, body: Buffer.concat(chunks).toString() })
      })
    })
    sent.on('error', fail)
    sent.end()
  })
}

interface Dev {
  readonly theme: string
  readonly outside: string
  readonly sessions: () => string[]
  readonly outDirs: readonly string[]
  readonly outLines: readonly string[]
  readonly errLines: readonly string[]
  readonly port: () => number
  readonly origin: () => string
  readonly stop: () => Promise<number>
  readonly exit: Promise<number>
}

/** `dev` over a fresh folder pair on `port`; each build waits for `gate` (if any), then answers `codes` in turn (0 after). */
function startDev(port: string, codes: readonly number[] = [], gate?: Promise<void>): Dev {
  const { theme, harness, outside } = folderPair()
  const [outLines, errLines, outDirs]: [string[], string[], string[]] = [[], [], []]
  let stopDev: () => void = () => undefined
  const stopped = new Promise<void>((done) => {
    stopDev = done
  })
  const tools: DevTools = {
    harnessDir: harness,
    build: async (themeDir, outDir, env) => {
      outDirs.push(outDir)
      expect([themeDir, env.KEEP]).toEqual([theme, 'kept'])
      await gate
      const code = codes[outDirs.length - 1] ?? 0
      if (code === 0) standInBuild(outDir, outDirs.length, outside)
      return code
    },
    until: () => stopped,
    watch: { debounceMs: DEBOUNCE_MS },
  }
  const deps: CommandDeps = { env: { KEEP: 'kept' }, fetch: globalThis.fetch, cwd: dirname(theme) }
  const output = { out: (line: string) => outLines.push(line), err: (line: string) => errLines.push(line) }
  const exit = runDev(['dev', 'theme', '--port', port], output, deps, () => tools)
  const portNow = (): number => Number(ORIGIN_IN_LINE.exec(outLines[0] ?? '')?.[1] ?? Number.NaN)
  const stop = (): Promise<number> => {
    stopDev()
    return exit
  }
  stops.push(stop)
  const sessions = (): string[] => (existsSync(join(harness, BUILDS_DIR)) ? readdirSync(join(harness, BUILDS_DIR)) : [])
  const origin = (): string => `http://${HARNESS_HOST}:${portNow()}`
  return { theme, outside, sessions, outDirs, outLines, errLines, port: portNow, origin, stop, exit }
}

/** A dev session on a free port whose first build is in. */
async function readyDev(codes: readonly number[] = []): Promise<Dev> {
  const dev = startDev('0', codes)
  await vi.waitFor(() => expect(dev.outLines).toContain(readyLine(dev.origin())), WAIT)
  return dev
}

const bareDeps = (cwd: string): CommandDeps => ({ env: {}, fetch: globalThis.fetch, cwd })

/** A port another server holds on 127.0.0.1, and its release. */
function heldPort(): Promise<{ readonly port: number; readonly server: Server }> {
  return new Promise((done) => {
    const server = createServer()
    server.listen(0, HARNESS_HOST, () => {
      const address = server.address()
      done({ port: typeof address === 'object' && address !== null ? address.port : 0, server })
    })
  })
}

describe('dev arguments', () => {
  const cwd = '/kit'

  it('takes a theme folder and a port, DEV_PORT unless --port names one (0 picks a free one)', () => {
    expect(parseDev(['dev', 'themes/play'], cwd)).toEqual({ themeDir: resolve(cwd, 'themes/play'), port: DEV_PORT })
    expect(parseDev(['dev', 'themes/play', '--port', '5000'], cwd)?.port).toBe(5000)
    expect(parseDev(['dev', 'a', '--port', '0'], cwd)?.port).toBe(0)
    expect(parseDev(['dev', 'a', '--port', '65535'], cwd)?.port).toBe(65535)
  })

  it.each([
    [['dev']], [['dev', 'a', 'b']], [['dev', 'a', '--port']], [['dev', 'a', '--port', 'http']], [['dev', 'a', '--port', '65536']],
    [['dev', 'a', '--port', '-1']], [['dev', 'a', '--port', '1.5']], [['dev', 'a', '--port', '']], [['dev', 'a', '--watch']],
    [['shots', 'a']],
  ])('%j is a usage error, and nothing listens or builds', async (argv) => {
    expect(parseDev(argv, cwd)).toBeNull()
    const err: string[] = []
    const noTools = (): DevTools => {
      throw new Error('no tools for a usage error')
    }
    const code = await runDev(argv, { out: () => undefined, err: (line) => err.push(line) }, bareDeps(cwd), noTools)
    expect([code, err]).toEqual([2, [DEV_USAGE]])
  })

  it("is the command table's dev row", async () => {
    const err: string[] = []
    const code = await run(['dev'], { out: () => undefined, err: (line) => err.push(line) }, bareDeps(cwd))
    expect([code, err]).toEqual([2, [DEV_USAGE]])
  })

  it("builds with the kit's own harness and Vite: vite build from the harness, the theme in its environment", async () => {
    const ran: { script: string; args: readonly string[]; cwd: string; env: NodeJS.ProcessEnv }[] = []
    const tools = installedDevTools(async (script, args, options) => {
      ran.push({ script, args, cwd: options.cwd, env: options.env })
      return 0
    })
    const config = join(tools.harnessDir, HARNESS_BUILD_CONFIG)
    expect(existsSync(config)).toBe(true)
    expect(await tools.build('/kit/themes/play', '/kit/out/build-1', { KEEP: 'kept' })).toBe(0)
    expect(ran).toHaveLength(1)
    expect(existsSync(ran[0]?.script ?? '')).toBe(true)
    expect(ran[0]?.args).toEqual(['build', '--config', config, '--outDir', '/kit/out/build-1'])
    expect(ran[0]?.cwd).toBe(tools.harnessDir)
    expect([ran[0]?.env[THEME_ENV], ran[0]?.env.KEEP]).toEqual(['/kit/themes/play', 'kept'])
  })
})

describe('dev refuses before it builds', () => {
  it('a folder the harness cannot draw: no theme.json, or a default look with no presets built', async () => {
    const err: string[] = []
    const output = { out: () => undefined, err: (line: string) => err.push(line) }
    const empty = tempFolder()
    const noTools = (): DevTools => {
      throw new Error('nothing is built for a folder the harness cannot draw')
    }
    expect(await runDev(['dev', empty], output, bareDeps(empty), noTools)).toBe(1)
    expect(err[0]).toBe(`${empty} has no theme.json: dev draws a theme folder.`)
    const { theme } = folderPair()
    writeFile(join(theme, 'theme.json'), JSON.stringify({ id: 'acme/sample', htmlClass: 'sample', look: 'dusk' }))
    expect(await runDev(['dev', theme], output, bareDeps(theme), noTools)).toBe(1)
    expect(err[1]).toContain("run the theme's build first")
  })

  it('a port in use: one sentence naming it and --port, nothing built', async () => {
    const held = await heldPort()
    try {
      const dev = startDev(String(held.port))
      expect(await dev.exit).toBe(1)
      expect(dev.errLines).toEqual([
        `automatos-theme dev: ${HARNESS_HOST}:${held.port} is in use, so the harness can't be served there: stop what runs on it, or pick another --port <n>.`,
      ])
      expect([dev.outLines, dev.outDirs, dev.sessions()]).toEqual([[], [], []])
    } finally {
      held.server.close()
    }
  })
})

describe('dev serves the last build that passed, and nothing else', () => {
  it('answers 503 until the first build is in, then the page, its files and assets', async () => {
    let release: () => void = () => undefined
    const dev = startDev('0', [], new Promise<void>((done) => {
      release = done
    }))
    await vi.waitFor(() => expect(dev.outDirs).toHaveLength(1), WAIT)
    expect((await ask(dev.port(), '/')).status).toBe(503)
    release()
    await vi.waitFor(() => expect(dev.outLines).toContain(readyLine(dev.origin())), WAIT)
    const page = await ask(dev.port(), '/?path=/chat&preset=ember')
    expect([page.status, page.body, page.headers['content-type'], page.headers['cache-control']]).toEqual([
      200, '<p>build 1</p>', 'text/html; charset=utf-8', 'no-store',
    ])
    expect((await ask(dev.port(), '/harness/app.js')).headers['content-type']).toBe('text/javascript; charset=utf-8')
    const asset = await ask(dev.port(), '/assets/mascot.png')
    expect([asset.status, asset.headers['content-type'], asset.headers['content-length']]).toEqual([200, 'image/png', String(PNG.length)])
  }, TEST_TIMEOUT_MS)

  it('never serves the theme folder, the harness, or a path outside the build, however it is spelled', async () => {
    const dev = await readyDev()
    const build = dev.outDirs[0] ?? ''
    const up = relative(build, dev.outside)
    const escaped = up.split('/').join('%2F')
    const paths = [
      '/theme.json', '/src/entry.ts', '/secret.txt', `/${HARNESS_BUILD_CONFIG}`, '/package.json',
      `/${up}`, `/${escaped}`, `/harness/${escaped}`, `/${up.replaceAll('..', '%2e%2e')}`, `/${escaped.replaceAll('..', '%2E%2E')}`,
      `/${encodeURIComponent(dev.outside)}`, `//${dev.outside}`, '/harness/link.js', '/.hidden.txt', '/harness', '/harness/',
      '/assets/..%5C..%5Csecret.txt', '/%00', '/%E0%A4%A',
    ]
    for (const path of paths) {
      const answer = await ask(dev.port(), path)
      expect([path, answer.status], path).toEqual([path, 404])
      expect(answer.body, path).not.toContain(SECRET)
    }
    expect((await ask(dev.port(), '/', 'POST')).status).toBe(405)
  }, TEST_TIMEOUT_MS)

  it('builds again after a change under src/ and serves the new build; a failed build leaves the last good one', async () => {
    const dev = await readyDev([0, 0, FAILED_BUILD])
    writeFileSync(join(dev.theme, 'src/entry.ts'), 'export default { changed: true }\n')
    await vi.waitFor(() => expect(dev.outLines).toContain(rebuiltLine(dev.origin())), WAIT)
    expect((await ask(dev.port(), '/')).body).toBe('<p>build 2</p>')
    expect(existsSync(dev.outDirs[0] ?? ''), 'the build before it is gone').toBe(false)
    writeFileSync(join(dev.theme, 'src/entry.ts'), 'export default { changed: 2 }\n')
    const failed = failedLine(`failed (exit code ${FAILED_BUILD})`, dev.origin(), true)
    await vi.waitFor(() => expect(dev.errLines).toEqual([failed]), WAIT)
    expect((await ask(dev.port(), '/')).body).toBe('<p>build 2</p>')
    expect(dev.outDirs).toHaveLength(3)
  }, TEST_TIMEOUT_MS)

  it('stops on its signal: the port closes and the builds are removed', async () => {
    const dev = await readyDev()
    expect(dev.sessions()).toHaveLength(1)
    const port = dev.port()
    expect(await dev.stop()).toBe(0)
    expect(dev.outLines.at(-1)).toBe('automatos-theme dev: stopped.')
    expect(dev.sessions()).toEqual([])
    await expect(ask(port, '/')).rejects.toThrow(/ECONNREFUSED/)
  }, TEST_TIMEOUT_MS)
})
