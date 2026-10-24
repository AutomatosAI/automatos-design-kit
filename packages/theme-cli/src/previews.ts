/**
 * `automatos-theme previews <theme folder> --from <shots folder> [--pick <name>=<shot>]...` (PRD-261 B-02g): the
 * harness shots an owner picked (`automatos-theme shots`, B-02f) copied into the theme's listing previews, and
 * theme.json's `previews` set to them in the order given. Core's listing keeps theme.json's order and its cover is
 * the first preview listed (listings.py `_preview_paths`), so the first pick is the cover.
 *
 * A pick names a preview and the shot it is. The name is the preview's file stem, `<preset>` or `<preset>-<screen>`,
 * so the preview is assets/previews/<name>.png, and it belongs to the preset core's listing shows it under
 * (listings.py `_owner_preset`, as check/previews.ts ports it: the longest preset id first); a name no preset
 * claims is refused. The shot is a PNG under the shots folder, as `shots` lays it out
 * (`<browser>/<preset>/<width>/<view>.png`). With no --pick, each preset gets `<preset>.png`: its first view (the
 * harness's order, slots, pages, then routes) on Chromium at 1440 px, the default look first.
 *
 * Every pick is checked before anything is written: the name (a preview path core's reader takes, claimed by a
 * preset, picked once), the shot (a file inside the shots folder, a PNG of at most 512 KB: files.ts's preview kind,
 * the reader's own rule), and the list (core's manifest rule for `previews`: at most 16). theme.json keeps its own
 * layout (theme-json.ts). A file in assets/previews/ the list no longer names is left where it is, with a warning,
 * since pack still packs it. Nothing is sent anywhere.
 *
 * An owner picks and commits a theme's previews (PRD-261 PB-24); `check` then lists them under their presets.
 * Exit code 0 when written, 1 when refused (every reason printed, nothing written), 2 for a usage error.
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { parseArgs } from 'node:util'
import { declaredIn, presetOrder, SHOT_SUFFIX, SHOT_WIDTHS, viewsOf, viewSlug } from '@automatos/theme-harness/router'
import { ownerPreset, PREVIEW_DIR, PREVIEW_SUFFIX } from './check/previews.ts'
import { WARNING_PREFIX, type CommandDeps } from './cli-main.ts'
import { validateManifest } from './core/package-manifest.ts'
import { FILE_KINDS, KB, type FileKind } from './files.ts'
import { presetIds, PRESETS_DIR } from './looks.ts'
import type { Output } from './output.ts'
import { withStringList } from './theme-json.ts'

export const PREVIEWS_USAGE = 'usage: automatos-theme previews <theme folder> --from <shots folder> [--pick <name>=<shot>]...'
/** The shot a preset's preview is with no --pick: shots/playwright.config.ts's first browser, at the first width. */
export const DEFAULT_BROWSER = 'chromium'
export const DEFAULT_WIDTH = SHOT_WIDTHS[0]

const EXIT_OK = 0
const EXIT_REFUSED = 1
const EXIT_USAGE = 2
const MANIFEST_FILE = 'theme.json'
const PREVIEWS_FIELD = 'previews'
const PREVIEW_KIND = 'preview'
const PICK_SEPARATOR = '='
const BOM = '\uFEFF'

type JsonObject = Readonly<Record<string, unknown>>

/** One --pick: the preview's name (its file stem) and the shot, a path under the shots folder. */
export interface PreviewPick {
  readonly name: string
  readonly shot: string
}

interface PreviewsArgs {
  readonly themeDir: string
  readonly fromDir: string
  /** The picks in the order given; null when there is none. */
  readonly picks: readonly PreviewPick[] | null
}

/** A checked pick: the package path it is written to, and the shot's bytes. */
interface Preview {
  readonly path: string
  readonly shot: string
  readonly data: Uint8Array
}

interface Theme {
  readonly text: string
  readonly document: JsonObject
  /** The ids of looks/presets/, in path order. */
  readonly presets: readonly string[]
}

/** `<name>=<shot>`, both sides given, or null. */
function pickOf(text: string): PreviewPick | null {
  const at = text.indexOf(PICK_SEPARATOR)
  if (at <= 0 || at === text.length - 1) return null
  return { name: text.slice(0, at), shot: text.slice(at + 1) }
}

/** The folders and picks from the arguments, or null when they don't make one command. */
function parsePreviews(argv: readonly string[], cwd: string): PreviewsArgs | null {
  try {
    const { positionals, values } = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: { from: { type: 'string' }, pick: { type: 'string', multiple: true } },
    })
    const [command, themeDir, ...extra] = positionals
    if (command !== 'previews' || themeDir === undefined || extra.length > 0 || values.from === undefined) return null
    const given = values.pick ?? []
    const picks = given.map(pickOf).filter((pick): pick is PreviewPick => pick !== null)
    if (picks.length !== given.length) return null
    return { themeDir: resolve(cwd, themeDir), fromDir: resolve(cwd, values.from), picks: picks.length === 0 ? null : picks }
  } catch {
    return null
  }
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

function isFolder(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

/** theme.json (its text and what it parses to) and the folder's presets, or why they can't be read. */
function readTheme(themeDir: string): Theme | string {
  const manifestPath = join(themeDir, MANIFEST_FILE)
  if (!isFile(manifestPath)) return `${themeDir} has no ${MANIFEST_FILE}: previews takes a theme folder.`
  const text = readFileSync(manifestPath, 'utf8')
  let document: unknown
  try {
    document = JSON.parse(text.startsWith(BOM) ? text.slice(BOM.length) : text)
  } catch (error) {
    return `${manifestPath} can't be read as JSON (${String(error)}).`
  }
  if (document === null || typeof document !== 'object' || Array.isArray(document)) return `${manifestPath} is not a JSON object.`
  const presetsDir = join(themeDir, PRESETS_DIR)
  const names = isFolder(presetsDir) ? readdirSync(presetsDir).map((name) => `${PRESETS_DIR}${name}`) : []
  return { text, document: document as JsonObject, presets: Array.from(presetIds(names)) }
}

/** With no --pick: each preset's first view on Chromium at 1440 px, as `<preset>.png`, the default look first. */
export function defaultPicks(manifest: JsonObject, presets: readonly string[]): PreviewPick[] {
  const first = viewsOf(declaredIn(manifest))[0]
  if (first === undefined) return []
  const look = typeof manifest.look === 'string' ? manifest.look : undefined
  const view = `${viewSlug(first)}${SHOT_SUFFIX}`
  const shotOf = (preset: string): string => [DEFAULT_BROWSER, preset, String(DEFAULT_WIDTH), view].join('/')
  return presetOrder(presets, look).map((preset) => ({ name: preset, shot: shotOf(preset) }))
}

/** files.ts's preview kind: the name pattern, the cap and the byte check core's reader holds a preview to. */
function previewKind(): FileKind {
  const kind = FILE_KINDS.find((candidate) => candidate.name === PREVIEW_KIND)
  if (kind === undefined) throw new Error(`files.ts has no ${PREVIEW_KIND} kind.`)
  return kind
}

/** Why `name` can't be a preview of this theme (core's reader's path rule, then the listing's preset rule), or null. */
function nameProblem(name: string, presets: readonly string[], kind: FileKind): string | null {
  if (!kind.pattern.test(`${PREVIEW_DIR}${name}${PREVIEW_SUFFIX}`)) {
    return `"${name}" can't name a preview: core takes ${PREVIEW_DIR}<name>${PREVIEW_SUFFIX}, the name letters, digits, `
      + '".", "_" and "-", starting with a letter or digit, at most 128 characters.'
  }
  if (ownerPreset(name, presets) !== null) return null
  const known = presets.length === 0 ? `the theme has no preset in ${PRESETS_DIR} yet (its build writes them)` : `its presets are ${presets.join(', ')}`
  return `"${name}" belongs to no preset: a preview is named <preset> or <preset>-<screen>, and ${known}.`
}

/** The shot's bytes, or why it can't be a preview: outside the shots folder, missing, over the cap, or no PNG. */
function readShot(shot: string, fromDir: string, kind: FileKind): Uint8Array | string {
  const file = resolve(fromDir, shot)
  const inside = relative(fromDir, file)
  if (inside === '' || inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside)) {
    return `${shot} is not inside the shots folder ${fromDir}.`
  }
  if (!isFile(file)) return `${shot}: there is no such shot in ${fromDir}.`
  const data = new Uint8Array(readFileSync(file))
  if (data.length > kind.cap) {
    return `${shot} is ${data.length} bytes: a preview must be ${kind.cap / KB} KB or smaller, as core's reader holds it.`
  }
  const problem = kind.check?.(data) ?? null
  return problem === null ? data : `${shot}: ${problem}.`
}

/** The pick as a preview, or every reason it is refused. */
function checkedPick(pick: PreviewPick, presets: readonly string[], fromDir: string): Preview | string[] {
  const kind = previewKind()
  const named = nameProblem(pick.name, presets, kind)
  const shot = readShot(pick.shot, fromDir, kind)
  const problems = [named, typeof shot === 'string' ? shot : null].filter((problem): problem is string => problem !== null)
  if (problems.length > 0 || typeof shot === 'string') return problems
  return { path: `${PREVIEW_DIR}${pick.name}${PREVIEW_SUFFIX}`, shot: pick.shot, data: shot }
}

/** theme.json's previews rule in core's manifest (at most 16 different files), on the list the picks make. */
function listProblems(document: JsonObject, paths: readonly string[]): string[] {
  const { errors } = validateManifest({ ...document, [PREVIEWS_FIELD]: [...new Set(paths)] })
  return errors.filter((error) => error.path === PREVIEWS_FIELD).map((error) => `${MANIFEST_FILE}: ${error.message}`)
}

/** Every pick checked: the previews to write, in order, or every reason one is refused. */
function plannedPreviews(picks: readonly PreviewPick[], theme: Theme, fromDir: string): { previews: Preview[]; problems: string[] } {
  const checked = picks.map((pick) => checkedPick(pick, theme.presets, fromDir))
  const twice = picks
    .filter((pick, index) => picks.findIndex((other) => other.name === pick.name) !== index)
    .map((pick) => `"${pick.name}" is picked twice: each preview is one shot.`)
  const paths = picks.map((pick) => `${PREVIEW_DIR}${pick.name}${PREVIEW_SUFFIX}`)
  const problems = [...checked.flatMap((item) => (Array.isArray(item) ? item : [])), ...twice, ...listProblems(theme.document, paths)]
  return { previews: checked.filter((item): item is Preview => !Array.isArray(item)), problems }
}

/** The files in assets/previews/ the new list doesn't name, which pack still packs. */
function unlisted(themeDir: string, paths: readonly string[]): string[] {
  return readdirSync(join(themeDir, PREVIEW_DIR))
    .filter((name) => !name.startsWith('.'))
    .map((name) => `${PREVIEW_DIR}${name}`)
    .filter((path) => !paths.includes(path))
    .sort()
}

/** Writes the previews and theme.json's list, prints each, and warns of each file the list no longer names. */
function writePreviews(themeDir: string, theme: Theme, previews: readonly Preview[], output: Output): void {
  const paths = previews.map((preview) => preview.path)
  mkdirSync(join(themeDir, PREVIEW_DIR), { recursive: true })
  previews.forEach((preview) => writeFileSync(join(themeDir, preview.path), preview.data))
  writeFileSync(join(themeDir, MANIFEST_FILE), withStringList(theme.text, theme.document, PREVIEWS_FIELD, paths))
  previews.forEach((preview) => output.out(`${preview.path} from ${preview.shot}`))
  output.out(`${MANIFEST_FILE} lists ${paths.length} preview(s), in the order above; the listing's cover is the first, ${paths[0]}.`)
  unlisted(themeDir, paths).forEach((path) => output.err(
    `${WARNING_PREFIX}${path} is in ${themeDir} but ${MANIFEST_FILE} no longer lists it; pack still packs it, so delete it or pick it again.`,
  ))
}

function refused(output: Output, themeDir: string, problems: readonly string[]): number {
  output.err(`automatos-theme previews: nothing was written to ${themeDir}, because:`)
  problems.forEach((problem) => output.err(`  ${problem}`))
  return EXIT_REFUSED
}

/** Runs `previews` in the folder `cwd`; returns the exit code. */
export function runPreviews(argv: readonly string[], output: Output, cwd: string): number {
  const args = parsePreviews(argv, cwd)
  if (args === null) {
    output.err(PREVIEWS_USAGE)
    return EXIT_USAGE
  }
  const theme = readTheme(args.themeDir)
  if (typeof theme === 'string') return refused(output, args.themeDir, [theme])
  if (!isFolder(args.fromDir)) {
    return refused(output, args.themeDir, [`${args.fromDir} is not a folder: --from takes the folder automatos-theme shots wrote.`])
  }
  const picks = args.picks ?? defaultPicks(theme.document, theme.presets)
  if (picks.length === 0) {
    return refused(output, args.themeDir, [`the theme has no preset in ${PRESETS_DIR}, and a preview belongs to one: build the theme first.`])
  }
  const { previews, problems } = plannedPreviews(picks, theme, args.fromDir)
  if (problems.length > 0) return refused(output, args.themeDir, problems)
  writePreviews(args.themeDir, theme, previews, output)
  return EXIT_OK
}

/** The command table's runner (cli-main.ts COMMANDS). */
export function previewsCommand(argv: readonly string[], output: Output, deps: CommandDeps): number {
  return runPreviews(argv, output, deps.cwd)
}
