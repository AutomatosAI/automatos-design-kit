/**
 * `automatos-theme check <theme folder> [--rebuild] [--json]` (PRD-261 B-03c): the server's review
 * checks, run here, in the server's report shape (`automatos-theme-scan/v2`, report.ts).
 *
 * The folder is packed exactly as `pack` packs it, into a temporary folder, so a theme core's reader
 * would refuse is refused here with every reason (exit 1) and nothing else runs, as on the server.
 * An accepted package gets one line per check, in this order: sizes, cssScope, looks (the reader's),
 * uses (uses.ts), audioCapture (audio.ts), clonedFrom (drift.ts), previews (previews.ts), jsRules (js.ts),
 * reproducibleBuild (only with `--rebuild`), contrast and llm, each at pass, warning, error or not_measured, with plain
 * lines under it, then the verdict. The first line names the core commit whose checks these are.
 * `contrast` measures the WCAG AA colour pairs of theme.json's `mobile` block (mobile-contrast.ts): its line
 * gives the outcome, each failing pair, and each scheme, the table's defaults or preset with how many
 * of its pairs were measured. A theme without the block gets not_measured, and the line says so.
 *
 * `--rebuild` rebuilds source/ with the kit's preset and compares dist/ byte for byte, by importing
 * the review job's own scripts/review/rebuild.ts (`rebuildDist`, `compareDist`); without it, nothing
 * is built. `--json` prints the report instead of the lines, with `core` naming the commit. `llm` is
 * the Marketplace's own stage: always not_measured here. The command sends nothing anywhere.
 *
 * Exit code 0 when no check is an error, 1 when one is (or the reader refuses the theme), 2 for a usage error.
 *
 * `check design <theme folder>` (PRD-261 B-03d) checks the design before any code: the look schema,
 * the presets, the prepaint table and design/contrast.json's pairs (design.ts, which has its own usage).
 * A theme folder that is itself named design is checked as `check ./design`. design.ts is loaded only
 * for `check design`: its meter loads @automatos/look-kit's hsl.ts (packages/look-kit), which `check` never
 * needs. `check` loads look-kit's contrast.ts alone, which imports nothing, for the mobile block's measure
 * (mobile-contrast.ts).
 */
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import type { DistComparison, RebuildResult } from '../../../../scripts/review/rebuild.ts'
import { checkPackage } from '../check-package.ts'
import { WARNING_PREFIX, type CommandDeps } from '../cli-main.ts'
import type { Output } from '../output.ts'
import { packTheme } from '../pack.ts'
import { readZip } from '../zip.ts'
import { audioCaptureCheck, describeAudio } from './audio.ts'
import { cloneCheck, describeClones } from './drift.ts'
import { describeJs, jsRulesCheck } from './js.ts'
import { describePreviews, previewsCheck } from './previews.ts'
import {
  CORE_REPO, CORE_SHA, describeReader, LEVEL_ERROR, LEVEL_PASS, LEVELS, llmCheck, readerChecks, REPORT_SCHEMA, scanReport,
  type CheckEntry, type CheckText, type Files, type Manifest, type ScanReport,
} from './report.ts'
import { describeUses, usesCheck, type SurfaceAreas } from './uses.ts'

export const CHECK_USAGE = 'usage: automatos-theme check <theme folder> [--rebuild] [--json]'
const EXIT_OK = 0
const EXIT_FAILED = 1
const EXIT_USAGE = 2
const NAME_WIDTH = 18
const LEVEL_WIDTH = 13
const ITEM_INDENT = '    '
const JSON_INDENT = 2
const TEMP_PREFIX = 'automatos-check-'
/** design.ts DESIGN_SUBCOMMAND, kept here so that `check` loads design.ts only when it runs. */
const DESIGN_SUBCOMMAND = 'design'
/** handoff.ts HANDOFF_SUBCOMMAND, kept here for the same reason. */
const HANDOFF_SUBCOMMAND = 'handoff'

/** The review job's rebuild (scripts/review/rebuild.ts), as `--rebuild` runs it. */
export interface Rebuilder {
  readonly rebuildDist: (files: Files, workDir: string) => Promise<RebuildResult>
  readonly compareDist: (files: Files, rebuilt: Files) => DistComparison
}

export interface ReviewOptions {
  /** `--rebuild`: the folder the rebuild writes in, and the rebuild. */
  readonly rebuild?: { readonly workDir: string; readonly rebuilder: Rebuilder }
  /** The SDK's names by area: the vendored list when left out, none when null. */
  readonly surface?: SurfaceAreas | null
  /** The core page hashes: the vendored ones when left out. */
  readonly release?: ReadonlyMap<string, string>
}

export interface Reviewed {
  readonly report: ScanReport
  /** Each check's line, by check name. */
  readonly texts: Readonly<Record<string, CheckText>>
}

interface BuildEntry extends CheckEntry {
  readonly reason: string
  readonly differing: readonly string[]
  readonly onlyInPackage: readonly string[]
  readonly onlyInBuild: readonly string[]
}

interface Command {
  readonly themeDir: string
  readonly rebuild: boolean
  readonly json: boolean
}

/** The review job's rebuild, loaded only when `--rebuild` asks for it (it loads Vite). */
export async function loadRebuilder(): Promise<Rebuilder> {
  const { rebuildDist, compareDist } = await import('../../../../scripts/review/rebuild.ts')
  return { rebuildDist, compareDist }
}

/** The `reproducibleBuild` entry: source/ rebuilt with the kit's preset, and dist/ against it. */
export async function reproducibleBuildCheck(files: Files, workDir: string, rebuilder: Rebuilder): Promise<BuildEntry> {
  const none = { differing: [], onlyInPackage: [], onlyInBuild: [] }
  const rebuilt = await rebuilder.rebuildDist(files, workDir)
  if (!rebuilt.ok) return { level: LEVEL_ERROR, status: 'failed', entry: null, ...none, reason: rebuilt.error }
  const { same, differing, onlyInPackage, onlyInBuild } = rebuilder.compareDist(files, rebuilt.dist)
  const found = { entry: rebuilt.entry, differing, onlyInPackage, onlyInBuild }
  if (same) {
    const rebuiltSame = `dist/ rebuilt byte for byte from ${rebuilt.entry} (${rebuilt.dist.size} files).`
    return { level: LEVEL_PASS, status: 'same', ...found, reason: rebuiltSame }
  }
  const reason = `The rebuild of source/ (entry ${rebuilt.entry}) is not the package's dist/, so the Marketplace review refuses it.`
  return { level: LEVEL_ERROR, status: 'differs', ...found, reason }
}

function describeBuild(entry: BuildEntry): CheckText {
  const items = [
    ...entry.differing.map((path) => `differs: ${path}`),
    ...entry.onlyInPackage.map((path) => `only in the package: ${path}`),
    ...entry.onlyInBuild.map((path) => `only in the rebuild: ${path}`),
  ]
  return { text: entry.reason, items }
}

/** core review_stage.py `run_review_stage` on a package the reader accepted, with the kit's own checks. */
export async function reviewChecked(files: Files, manifest: Manifest, packageBytes: number, options: ReviewOptions = {}): Promise<Reviewed> {
  const reader = readerChecks(files, packageBytes, manifest)
  const said = describeReader(reader)
  const uses = usesCheck(manifest, files, options.surface)
  const audioCapture = audioCaptureCheck(files)
  const clonedFrom = cloneCheck(manifest, options.release)
  const previews = previewsCheck(manifest, files)
  const jsRules = jsRulesCheck(files)
  const build = options.rebuild ? await reproducibleBuildCheck(files, options.rebuild.workDir, options.rebuild.rebuilder) : null
  const llm = llmCheck()
  const rows: Array<readonly [string, CheckEntry, CheckText]> = [
    ['sizes', reader.sizes, said.sizes],
    ['cssScope', reader.cssScope, said.cssScope],
    ['looks', reader.looks, said.looks],
    ['uses', uses, describeUses(uses)],
    ['audioCapture', audioCapture, describeAudio(audioCapture)],
    ['clonedFrom', clonedFrom, describeClones(clonedFrom)],
    ['previews', previews, describePreviews(previews)],
    ['jsRules', jsRules, describeJs(jsRules)],
    ...(build === null ? [] : [['reproducibleBuild', build, describeBuild(build)] as const]),
    ['contrast', reader.contrast, said.contrast],
    ['llm', llm, { text: llm.reason, items: [] }],
  ]
  const report = scanReport(Object.fromEntries(rows.map(([name, entry]) => [name, entry])))
  return { report, texts: Object.fromEntries(rows.map(([name, , text]) => [name, text])) }
}

/** The command's folder and flags from the arguments, or null when they don't make one. */
function parseCheck(argv: readonly string[], cwd: string): Command | null {
  try {
    const { positionals, values } = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: { rebuild: { type: 'boolean' }, json: { type: 'boolean' } },
    })
    const [command, themeDir, ...extra] = positionals
    if (command !== 'check' || themeDir === undefined || extra.length > 0) return null
    return { themeDir: resolve(cwd, themeDir), rebuild: values.rebuild === true, json: values.json === true }
  } catch {
    return null
  }
}

/** The lines a person reads: the commit checked against, one line per check (and its items), the verdict. */
export function reportLines(themeDir: string, reviewed: Reviewed): string[] {
  const { report, texts } = reviewed
  const header = `automatos-theme check ${themeDir}: the review checks of ${CORE_REPO} at ${CORE_SHA} (${REPORT_SCHEMA})`
  const rows = Object.entries(report.checks).flatMap(([name, entry]) => {
    const said = texts[name]
    const line = `${name.padEnd(NAME_WIDTH)}${entry.level.padEnd(LEVEL_WIDTH)}${said.text}`
    return [line, ...said.items.map((item) => `${ITEM_INDENT}${item}`)]
  })
  const counts = LEVELS.map((level) => `${report.summary[level]} ${level}`).join(', ')
  return [header, ...rows, `verdict: ${report.verdict} (${counts})`]
}

/** The report as `--json` prints it: core's shape, with `core` naming the commit. */
export function reportJson(report: ScanReport): string {
  return JSON.stringify({ ...report, core: { repo: CORE_REPO, sha: CORE_SHA } }, null, JSON_INDENT)
}

function isFolder(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

/** Packs the folder as `pack` does and reviews the package; null (with every reason printed) when it is refused. */
async function reviewFolder(command: Command, output: Output, workDir: string, rebuilder: () => Promise<Rebuilder>): Promise<Reviewed | null> {
  const packed = packTheme(command.themeDir, join(workDir, 'pack'))
  if (!packed.ok) {
    output.err(`${command.themeDir} can't be checked: the Automatos server would refuse it.`)
    packed.errors.forEach((error) => output.err(`  ${error.code} ${error.path}: ${error.message}`))
    return null
  }
  packed.warnings.forEach((warning) => output.err(`${WARNING_PREFIX}${warning}`))
  const checked = checkPackage(readZip(readFileSync(packed.file)))
  if (checked.manifest === null) throw new Error('the package pack wrote does not pass the reader it was checked with')
  const files = new Map(Array.from(checked.files, ([path, file]): [string, Uint8Array] => [path, file.data]))
  const rebuild = command.rebuild ? { workDir: join(workDir, 'rebuild'), rebuilder: await rebuilder() } : undefined
  return reviewChecked(files, checked.manifest, packed.bytes, { rebuild })
}

/** Runs `check` with `rebuilder` behind `--rebuild` (tests pass their own); returns the exit code. */
export async function runCheck(
  argv: readonly string[], output: Output, cwd: string, rebuilder: () => Promise<Rebuilder> = loadRebuilder,
): Promise<number> {
  const command = parseCheck(argv, cwd)
  if (command === null) {
    output.err(CHECK_USAGE)
    return EXIT_USAGE
  }
  if (!isFolder(command.themeDir)) {
    output.err(`${command.themeDir} is not a folder: check takes a built theme folder.`)
    return EXIT_USAGE
  }
  const workDir = mkdtempSync(join(tmpdir(), TEMP_PREFIX))
  try {
    const reviewed = await reviewFolder(command, output, workDir, rebuilder)
    if (reviewed === null) return EXIT_FAILED
    if (command.json) output.out(reportJson(reviewed.report))
    else reportLines(command.themeDir, reviewed).forEach((line) => output.out(line))
    return reviewed.report.summary.error > 0 ? EXIT_FAILED : EXIT_OK
  } finally {
    rmSync(workDir, { recursive: true, force: true })
  }
}

/** The command table's runner (cli-main.ts): `check`, `check design` or `check handoff`, in `deps.cwd`; none uses the network. */
export async function checkCommand(argv: readonly string[], output: Output, deps: CommandDeps): Promise<number> {
  if (argv[1] === HANDOFF_SUBCOMMAND) {
    const { handoffCommand } = await import('./handoff.ts')
    return handoffCommand(argv, output, deps)
  }
  if (argv[1] !== DESIGN_SUBCOMMAND) return runCheck(argv, output, deps.cwd)
  const { designCommand } = await import('./design.ts')
  return designCommand(argv, output, deps)
}
