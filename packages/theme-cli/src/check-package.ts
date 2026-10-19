/**
 * A theme package checked as core's reader checks it, before anything is zipped.
 *
 * The passes of core's orchestrator/services/themes/package.py `read_theme_package`, in its order:
 * the paths (members.ts), then each file's size and bytes, then the content: theme.json against
 * the manifest rules (incl. lookEditor@1 and styleSheet@1, PA-14), the entry and the code caps,
 * the look schema and presets, the prepaint table, the files the manifest names, the default
 * look, and dist/theme.css against the server's CSS scope check. Each pass that refuses anything
 * ends the check, as on the server, so the codes reported are the ones core would report.
 */
import { cssScopeErrors, STYLE_PATH } from '@automatos/vite-preset/css-scope'
import { echo, prepaintErrors, PREPAINT_PATH, themeError, type ThemeError } from './core/css-value.ts'
import { validateManifest } from './core/package-manifest.ts'
import { CAPS, CODE_KINDS, fileKind, KB } from './files.ts'
import { parseJson } from './json.ts'
import { lookFileErrors, presetIds } from './looks.ts'
import { pathErrors, readFiles, type CheckedFile, type PackageEntry } from './members.ts'

export const MANIFEST_PATH = 'theme.json'
export const ENTRY_PATH = 'dist/entry.js'

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

/** The package files a checked manifest names: its previews, fonts and wordmark. */
function referencedFiles(manifest: Manifest): string[] {
  const list = (field: string): string[] => (Array.isArray(manifest[field]) ? (manifest[field] as string[]) : [])
  const brand = manifest.brand as { readonly wordmark?: string } | undefined
  return [...list('previews'), ...list('fonts'), ...(brand?.wordmark ? [brand.wordmark] : [])]
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

function contentErrors(files: ReadonlyMap<string, CheckedFile>): { manifest: Manifest | null; errors: ThemeError[] } {
  const { manifest, errors } = manifestErrors(files)
  const bytes = new Map(Array.from(files, ([path, file]): [string, Uint8Array] => [path, file.data]))
  const all = [...errors, ...codeErrors(files), ...lookFileErrors(bytes), ...prepaintFileErrors(files)]
  return { manifest, errors: manifest === null ? all : [...all, ...linkErrors(manifest, files)] }
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
