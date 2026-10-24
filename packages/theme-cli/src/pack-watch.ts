/**
 * `automatos-theme pack <theme folder> [--out <folder>] --watch` (PRD-261 B-02i): the theme's own build and the
 * pack, now and again after each change under the folder's src/, until Ctrl-C. Q27 keeps a live link into a real
 * host out: this is the loop the PRD recommends instead, a fresh package to upload again (`install`, or Install
 * theme in Settings).
 *
 * Each cycle runs the theme's `build` script (`npm run build` in the theme folder: Play's writes its look data and
 * dist/), then packs the folder exactly as `pack` does (cli-main.ts reportPack prints the same lines). A failed build
 * skips the pack; a refused pack prints every reason, as `pack` does; either way the watch goes on and the next
 * change tries again. The watch (watch.ts) takes a burst of changes as one, never runs two cycles at once, and
 * leaves dotfiles out, as pack leaves them out of source/. Only src/ is watched: the build writes everything else
 * the package holds (dist/, looks/, boot/), so a change there would start the cycle again.
 *
 * Exit code 0 once stopped, 1 when the folder has no src/ to watch, 2 for a usage error.
 */
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { PACK_USAGE, reportPack, type CommandDeps } from './cli-main.ts'
import { statOf } from './collect.ts'
import type { Output } from './output.ts'
import { packTheme } from './pack.ts'
import { runNpmScript } from './run-step.ts'
import { SOURCE_DIR } from './source.ts'
import { untilStopped, watchCycles, type WatchOptions } from './watch.ts'

const EXIT_OK = 0
const EXIT_REFUSED = 1
const EXIT_USAGE = 2
const PREFIX = 'automatos-theme pack --watch'
/** The theme's own build, as its package.json names it. */
export const BUILD_SCRIPT = 'build'

/** What the watch runs a cycle with, and when it stops. */
export interface PackWatchTools {
  /** The theme's own build, from its folder; resolves to its exit code. */
  readonly build: (themeDir: string, env: NodeJS.ProcessEnv) => Promise<number>
  /** Resolves when the watch should stop: Ctrl-C, for the real command. */
  readonly until: () => Promise<void>
  readonly watch?: WatchOptions
}

/** The real command's tools: `npm run build`, stopped by Ctrl-C. */
export function installedPackWatchTools(): PackWatchTools {
  return { build: (themeDir, env) => runNpmScript(BUILD_SCRIPT, { cwd: themeDir, env }), until: untilStopped }
}

interface PackWatchArgs {
  readonly themeDir: string
  readonly outDir: string
}

/** The folders from `pack <theme folder> [--out <folder>] --watch`, or null when the arguments don't make one. */
export function parsePackWatch(argv: readonly string[], cwd: string): PackWatchArgs | null {
  try {
    const { positionals, values } = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: { out: { type: 'string' }, watch: { type: 'boolean' } },
    })
    const [command, themeDir, ...extra] = positionals
    if (command !== 'pack' || themeDir === undefined || extra.length > 0 || values.watch !== true) return null
    return { themeDir: resolve(cwd, themeDir), outDir: resolve(cwd, values.out ?? '.') }
  } catch {
    return null
  }
}

/** The line a failed build prints: the pack is skipped and the watch goes on. */
export function buildFailedLine(code: number): string {
  return `${PREFIX}: the theme's build failed (exit code ${code}), so nothing was packed; still watching.`
}

/** The line a refused pack ends with, after its reasons. */
export const REFUSED_LINE = `${PREFIX}: fix what is listed above; still watching.`

/** The line the watch starts with. */
export function watchingLine(srcDir: string): string {
  return `${PREFIX}: watching ${srcDir}: each change builds and packs again (Ctrl-C stops).`
}

/** One cycle: the theme's build, then the pack, each outcome printed. */
async function packCycle(args: PackWatchArgs, output: Output, deps: CommandDeps, tools: PackWatchTools): Promise<void> {
  const code = await tools.build(args.themeDir, { ...deps.env })
  if (code !== EXIT_OK) {
    output.err(buildFailedLine(code))
    return
  }
  if (reportPack(args.themeDir, packTheme(args.themeDir, args.outDir), output) !== EXIT_OK) output.err(REFUSED_LINE)
}

/** `pack --watch` with the tools given (the tests'), or the real ones; resolves to the exit code once stopped. */
export async function runPackWatch(
  argv: readonly string[], output: Output, deps: CommandDeps, tools: () => PackWatchTools = installedPackWatchTools,
): Promise<number> {
  const args = parsePackWatch(argv, deps.cwd)
  if (args === null) {
    output.err(PACK_USAGE)
    return EXIT_USAGE
  }
  const srcDir = join(args.themeDir, SOURCE_DIR)
  if (statOf(args.themeDir, SOURCE_DIR) !== 'folder') {
    output.err(`${PREFIX}: ${args.themeDir} has no ${SOURCE_DIR}/ folder to watch.`)
    return EXIT_REFUSED
  }
  const given = tools()
  output.out(watchingLine(srcDir))
  const onError = (error: unknown): void => {
    output.err(`${PREFIX}: ${error instanceof Error ? error.message : String(error)}; still watching.`)
  }
  const watch = watchCycles(srcDir, () => packCycle(args, output, deps, given), { ...given.watch, onError })
  await given.until()
  await watch.close()
  output.out(`${PREFIX}: stopped.`)
  return EXIT_OK
}

/** The command table's pack row, given `--watch` (cli-main.ts packRunner). */
export function packWatchCommand(argv: readonly string[], output: Output, deps: CommandDeps): Promise<number> {
  return runPackWatch(argv, output, deps)
}
