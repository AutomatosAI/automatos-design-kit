/**
 * `automatos-theme dev <theme folder> [--port <n>]` (PRD-261 B-02i): the kit's browser harness (packages/theme-harness,
 * the mock host page `shots` photographs) as a local app to build a theme in, with nothing of Automatos running.
 *
 * - It listens first, on 127.0.0.1 (this machine only) and the port (default DEV_PORT, 4319, beside the shots'
 *   4318; 0 picks a free one), so a port in use is refused before anything is built.
 * - Then it builds the harness for the folder as `shots` does (`vite build --config vite.harness.config.ts` from the
 *   harness's folder, AUTOMATOS_HARNESS_THEME naming the theme), each build into a fresh folder of its own under the
 *   harness's dist/, and serves the last build that passed and nothing else (dev-server.ts). Until one has passed,
 *   every request is answered 503.
 * - Each change under the theme's src/ builds again (watch.ts: one build per burst of changes, never two at once).
 *   A build that fails is printed and the last good one stays served. Reload the page to see a new build.
 *
 * The harness draws the folder's look data (looks/, boot/) as the theme's own build last wrote it: after changing the
 * looks, run that build (`pack --watch` runs it on each change), and the next change under src/ draws them. A live
 * link into a real host stays out (Q27): to see the theme in Automatos, `pack` it and `install` it.
 *
 * Exit code 0 once stopped (Ctrl-C), 1 when the folder is no theme folder, its look data isn't built yet or the port
 * can't be served, 2 for a usage error.
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { DEV_PORT, HARNESS_HOST, THEME_ENV } from '@automatos/theme-harness/router'
import type { CommandDeps } from './cli-main.ts'
import { INDEX_FILE, listenDev } from './dev-server.ts'
import type { Output } from './output.ts'
import { runNodeScript, type StepOptions } from './run-step.ts'
import { binOf, HARNESS_BUILD_CONFIG, themeFolderProblem } from './shots.ts'
import { SOURCE_DIR } from './source.ts'
import { untilStopped, watchCycles, type WatchOptions } from './watch.ts'

export const DEV_USAGE = 'usage: automatos-theme dev <theme folder> [--port <n>]'
const EXIT_OK = 0
const EXIT_REFUSED = 1
const EXIT_USAGE = 2
const PREFIX = 'automatos-theme dev'
const COMMAND = 'dev'
const PORT_TEXT = /^\d{1,5}$/
const MAX_PORT = 65_535
/** Where the builds go: the harness's dist/ (git ignores every package's), one folder per session. */
export const BUILDS_DIR = 'dist'
export const SESSION_PREFIX = 'dev-'
const BUILD_PREFIX = 'build-'

/** What `dev` builds with, where, and when it stops. */
export interface DevTools {
  /** The harness package's folder: its dist/ holds the builds. */
  readonly harnessDir: string
  /** One harness build of `themeDir` into `outDir`; resolves to its exit code. */
  readonly build: (themeDir: string, outDir: string, env: NodeJS.ProcessEnv) => Promise<number>
  /** Resolves when the server should stop: Ctrl-C, for the real command. */
  readonly until: () => Promise<void>
  readonly watch?: WatchOptions
}

/** Runs one Node script (run-step.ts runNodeScript, unless a test gives another); resolves to its exit code. */
export type RunScript = (script: string, args: readonly string[], options: StepOptions) => Promise<number>

/**
 * The real command's tools: the harness and Vite from the kit's install, each build `vite build` from the harness's
 * folder with the theme folder in AUTOMATOS_HARNESS_THEME and the build's own --outDir, stopped by Ctrl-C.
 */
export function installedDevTools(runScript: RunScript = runNodeScript): DevTools {
  const require = createRequire(import.meta.url)
  const harnessDir = dirname(require.resolve('@automatos/theme-harness/package.json'))
  const viteBin = binOf(require, 'vite', 'vite')
  const config = join(harnessDir, HARNESS_BUILD_CONFIG)
  const build: DevTools['build'] = (themeDir, outDir, env) => {
    const args = ['build', '--config', config, '--outDir', outDir]
    return runScript(viteBin, args, { cwd: harnessDir, env: { ...env, [THEME_ENV]: themeDir } })
  }
  return { harnessDir, build, until: untilStopped }
}

interface DevArgs {
  readonly themeDir: string
  readonly port: number
}

/** A port from its text: a whole number up to 65535 (0 picks a free one), or null. */
function portOf(text: string): number | null {
  if (!PORT_TEXT.test(text)) return null
  const port = Number(text)
  return port <= MAX_PORT ? port : null
}

/** The folder and port from `dev <theme folder> [--port <n>]`, or null when the arguments don't make one. */
export function parseDev(argv: readonly string[], cwd: string): DevArgs | null {
  try {
    const { positionals, values } = parseArgs({ args: [...argv], allowPositionals: true, options: { port: { type: 'string' } } })
    const [command, themeDir, ...extra] = positionals
    if (command !== COMMAND || themeDir === undefined || extra.length > 0) return null
    const port = values.port === undefined ? DEV_PORT : portOf(values.port)
    return port === null ? null : { themeDir: resolve(cwd, themeDir), port }
  } catch {
    return null
  }
}

export const servingLine = (themeDir: string, origin: string): string => (
  `${PREFIX}: building the harness for ${themeDir}, to serve on ${origin}/ (this machine only; Ctrl-C stops).`
)
export const readyLine = (origin: string): string => `${PREFIX}: ready on ${origin}/`
export const rebuiltLine = (origin: string): string => `${PREFIX}: rebuilt after a change under ${SOURCE_DIR}/: reload ${origin}/`

/** The line a failed build prints, and what is served after it. */
export function failedLine(why: string, origin: string, serving: boolean): string {
  const after = serving ? `${origin}/ still serves the last build that passed` : 'nothing is served until a build passes'
  return `${PREFIX}: the harness build ${why}; ${after}.`
}

/** Why a build that ended with `code` can't be served (it failed, or wrote no page), or null when it can. */
function buildProblem(code: number, outDir: string): string | null {
  if (code !== EXIT_OK) return `failed (exit code ${code})`
  return existsSync(join(outDir, INDEX_FILE)) ? null : `wrote no ${INDEX_FILE}`
}

/** The builds of one session: each into its own folder; the last that passed is served, and the one before it goes. */
interface Builds {
  readonly served: () => string | null
  readonly cycle: () => Promise<void>
  readonly dispose: () => void
}

function sessionBuilds(themeDir: string, origin: string, output: Output, deps: CommandDeps, tools: DevTools): Builds {
  const sessionsDir = join(tools.harnessDir, BUILDS_DIR)
  mkdirSync(sessionsDir, { recursive: true })
  const sessionDir = mkdtempSync(join(sessionsDir, SESSION_PREFIX))
  let served: string | null = null
  let count = 0
  const cycle = async (): Promise<void> => {
    count += 1
    const outDir = join(sessionDir, `${BUILD_PREFIX}${count}`)
    const why = buildProblem(await tools.build(themeDir, outDir, { ...deps.env }), outDir)
    if (why !== null) {
      rmSync(outDir, { recursive: true, force: true })
      output.err(failedLine(why, origin, served !== null))
      return
    }
    const previous = served
    served = outDir
    if (previous !== null) rmSync(previous, { recursive: true, force: true })
    output.out(previous === null ? readyLine(origin) : rebuiltLine(origin))
  }
  return { served: () => served, cycle, dispose: () => rmSync(sessionDir, { recursive: true, force: true }) }
}

/** `dev` with the tools given (the tests'), or the real ones; resolves to the exit code once stopped. */
export async function runDev(
  argv: readonly string[], output: Output, deps: CommandDeps, tools: () => DevTools = installedDevTools,
): Promise<number> {
  const args = parseDev(argv, deps.cwd)
  if (args === null) {
    output.err(DEV_USAGE)
    return EXIT_USAGE
  }
  const problem = themeFolderProblem(args.themeDir, COMMAND)
  if (problem !== null) {
    output.err(problem)
    return EXIT_REFUSED
  }
  const given = tools()
  const report = (error: unknown): void => {
    output.err(`${PREFIX}: ${error instanceof Error ? error.message : String(error)}`)
  }
  let builds: Builds | null = null
  const root = (): string | null => builds?.served() ?? null
  const listening = await listenDev({ host: HARNESS_HOST, port: args.port, root, onError: report })
  if (!listening.ok) {
    output.err(`${PREFIX}: ${listening.message}`)
    return EXIT_REFUSED
  }
  const origin = `http://${HARNESS_HOST}:${listening.port}`
  output.out(servingLine(args.themeDir, origin))
  const session = sessionBuilds(args.themeDir, origin, output, deps, given)
  builds = session
  const watch = watchCycles(join(args.themeDir, SOURCE_DIR), session.cycle, { ...given.watch, onError: report })
  await given.until()
  await watch.close()
  await listening.close()
  session.dispose()
  output.out(`${PREFIX}: stopped.`)
  return EXIT_OK
}

/** The command table's runner (cli-main.ts COMMANDS). */
export function devCommand(argv: readonly string[], output: Output, deps: CommandDeps): Promise<number> {
  return runDev(argv, output, deps)
}
