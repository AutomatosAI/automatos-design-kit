/**
 * `automatos-theme shots <theme folder> [--out <folder>]` (PRD-261 B-02f): the theme drawn in the kit's browser
 * harness (packages/theme-harness), with nothing of Automatos running, shot on Chromium and WebKit with an axe scan
 * of every shot: one PNG per slot, page and route the theme serves, for each of its presets at 1440 and 1024 px,
 * plus one set just below its minWidth, for a theme whose minWidth fits a phone the same at 390 x 844, and for a theme
 * with a /chat page two more chat shots at 1440 (motion allowed, and a made-up transcript), with an axe.json beside
 * each set (the harness's shots/shots.spec.ts).
 *
 * Two steps, each only once the one before it passed, both run by Node from the harness's folder with the theme
 * folder and the out folder (default ./shots) in AUTOMATOS_HARNESS_THEME and AUTOMATOS_HARNESS_OUT:
 * 1. `vite build --config vite.harness.config.ts`: the harness app with the theme's src/entry.ts in it;
 * 2. `playwright test --config shots/playwright.config.ts`, whose web server previews that build.
 * The browsers come from `npx playwright install chromium webkit` (kit CI installs them with --with-deps).
 *
 * Exit code 0 when every shot passed; the failing step's own exit code when one failed (a missing shot, a request
 * to another origin, or a critical axe violation fails the second); 1 when the folder is no theme folder (no
 * theme.json or src/entry.ts), or its theme.json names a default look and the folder has no looks/presets/ yet
 * (the theme's build writes them); 2 for a usage error.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { OUT_ENV, THEME_ENV } from '@automatos/theme-harness/router'
import type { CommandDeps } from './cli-main.ts'
import type { Output } from './output.ts'

export const SHOTS_USAGE = 'usage: automatos-theme shots <theme folder> [--out <folder>]'
export const DEFAULT_OUT = 'shots'
/** The harness's two configs, relative to its folder. */
export const HARNESS_BUILD_CONFIG = 'vite.harness.config.ts'
export const HARNESS_SHOTS_CONFIG = 'shots/playwright.config.ts'

const EXIT_OK = 0
const EXIT_REFUSED = 1
const EXIT_USAGE = 2
const MANIFEST_FILE = 'theme.json'
const ENTRY_FILE = 'src/entry.ts'
const PRESETS_DIR = 'looks/presets'

/** Runs one Node script with its arguments; returns its exit code. */
export type RunScript = (script: string, args: readonly string[], options: { readonly cwd: string; readonly env: NodeJS.ProcessEnv }) => number

/** Where the harness and the two command lines are, and how a step runs. */
export interface ShotsTools {
  readonly harnessDir: string
  readonly viteBin: string
  readonly playwrightBin: string
  readonly run: RunScript
}

type Require = ReturnType<typeof createRequire>

/** A package's command, by its package.json `bin` (`dev` finds Vite so too). */
export function binOf(require: Require, pkg: string, command: string): string {
  const manifest = require.resolve(`${pkg}/package.json`)
  const { bin } = require(`${pkg}/package.json`) as { readonly bin?: string | Readonly<Record<string, string>> }
  const relative = typeof bin === 'string' ? bin : bin?.[command]
  if (relative === undefined) throw new Error(`${pkg} has no "${command}" command.`)
  return join(dirname(manifest), relative)
}

const runNode: RunScript = (script, args, options) => {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: options.cwd, env: options.env, stdio: 'inherit' })
  if (result.error !== undefined) throw result.error
  return result.status ?? EXIT_REFUSED
}

/** The harness and the commands from the kit's install. */
export function installedTools(): ShotsTools {
  const require = createRequire(import.meta.url)
  return {
    harnessDir: dirname(require.resolve('@automatos/theme-harness/package.json')),
    viteBin: binOf(require, 'vite', 'vite'),
    playwrightBin: binOf(require, '@playwright/test', 'playwright'),
    run: runNode,
  }
}

interface ShotsArgs {
  readonly themeDir: string
  readonly outDir: string
}

/** The folders from the arguments, or null when they don't make one command. */
function parseShots(argv: readonly string[], cwd: string): ShotsArgs | null {
  try {
    const { positionals, values } = parseArgs({ args: [...argv], allowPositionals: true, options: { out: { type: 'string' } } })
    const [command, themeDir, ...extra] = positionals
    if (command !== 'shots' || themeDir === undefined || extra.length > 0) return null
    return { themeDir: resolve(cwd, themeDir), outDir: resolve(cwd, values.out ?? DEFAULT_OUT) }
  } catch {
    return null
  }
}

/** Why the harness can't draw `themeDir`, or null when it can; `command` is the one that asks (`shots`, `dev`). */
export function themeFolderProblem(themeDir: string, command = 'shots'): string | null {
  const manifestPath = join(themeDir, MANIFEST_FILE)
  if (!existsSync(manifestPath)) return `${themeDir} has no ${MANIFEST_FILE}: ${command} draws a theme folder.`
  if (!existsSync(join(themeDir, ENTRY_FILE))) return `${themeDir} has no ${ENTRY_FILE}: the harness draws a theme from its entry.`
  let manifest: unknown
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch (error) {
    return `${manifestPath} can't be read as JSON (${String(error)}).`
  }
  const look = (manifest as { look?: unknown } | null)?.look
  if (typeof look === 'string' && !existsSync(join(themeDir, PRESETS_DIR))) {
    return `${themeDir} has no ${PRESETS_DIR}/ for its default look "${look}": run the theme's build first.`
  }
  return null
}

/** `shots` with the tools given (the tests'), or the kit's own. */
export function runShots(argv: readonly string[], output: Output, deps: CommandDeps, tools: () => ShotsTools = installedTools): number {
  const args = parseShots(argv, deps.cwd)
  if (args === null) {
    output.err(SHOTS_USAGE)
    return EXIT_USAGE
  }
  const problem = themeFolderProblem(args.themeDir)
  if (problem !== null) {
    output.err(problem)
    return EXIT_REFUSED
  }
  const { harnessDir, viteBin, playwrightBin, run } = tools()
  const env: NodeJS.ProcessEnv = { ...deps.env, [THEME_ENV]: args.themeDir, [OUT_ENV]: args.outDir }
  const steps = [
    { name: 'the harness build', script: viteBin, args: ['build', '--config', join(harnessDir, HARNESS_BUILD_CONFIG)] },
    { name: 'the shots', script: playwrightBin, args: ['test', '--config', join(harnessDir, HARNESS_SHOTS_CONFIG)] },
  ]
  for (const step of steps) {
    const code = run(step.script, step.args, { cwd: harnessDir, env })
    if (code !== EXIT_OK) {
      output.err(`automatos-theme shots: ${step.name} failed (exit code ${code}).`)
      return code
    }
  }
  output.out(`${args.outDir}`)
  return EXIT_OK
}

/** The command table's runner (cli-main.ts COMMANDS). */
export function shotsCommand(argv: readonly string[], output: Output, deps: CommandDeps): number {
  return runShots(argv, output, deps)
}
