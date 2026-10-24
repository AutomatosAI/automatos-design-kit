/**
 * `automatos-theme pack --watch` (PRD-261 B-02i): the theme's build and the pack, now and after each change under
 * src/. Over a copy of core's hello theme with a src/ (made-up files, in the system temp folder), Node's own fs.watch
 * and a stand-in build that counts its runs, with the real pack: a burst of changes is one build and one pack; a
 * change while a cycle runs is one more cycle after it, never two; a dotfile is no change, and a folder made under
 * src/ is watched too; a refused pack prints every reason and the watch goes on; so does a failed or broken build,
 * which packs nothing. Then the arguments, through the command table's pack row.
 */
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PACK_USAGE, run, type CommandDeps } from '../src/cli-main.ts'
import {
  buildFailedLine, parsePackWatch, REFUSED_LINE, runPackWatch, watchingLine, type PackWatchTools,
} from '../src/pack-watch.ts'

const HELLO_DIR = fileURLToPath(new URL('./fixtures/core/hello/', import.meta.url))
const HELLO_FILES = ['automatos-e2e.hello-1.0.0.autotheme', 'automatos-e2e.hello-1.0.0.sha256.json']
const SRC_FILES: Readonly<Record<string, string>> = {
  'entry.ts': "import './theme.css'\nexport { mount } from './lib/mount'\n",
  'theme.css': '.hello-frame { min-height: 100vh; }\n',
  'lib/mount.ts': 'export function mount(): void {}\n',
}
const DEBOUNCE_MS = 40
/** Long enough after a burst for another cycle to have started, were one coming. */
const QUIET_MS = DEBOUNCE_MS * 8
const WAIT = Object.freeze({ timeout: 5_000, interval: 10 })
const TEST_TIMEOUT_MS = 20_000
const STOPPED_LINE = 'automatos-theme pack --watch: stopped.'
const FAILED_BUILD = 3

/** The stand-in build's answer to its nth run (from 1): an exit code, or a throw. */
type BuildAnswer = (nth: number) => Promise<number>

interface Session {
  readonly theme: string
  readonly out: string
  readonly outLines: readonly string[]
  readonly errLines: readonly string[]
  readonly builds: () => number
  /** How many packages the pack wrote: its first line each time. */
  readonly packs: () => number
  /** Stops the watch; resolves to its exit code. */
  readonly stop: () => Promise<number>
}

const folders: string[] = []
const sessions: Session[] = []

afterEach(async () => {
  await Promise.all(sessions.splice(0).map((session) => session.stop()))
  folders.splice(0).forEach((folder) => rmSync(folder, { recursive: true, force: true }))
})

function tempFolder(): string {
  const folder = mkdtempSync(join(tmpdir(), 'automatos-pack-watch-'))
  folders.push(folder)
  return folder
}

/** Core's hello theme with a src/, to change in a test. */
function helloWithSrc(): string {
  const theme = join(tempFolder(), 'hello')
  cpSync(HELLO_DIR, theme, { recursive: true })
  Object.entries(SRC_FILES).forEach(([path, text]) => {
    mkdirSync(join(theme, 'src', path, '..'), { recursive: true })
    writeFileSync(join(theme, 'src', path), text)
  })
  return theme
}

const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms))
const deps = (cwd: string): CommandDeps => ({ env: { KEEP: 'kept' }, fetch: globalThis.fetch, cwd })

/** `pack --watch` over a fresh hello copy, its build answering `answer` (exit 0 unless given). */
function start(answer: BuildAnswer = async () => 0): Session {
  const theme = helloWithSrc()
  const out = tempFolder()
  const outLines: string[] = []
  const errLines: string[] = []
  let built = 0
  let stopWatch: () => void = () => undefined
  const stopped = new Promise<void>((done) => {
    stopWatch = done
  })
  const tools: PackWatchTools = {
    build: async (themeDir, env) => {
      built += 1
      expect([themeDir, env.KEEP]).toEqual([theme, 'kept'])
      return answer(built)
    },
    until: () => stopped,
    watch: { debounceMs: DEBOUNCE_MS },
  }
  const output = { out: (line: string) => outLines.push(line), err: (line: string) => errLines.push(line) }
  const exit = runPackWatch(['pack', theme, '--out', out, '--watch'], output, deps(theme), () => tools)
  const packed = `${join(out, HELLO_FILES[0])} `
  const session: Session = {
    theme, out, outLines, errLines,
    builds: () => built,
    packs: () => outLines.filter((line) => line.startsWith(packed)).length,
    stop: () => {
      stopWatch()
      return exit
    },
  }
  sessions.push(session)
  return session
}

/** Waits for the session to have run `builds` builds and written `packs` packages, then for quiet, and checks both again. */
async function settlesAt(session: Session, builds: number, packs: number): Promise<void> {
  await vi.waitFor(() => expect([session.builds(), session.packs()]).toEqual([builds, packs]), WAIT)
  await sleep(QUIET_MS)
  expect([session.builds(), session.packs()], 'nothing more ran once quiet').toEqual([builds, packs])
}

describe('pack --watch', () => {
  it('builds and packs now, then once per burst of changes under src/', async () => {
    const session = start()
    await settlesAt(session, 1, 1)
    expect(session.outLines[0]).toBe(watchingLine(join(session.theme, 'src')))
    writeFileSync(join(session.theme, 'src/entry.ts'), "import './theme.css'\nexport const changed = 1\n")
    writeFileSync(join(session.theme, 'src/theme.css'), '.hello-frame { min-height: 50vh; }\n')
    writeFileSync(join(session.theme, 'src/lib/mount.ts'), 'export function mount(): number { return 1 }\n')
    await settlesAt(session, 2, 2)
    expect(readdirSync(session.out).sort()).toEqual(HELLO_FILES)
    expect(session.errLines).toEqual([])
    expect(await session.stop()).toBe(0)
    expect(session.outLines.at(-1)).toBe(STOPPED_LINE)
  }, TEST_TIMEOUT_MS)

  it('runs one more cycle after a change made while a cycle runs, never two at once', async () => {
    let release: () => void = () => undefined
    const held = new Promise<void>((done) => {
      release = done
    })
    const session = start(async (nth) => {
      if (nth === 2) await held
      return 0
    })
    await settlesAt(session, 1, 1)
    writeFileSync(join(session.theme, 'src/theme.css'), '.a {}\n')
    await vi.waitFor(() => expect(session.builds()).toBe(2), WAIT)
    writeFileSync(join(session.theme, 'src/theme.css'), '.b {}\n')
    await sleep(QUIET_MS)
    writeFileSync(join(session.theme, 'src/lib/mount.ts'), 'export function mount(): void {}\n// again\n')
    await sleep(QUIET_MS)
    expect([session.builds(), session.packs()], 'the held build runs alone').toEqual([2, 1])
    release()
    await settlesAt(session, 3, 3)
  }, TEST_TIMEOUT_MS)

  it('takes no change from a dotfile, and watches a folder made under src/', async () => {
    const session = start()
    await settlesAt(session, 1, 1)
    writeFileSync(join(session.theme, 'src/.entry.ts.swp'), 'an editor swap file')
    mkdirSync(join(session.theme, 'src/.cache'))
    await settlesAt(session, 1, 1)
    mkdirSync(join(session.theme, 'src/parts'))
    await settlesAt(session, 2, 2)
    writeFileSync(join(session.theme, 'src/parts/part.ts'), 'export const part = 1\n')
    await settlesAt(session, 3, 3)
  }, TEST_TIMEOUT_MS)

  it('prints every reason of a refused pack, then packs again after the fix', async () => {
    const session = start()
    await settlesAt(session, 1, 1)
    writeFileSync(join(session.theme, 'src/notes.bin'), Buffer.from([0, 1, 2, 3]))
    await vi.waitFor(() => expect(session.errLines).toContain(REFUSED_LINE), WAIT)
    expect(session.errLines[0]).toBe(`${session.theme} can't be packed: the Automatos server would refuse it.`)
    expect(session.errLines.filter((line) => line.startsWith('  SOURCE_NOT_ALLOWED src/notes.bin: '))).toHaveLength(1)
    expect([session.builds(), session.packs()]).toEqual([2, 1])
    rmSync(join(session.theme, 'src/notes.bin'))
    await settlesAt(session, 3, 2)
  }, TEST_TIMEOUT_MS)

  it('packs nothing after a failed or a broken build, and goes on watching', async () => {
    const session = start(async (nth) => {
      if (nth === 2) return FAILED_BUILD
      if (nth === 3) throw new Error('the stand-in build broke')
      return 0
    })
    await settlesAt(session, 1, 1)
    writeFileSync(join(session.theme, 'src/theme.css'), '.a {}\n')
    await settlesAt(session, 2, 1)
    expect(session.errLines).toEqual([buildFailedLine(FAILED_BUILD)])
    writeFileSync(join(session.theme, 'src/theme.css'), '.b {}\n')
    await settlesAt(session, 3, 1)
    expect(session.errLines[1]).toBe('automatos-theme pack --watch: the stand-in build broke; still watching.')
    writeFileSync(join(session.theme, 'src/theme.css'), '.c {}\n')
    await settlesAt(session, 4, 2)
  }, TEST_TIMEOUT_MS)
})

describe('pack --watch arguments', () => {
  const cwd = '/kit/themes'

  it('takes the theme folder, --out and --watch', () => {
    expect(parsePackWatch(['pack', 'play', '--watch'], cwd)).toEqual({ themeDir: resolve(cwd, 'play'), outDir: cwd })
    expect(parsePackWatch(['pack', 'play', '--watch', '--out', 'out'], cwd)).toEqual({
      themeDir: resolve(cwd, 'play'), outDir: resolve(cwd, 'out'),
    })
  })

  it.each([
    [['pack', '--watch']], [['pack', 'a', 'b', '--watch']], [['pack', 'a', '--watch', '--zip']], [['pack', 'a']],
    [['pack', 'a', '--out', '--watch']], [['pack', 'a', '--watch=yes']], [['dev', 'a', '--watch']],
  ])('%j is no pack --watch', (argv) => {
    expect(parsePackWatch(argv, cwd)).toBeNull()
  })

  it('is the command table\'s pack row: a usage error with --watch, and a folder with no src/, watch nothing', async () => {
    const err: string[] = []
    const output = { out: () => undefined, err: (line: string) => err.push(line) }
    expect(await run(['pack', '--watch'], output, deps(process.cwd()))).toBe(2)
    expect(err).toEqual([PACK_USAGE])
    const bare = join(tempFolder(), 'hello')
    cpSync(HELLO_DIR, bare, { recursive: true })
    expect(await run(['pack', bare, '--watch'], output, deps(bare))).toBe(1)
    expect(err[1]).toBe(`automatos-theme pack --watch: ${bare} has no src/ folder to watch.`)
  })
})
