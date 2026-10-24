/**
 * A theme package checked as core's reader checks it, before anything is zipped.
 *
 * The passes of core's orchestrator/services/themes/package.py `read_theme_package`, in its order:
 * the paths (members.ts), then each file's size and bytes, then the content: theme.json against
 * the manifest rules (incl. lookEditor@1 and styleSheet@1, PA-14), the entry and the code caps,
 * the look schema and presets, the prepaint table, the files the manifest names, the default
 * look, and dist/theme.css against the server's CSS scope check, then the `mobile` block (host 1.1.0,
 * package.py `_mobile_link_errors`): `fromLooks` paints a phone's ground and its text from the prepaint
 * table's defaults (mobile-paint.ts), and a `clips` or `stills` mascot has every state's files. Each
 * pass that refuses anything ends the check, as on the server, so the codes reported are the ones core
 * would report.
 */
import { cssScopeErrors, STYLE_PATH } from '@automatos/vite-preset/css-scope'
import { echo, hasOwn, isRecord, own, prepaintErrors, PREPAINT_PATH, themeError, type ThemeError } from './core/css-value.ts'
import { validateManifest } from './core/package-manifest.ts'
import { CAPS, CODE_KINDS, fileKind, KB } from './files.ts'
import { parseJson } from './json.ts'
import { lookFileErrors, presetIds } from './looks.ts'
import { pathErrors, readFiles, type CheckedFile, type PackageEntry } from './members.ts'
import { bootTable, missingTokens, paintLook } from './mobile-paint.ts'

export const MANIFEST_PATH = 'theme.json'
export const ENTRY_PATH = 'dist/entry.js'
export const MOBILE_CANNOT_PAINT = 'MOBILE_CANNOT_PAINT'

const MOBILE_FIELD = 'mobile'
const MOBILE_FONTS = 'fonts'
const MOBILE_FROM_LOOKS = 'fromLooks'
const PREPAINT_DEFAULTS = 'defaults'
// package.py :114-:121: the files a phone draws each mascot state from, by the block's mode (absent is
// "none"). MASCOT_KEY is both theme.json's top-level mascot ({"states": [...]}) and the block's mode.
const MASCOT_FOLDER = 'assets/mascot'
const MASCOT_KEY = 'mascot'
const STATES_KEY = 'states'
const MASCOT_NONE = 'none'
export const MOBILE_MASCOT_FILES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  clips: Object.freeze(['mp4', 'png']), stills: Object.freeze(['png']), [MASCOT_NONE]: Object.freeze([]),
})

type Manifest = Readonly<Record<string, unknown>>

export interface CheckResult {
  /** The checked theme.json when nothing was refused, else null. */
  readonly manifest: Manifest | null
  readonly files: ReadonlyMap<string, CheckedFile>
  readonly errors: readonly ThemeError[]
}

function manifestErrors(files: ReadonlyMap<string, CheckedFile>): { manifest: Manifest | null; errors: ThemeError[] } {
  const raw = files.get(MANIFEST_PATH)
  if (raw === undefined) {
    const message = `A theme package must hold ${MANIFEST_PATH} at its top level.`
    return { manifest: null, errors: [themeError('MISSING_FILE', MANIFEST_PATH, message)] }
  }
  const { data, error } = parseJson(raw.data, MANIFEST_PATH)
  if (error !== null) return { manifest: null, errors: [error] }
  const result = validateManifest(data)
  const errors = result.errors.map((item) => themeError(item.code, `${MANIFEST_PATH}#${item.path}`, item.message))
  return { manifest: result.manifest as unknown as Manifest | null, errors }
}

function codeErrors(files: ReadonlyMap<string, CheckedFile>): ThemeError[] {
  const errors = files.has(ENTRY_PATH)
    ? []
    : [themeError('MISSING_FILE', ENTRY_PATH, `A theme package must hold its code at ${ENTRY_PATH}.`)]
  const code = Array.from(files).reduce((sum, [path, file]) => (
    CODE_KINDS.has(fileKind(path)?.name ?? '') ? sum + file.data.length : sum
  ), 0)
  if (code <= CAPS.code) return errors
  const message = `The theme's JS and CSS together must be ${Math.floor(CAPS.code / KB)} KB or smaller.`
  return [...errors, themeError('CODE_TOO_LARGE', 'dist/', message)]
}

function prepaintFileErrors(files: ReadonlyMap<string, CheckedFile>): ThemeError[] {
  const raw = files.get(PREPAINT_PATH)
  if (raw === undefined) return []
  const { data, error } = parseJson(raw.data, PREPAINT_PATH)
  return error !== null ? [error] : prepaintErrors(data)
}

/** The font files a checked manifest's `mobile` block names, in role order as written (mobile_manifest.py `mobile_font_files`). */
function mobileFontFiles(manifest: Manifest): string[] {
  const block = own(manifest, MOBILE_FIELD)
  const fonts = isRecord(block) ? own(block, MOBILE_FONTS) : undefined
  return isRecord(fonts) ? Object.values(fonts).filter((path): path is string => typeof path === 'string') : []
}

/** The package files a checked manifest names: its previews, fonts, wordmark and mobile fonts (manifest.py `referenced_files`). */
function referencedFiles(manifest: Manifest): string[] {
  const list = (field: string): string[] => (Array.isArray(manifest[field]) ? (manifest[field] as string[]) : [])
  const brand = manifest.brand as { readonly wordmark?: string } | undefined
  return [...list('previews'), ...list('fonts'), ...(brand?.wordmark ? [brand.wordmark] : []), ...mobileFontFiles(manifest)]
}

/** The files the manifest names exist, its default look is a preset, and its CSS is scoped. */
function linkErrors(manifest: Manifest, files: ReadonlyMap<string, CheckedFile>): ThemeError[] {
  const errors = referencedFiles(manifest)
    .filter((path) => !files.has(path))
    .map((path) => themeError('MISSING_FILE', path, `theme.json names ${path}, which isn't in the package.`))
  const look = manifest.look
  if (typeof look === 'string' && !presetIds(files.keys()).has(look)) {
    errors.push(themeError('UNKNOWN_DEFAULT_LOOK', `${MANIFEST_PATH}#look`, `"look" names "${echo(look)}", which isn't a preset.`))
  }
  const style = files.get(STYLE_PATH)
  if (style === undefined) return errors
  // TextDecoder drops a leading BOM, as the server's utf-8-sig does.
  return [...errors, ...cssScopeErrors(new TextDecoder().decode(style.data), String(manifest.htmlClass))]
}

/** Why the defaults paint no phone: they don't fit the table (the web drops it whole), or they lack tokens (package.py `_cannot_paint`). */
function cannotPaint(table: unknown, missing: readonly string[]): string {
  if (bootTable(table) === null) {
    return `${PREPAINT_PATH}: "${PREPAINT_DEFAULTS}" doesn't name an option of every knob table and a cell of every `
      + 'pair table, with every number rule\'s value in range, so the web paints nothing from the table and a '
      + 'phone can\'t draw the theme. Fix the defaults, or give "mobile.tokens" instead.'
  }
  return `${PREPAINT_PATH}: the default look paints no ${missing.join(' or ')}, so a phone can't draw the theme `
    + 'from its looks. Give the default choices those tokens as "H S% L%" triplets (the web reads Studio tokens '
    + 'as hsl(var(--x)), so a #rrggbb paints nothing), or give "mobile.tokens" instead.'
}

/**
 * `fromLooks`: the prepaint table's `defaults` look, painted as the web paints it with no stored look
 * (boot.ts :145), gives the phone's ground and its text (package.py `_paint_errors`). A table that isn't
 * a JSON object is refused once, by prepaintFileErrors.
 */
function paintErrors(block: Manifest, files: ReadonlyMap<string, CheckedFile>): ThemeError[] {
  if (own(block, MOBILE_FROM_LOOKS) !== true) return []
  const raw = files.get(PREPAINT_PATH)
  if (raw === undefined) {
    return [themeError(MOBILE_CANNOT_PAINT, PREPAINT_PATH, (
      `"mobile.fromLooks" paints a phone from ${PREPAINT_PATH}, which isn't in the package. `
      + 'Add the table, or give "mobile.tokens" instead.'
    ))]
  }
  const { data, error } = parseJson(raw.data, PREPAINT_PATH)
  if (error !== null || !isRecord(data)) return []
  const missing = missingTokens(paintLook(data, null))
  if (missing.length === 0) return []
  return [themeError(MOBILE_CANNOT_PAINT, `${PREPAINT_PATH}#${PREPAINT_DEFAULTS}`, cannotPaint(data, missing))]
}

/** `clips`: every state's .mp4 and .png; `stills`: every state's .png. No .webm: a phone plays mp4 (package.py `_mascot_file_errors`). */
function mascotFileErrors(manifest: Manifest, block: Manifest, files: ReadonlyMap<string, CheckedFile>): ThemeError[] {
  const mode = own(block, MASCOT_KEY) ?? MASCOT_NONE
  const mascot = own(manifest, MASCOT_KEY)
  const states = isRecord(mascot) ? own(mascot, STATES_KEY) : undefined
  const suffixes: readonly string[] = typeof mode === 'string' && hasOwn(MOBILE_MASCOT_FILES, mode) ? MOBILE_MASCOT_FILES[mode] : []
  const needed = (Array.isArray(states) ? states : []).flatMap((state) => (
    suffixes.map((suffix) => `${MASCOT_FOLDER}/${String(state)}.${suffix}`)
  ))
  return needed
    .filter((path) => !files.has(path))
    .map((path) => themeError('MISSING_FILE', path, `"mobile.mascot" "${String(mode)}" needs ${path}, which isn't in the package.`))
}

/** A `mobile` block a phone draws without the theme's code: its colours paint, its mascot files exist (package.py `_mobile_link_errors`). */
function mobileLinkErrors(manifest: Manifest, files: ReadonlyMap<string, CheckedFile>): ThemeError[] {
  const block = own(manifest, MOBILE_FIELD)
  if (!isRecord(block)) return []
  return [...paintErrors(block, files), ...mascotFileErrors(manifest, block, files)]
}

function contentErrors(files: ReadonlyMap<string, CheckedFile>): { manifest: Manifest | null; errors: ThemeError[] } {
  const { manifest, errors } = manifestErrors(files)
  const bytes = new Map(Array.from(files, ([path, file]): [string, Uint8Array] => [path, file.data]))
  const all = [...errors, ...codeErrors(files), ...lookFileErrors(bytes), ...prepaintFileErrors(files)]
  if (manifest === null) return { manifest, errors: all }
  return { manifest, errors: [...all, ...linkErrors(manifest, files), ...mobileLinkErrors(manifest, files)] }
}

/** The package as core's reader would see it: refused with every reason, or its checked manifest. */
export function checkPackage(entries: readonly PackageEntry[]): CheckResult {
  const refusedPaths = pathErrors(entries)
  if (refusedPaths.length > 0) return { manifest: null, files: new Map(), errors: refusedPaths }
  const read = readFiles(entries)
  if (read.errors.length > 0) return { manifest: null, files: read.files, errors: read.errors }
  const { manifest, errors } = contentErrors(read.files)
  return { manifest: errors.length > 0 ? null : manifest, files: read.files, errors }
}
