/**
 * What `automatos-theme previews` (previews.ts) checks and writes, for either list of Marketplace screenshots
 * theme.json holds: `previews`, the web's, from harness shots, and `phonePreviews`, Automatos Go's, from phone
 * screenshots (previews-phone.ts). A target names the list: its theme.json field, its package folder, the file
 * formats (files.ts kinds) a picked file may be, and the words its messages use.
 *
 * Every pick is checked before anything is written: the name (a package path core's reader takes, claimed by a
 * preset, picked once), the file (inside the folder given, at most 512 KB, and one of the target's formats by its
 * first bytes: files.ts's kinds, the reader's own rules), and the list (core's manifest rule for the field: at most
 * 24 different files). theme.json keeps its own layout (theme-json.ts). A file in the target's folder the list no
 * longer names is left where it is, with a warning, since pack still packs it.
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { ownerPreset } from './check/previews.ts'
import { WARNING_PREFIX } from './cli-main.ts'
import { validateManifest } from './core/package-manifest.ts'
import { FILE_KINDS, KB, type FileKind } from './files.ts'
import { presetIds, PRESETS_DIR } from './looks.ts'
import type { Output } from './output.ts'
import { withStringList } from './theme-json.ts'

export const MANIFEST_FILE = 'theme.json'
const BOM = '\uFEFF'

type JsonObject = Readonly<Record<string, unknown>>

/** One --pick: the screenshot's name (its file stem) and the file, a path under the folder given. */
export interface PreviewPick {
  readonly name: string
  readonly shot: string
}

export interface Theme {
  readonly text: string
  readonly document: JsonObject
  /** The ids of looks/presets/, in path order. */
  readonly presets: readonly string[]
}

/** One format a picked file may be: its files.ts kind, and the extension its package path takes. */
export interface PictureFormat {
  readonly kind: FileKind
  readonly extension: string
}

/** A checked pick: the package path it is written to, the file it came from, and its bytes. */
export interface Preview {
  readonly path: string
  readonly shot: string
  readonly data: Uint8Array
}

export interface PreviewTarget {
  readonly field: string
  readonly folder: string
  /** In files.ts's order; the first whose byte check passes is the picked file's. */
  readonly formats: readonly PictureFormat[]
  /** What one is called ("preview"), its package path's shape, and why bytes are none of the formats. */
  readonly noun: string
  readonly pathShape: string
  readonly notPicture: string
  /** The folder given and one file in it ("shots folder", "shot"), and the listing's first one ("the listing's cover"). */
  readonly folderWord: string
  readonly fileWord: string
  readonly coverWord: string
  /** Why the folder given is no folder. */
  readonly notAFolder: (folder: string) => string
  /** The picks with no --pick, or why there are none. */
  readonly defaultPicks: (theme: Theme, folder: string) => readonly PreviewPick[] | string
  /** A warning about one written file, or null. */
  readonly warning?: (preview: Preview) => string | null
}

export function isFile(path: string): boolean {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

export function isFolder(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

/** The files.ts kinds named `kindName`, each with the extension its content type takes; throws when files.ts has none. */
export function formatsOf(kindName: string, extensions: Readonly<Record<string, string>>): PictureFormat[] {
  const kinds = FILE_KINDS.filter((kind) => kind.name === kindName)
  if (kinds.length === 0 || kinds.some((kind) => !Object.hasOwn(extensions, kind.contentType))) {
    throw new Error(`files.ts has no ${kindName} kind of a known type.`)
  }
  return kinds.map((kind) => ({ kind, extension: extensions[kind.contentType] }))
}

/** theme.json (its text and what it parses to) and the folder's presets, or why they can't be read. */
export function readTheme(themeDir: string): Theme | string {
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

/** True when `name` makes a package path core's reader takes in the target's folder. */
function nameFits(name: string, target: PreviewTarget): boolean {
  const [first] = target.formats
  return first !== undefined && first.kind.pattern.test(`${target.folder}${name}${first.extension}`)
}

/** Why `name` can't be one of this theme's screenshots (core's reader's path rule, then the listing's preset rule), or null. */
function nameProblem(name: string, presets: readonly string[], target: PreviewTarget): string | null {
  if (!nameFits(name, target)) {
    return `"${name}" can't name a ${target.noun}: core takes ${target.pathShape}, the name letters, digits, `
      + '".", "_" and "-", starting with a letter or digit, at most 128 characters.'
  }
  if (ownerPreset(name, presets) !== null) return null
  const known = presets.length === 0 ? `the theme has no preset in ${PRESETS_DIR} yet (its build writes them)` : `its presets are ${presets.join(', ')}`
  return `"${name}" belongs to no preset: a ${target.noun} is named <preset> or <preset>-<screen>, and ${known}.`
}

/** The file's bytes and format, or why it can't be one: outside the folder, missing, over the cap, or no format's bytes. */
function readPicture(shot: string, fromDir: string, target: PreviewTarget): { data: Uint8Array; format: PictureFormat } | string {
  const file = resolve(fromDir, shot)
  const inside = relative(fromDir, file)
  if (inside === '' || inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside)) {
    return `${shot} is not inside the ${target.folderWord} ${fromDir}.`
  }
  if (!isFile(file)) return `${shot}: there is no such ${target.fileWord} in ${fromDir}.`
  const data = new Uint8Array(readFileSync(file))
  const cap = Math.max(...target.formats.map((format) => format.kind.cap))
  if (data.length > cap) {
    return `${shot} is ${data.length} bytes: a ${target.noun} must be ${cap / KB} KB or smaller, as core's reader holds it.`
  }
  const format = target.formats.find((candidate) => (candidate.kind.check?.(data) ?? null) === null)
  return format === undefined ? `${shot}: ${target.notPicture}.` : { data, format }
}

/** The pick as a screenshot to write, or every reason it is refused. */
function checkedPick(pick: PreviewPick, presets: readonly string[], fromDir: string, target: PreviewTarget): Preview | string[] {
  const named = nameProblem(pick.name, presets, target)
  const read = readPicture(pick.shot, fromDir, target)
  const problems = [named, typeof read === 'string' ? read : null].filter((problem): problem is string => problem !== null)
  if (problems.length > 0 || typeof read === 'string') return problems
  return { path: `${target.folder}${pick.name}${read.format.extension}`, shot: pick.shot, data: read.data }
}

/** theme.json's rule for the field in core's manifest (at most 24 different files), on the list the picks make. */
function listProblems(document: JsonObject, paths: readonly string[], field: string): string[] {
  const { errors } = validateManifest({ ...document, [field]: [...new Set(paths)] })
  return errors.filter((error) => error.path === field).map((error) => `${MANIFEST_FILE}: ${error.message}`)
}

/** Every pick checked: the screenshots to write, in order, or every reason one is refused. */
export function plannedPreviews(
  picks: readonly PreviewPick[], theme: Theme, fromDir: string, target: PreviewTarget,
): { previews: Preview[]; problems: string[] } {
  const checked = picks.map((pick) => checkedPick(pick, theme.presets, fromDir, target))
  const twice = picks
    .filter((pick, index) => picks.findIndex((other) => other.name === pick.name) !== index)
    .map((pick) => `"${pick.name}" is picked twice: each ${target.noun} is one ${target.fileWord}.`)
  // A name the name check refused stays out of the list rule, which would only say the same in fewer words.
  const paths = picks.flatMap((pick, index) => {
    const item = checked[index]
    if (!Array.isArray(item)) return [item.path]
    return nameFits(pick.name, target) ? [`${target.folder}${pick.name}${target.formats[0].extension}`] : []
  })
  const problems = [...checked.flatMap((item) => (Array.isArray(item) ? item : [])), ...twice, ...listProblems(theme.document, paths, target.field)]
  return { previews: checked.filter((item): item is Preview => !Array.isArray(item)), problems }
}

/** The files right in the target's folder (no folder below it) the new list doesn't name, which pack still packs. */
function unlisted(themeDir: string, folder: string, paths: readonly string[]): string[] {
  const dir = join(themeDir, folder)
  return readdirSync(dir)
    .filter((name) => !name.startsWith('.') && isFile(join(dir, name)))
    .map((name) => `${folder}${name}`)
    .filter((path) => !paths.includes(path))
    .sort()
}

/** Writes the screenshots and theme.json's list, prints each, and warns of each file the list no longer names. */
export function writePreviews(themeDir: string, theme: Theme, previews: readonly Preview[], target: PreviewTarget, output: Output): void {
  const paths = previews.map((preview) => preview.path)
  mkdirSync(join(themeDir, target.folder), { recursive: true })
  previews.forEach((preview) => writeFileSync(join(themeDir, preview.path), preview.data))
  writeFileSync(join(themeDir, MANIFEST_FILE), withStringList(theme.text, theme.document, target.field, paths))
  previews.forEach((preview) => output.out(`${preview.path} from ${preview.shot}`))
  output.out(`${MANIFEST_FILE} lists ${paths.length} ${target.noun}(s), in the order above; ${target.coverWord} is the first, ${paths[0]}.`)
  previews.map((preview) => target.warning?.(preview) ?? null)
    .filter((warning): warning is string => warning !== null)
    .forEach((warning) => output.err(`${WARNING_PREFIX}${warning}`))
  unlisted(themeDir, target.folder, paths).forEach((path) => output.err(
    `${WARNING_PREFIX}${path} is in ${themeDir} but ${MANIFEST_FILE} no longer lists it; pack still packs it, so delete it or pick it again.`,
  ))
}
