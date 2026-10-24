/**
 * The `automatos-theme` command line, as one table (COMMANDS, PRD-261 B-03b): every planned command,
 * the module that holds it and the story that builds it. `pack` runs here and `submit` in submit.ts.
 * Every other command is looked up by its module path when it runs, so the story that builds it
 * writes only that module, exporting the runner its row names: `(argv, output, deps)`, returning the
 * exit code. Until the module is there, the command prints "not built yet (<story>)" and exits 2.
 *
 * `pack <theme folder> [--out <folder>]` checks the theme folder as core's reader would, with its
 * src/ packed as source/, and writes `<publisher>.<slug>-<version>.autotheme` and its `.sha256.json`
 * manifest to `--out` (default: the current folder). Exit code 0 when written (a warning, such as no
 * src/, is printed to stderr as `warning: ...`, one line each), 1 when the theme was refused (every
 * reason is printed, one per line), 2 for a usage error. With `--watch` (PRD-261 B-02i) it builds and
 * packs again after each change under src/ until stopped (pack-watch.ts, loaded only then).
 */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import type { Output } from './output.ts'
import { packTheme, type PackResult } from './pack.ts'
import { submitCommand, SUBMIT_USAGE, type SubmitDeps } from './submit.ts'

export type { Output } from './output.ts'

/** What a command gets beside its arguments: the environment, the network and the folder it runs in. */
export type CommandDeps = SubmitDeps

/** Runs one command from the whole argument list (the command's name first); returns the exit code. */
export type CommandRunner = (argv: readonly string[], output: Output, deps: CommandDeps) => number | Promise<number>

export interface PlannedCommand {
  readonly name: string
  /** The command's own module, relative to this file; a planned command's runner is loaded from it. */
  readonly module: string
  /** The story that builds it. */
  readonly story: string
  /** The command's runner, or null while its module isn't written yet. */
  readonly load: () => Promise<CommandRunner | null>
}

const EXIT_OK = 0
const EXIT_REFUSED = 1
const EXIT_USAGE = 2
export const WARNING_PREFIX = 'warning: '
export const PACK_USAGE = 'usage: automatos-theme pack <theme folder> [--out <folder>] [--watch]'
/** `pack`'s flag that keeps it watching (pack-watch.ts). */
export const WATCH_FLAG = '--watch'
/** The work that builds `skin` (the harness's skin designer and its command) has no lettered story id. */
export const SKIN_DESIGNER_STORY = 'PRD-261 skin designer'

/**
 * The loader of a command another module runs: null while `modulePath` (relative to this file) isn't
 * there, else the function it exports as `runner`. A module without that export breaks the table's
 * contract, and the loader says so.
 */
export function moduleRunner(modulePath: string, runner: string): () => Promise<CommandRunner | null> {
  const url = new URL(modulePath, import.meta.url)
  return async () => {
    if (!existsSync(fileURLToPath(url))) return null
    const loaded = (await import(url.href)) as Readonly<Record<string, unknown>>
    const found = loaded[runner]
    if (typeof found !== 'function') throw new TypeError(`${modulePath} does not export the runner ${runner}.`)
    return found as CommandRunner
  }
}

/** A command whose runner this file imports. */
function built(name: string, modulePath: string, story: string, runner: CommandRunner): PlannedCommand {
  return Object.freeze({ name, module: modulePath, story, load: async () => runner })
}

/** A command found by its module path when it runs: `runner` is the function that module exports. */
function planned(name: string, modulePath: string, story: string, runner: string): PlannedCommand {
  return Object.freeze({ name, module: modulePath, story, load: moduleRunner(modulePath, runner) })
}

/** Every planned command, in the order the usage lists them. */
export const COMMANDS: readonly PlannedCommand[] = Object.freeze([
  built('pack', './pack.ts', 'PRD-261 A-16a', packRunner),
  built('submit', './submit.ts', 'PRD-261 C-01c', submitCommand),
  planned('check', './check/index.ts', 'PRD-261 B-03c', 'checkCommand'),
  planned('install', './install.ts', 'PRD-261 B-03g', 'installCommand'),
  planned('new', './new/index.ts', 'PRD-261 B-03f', 'newCommand'),
  planned('clone', './clone.ts', 'PRD-261 B-04c', 'cloneCommand'),
  planned('brief', './brief.ts', 'PRD-261 B-04a', 'briefCommand'),
  planned('shots', './shots.ts', 'PRD-261 B-02f', 'shotsCommand'),
  planned('previews', './previews.ts', 'PRD-261 B-02g', 'previewsCommand'),
  planned('dev', './dev.ts', 'PRD-261 B-02i', 'devCommand'),
  planned('skin', './skin.ts', SKIN_DESIGNER_STORY, 'skinCommand'),
])

export const USAGE = [PACK_USAGE, SUBMIT_USAGE, `commands: ${COMMANDS.map((item) => item.name).join(', ')}`].join('\n')

/** The one line a planned command prints until its module is written. */
function notBuiltLine(command: PlannedCommand): string {
  return `automatos-theme ${command.name}: not built yet (${command.story}).`
}

interface Command {
  readonly themeDir: string
  readonly outDir: string
}

/** The pack command's folders from the arguments, or null when they don't make one. */
function parsePack(argv: readonly string[], cwd: string): Command | null {
  try {
    const { positionals, values } = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: { out: { type: 'string' } },
    })
    const [command, themeDir, ...extra] = positionals
    if (command !== 'pack' || themeDir === undefined || extra.length > 0) return null
    return { themeDir: resolve(cwd, themeDir), outDir: resolve(cwd, values.out ?? '.') }
  } catch {
    return null
  }
}

/** Prints what one pack of `themeDir` did, as `pack` prints it; returns its exit code. */
export function reportPack(themeDir: string, result: PackResult, output: Output): number {
  if (!result.ok) {
    output.err(`${themeDir} can't be packed: the Automatos server would refuse it.`)
    result.errors.forEach((error) => output.err(`  ${error.code} ${error.path}: ${error.message}`))
    return EXIT_REFUSED
  }
  output.out(`${result.file} ${result.bytes} bytes, digest ${result.manifest.digest}`)
  output.out(`${result.manifestFile}`)
  result.warnings.forEach((warning) => output.err(`${WARNING_PREFIX}${warning}`))
  return EXIT_OK
}

/** Runs `pack` once, the one command main takes (any other argument list prints the usage); returns the exit code. */
export function main(argv: readonly string[], output: Output, cwd: string = process.cwd()): number {
  const command = parsePack(argv, cwd)
  if (command === null) {
    output.err(USAGE)
    return EXIT_USAGE
  }
  return reportPack(command.themeDir, packTheme(command.themeDir, command.outDir), output)
}

/** `pack`, or `pack --watch` when the flag is given: pack-watch.ts, loaded only for it. */
async function packRunner(argv: readonly string[], output: Output, deps: CommandDeps): Promise<number> {
  if (!argv.slice(1).includes(WATCH_FLAG)) return main(argv, output, deps.cwd)
  const { packWatchCommand } = await import('./pack-watch.ts')
  return packWatchCommand(argv, output, deps)
}

/** The environment, network and folder the real command uses. */
function processDeps(): CommandDeps {
  return { env: process.env, fetch: globalThis.fetch, cwd: process.cwd() }
}

/** Runs the command `argv` names through COMMANDS (`commands` is for tests); returns the exit code. */
export async function run(
  argv: readonly string[],
  output: Output,
  deps: CommandDeps = processDeps(),
  commands: readonly PlannedCommand[] = COMMANDS,
): Promise<number> {
  const command = commands.find((item) => item.name === argv[0])
  if (command === undefined) {
    output.err(USAGE)
    return EXIT_USAGE
  }
  const runner = await command.load()
  if (runner === null) {
    output.err(notBuiltLine(command))
    return EXIT_USAGE
  }
  return runner(argv, output, deps)
}
