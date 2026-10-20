/**
 * A package's source/: the theme folder's src/ exactly as it was built, so the Marketplace review
 * can rebuild dist/ from it and compare the bytes (PRD-261 §9, C-06p1).
 *
 * Every file under src/ but dotfiles is packed as `source/<same path>`, byte for byte. pack writes
 * source/ itself, so a source/ in the theme folder is refused. So is anything under src/ the review
 * could not rebuild from, or core would not take as source: a file that is not a source kind (its
 * extension or name, more than 8 levels deep, over 1 MB, not UTF-8), a symbolic link, or not exactly
 * one entry module. A refusal names both paths and the pack writes nothing. A theme with no src/
 * (core's hello test theme, a hand-built package) still packs, with one warning, since only a
 * Marketplace submission needs source/.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { byText, isHidden, statOf } from './collect.ts'
import { echo, themeError, type ThemeError } from './core/css-value.ts'
import { fileKind, KB } from './files.ts'
import type { PackageEntry } from './members.ts'

/** The theme folder's source tree, which pack copies. */
export const SOURCE_DIR = 'src'
/** The package folder pack copies it to. */
export const SOURCE_FOLDER = 'source'
/** The entry modules, relative to src/ (and so to source/): a theme has exactly one. */
export const SOURCE_ENTRY_CANDIDATES: readonly string[] = Object.freeze(['entry.ts', 'entry.tsx', 'entry.js', 'entry.jsx'])
/** Path levels under source/ core reads (package.py; files.ts's source kind: 7 folders and the file). */
export const SOURCE_MAX_DEPTH = 8
const SOURCE_KIND = 'source'

export const NO_SOURCE_WARNING = (
  `the theme has no ${SOURCE_DIR}/ folder, so the package carries no ${SOURCE_FOLDER}/: it installs privately, `
  + `but the Marketplace review can't rebuild it.`
)

export type SourceResult =
  | { readonly ok: true; readonly entries: readonly PackageEntry[]; readonly warnings: readonly string[] }
  | { readonly ok: false; readonly errors: readonly ThemeError[] }

interface Found {
  /** The path relative to src/. */
  readonly path: string
  readonly kind: 'file' | 'link' | 'other'
  /** A file's bytes; empty for anything else. */
  readonly data: Uint8Array
}

const EMPTY = new Uint8Array(0)

/** Every non-dot entry under `srcDir` with its bytes, depth first, in name order; a link is listed, never followed. */
function sourceTree(srcDir: string, relative = ''): Found[] {
  return readdirSync(join(srcDir, relative), { withFileTypes: true })
    .filter((dirent) => !isHidden(dirent.name))
    .sort((a, b) => byText(a.name, b.name))
    .flatMap((dirent): Found[] => {
      const path = relative ? `${relative}/${dirent.name}` : dirent.name
      if (dirent.isSymbolicLink()) return [{ path, kind: 'link', data: EMPTY }]
      if (dirent.isDirectory()) return sourceTree(srcDir, path)
      if (!dirent.isFile()) return [{ path, kind: 'other', data: EMPTY }]
      return [{ path, kind: 'file', data: new Uint8Array(readFileSync(join(srcDir, path))) }]
    })
}

function isUtf8(data: Uint8Array): boolean {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(data)
    return true
  } catch {
    return false
  }
}

/** Why `data` at src/`path` can't be packed as source/`path`, or null. */
function fileProblem(path: string, data: Uint8Array): string | null {
  const depth = path.split('/').length
  if (depth > SOURCE_MAX_DEPTH) {
    return `it is ${depth} levels deep, and ${SOURCE_FOLDER}/ holds files at most ${SOURCE_MAX_DEPTH} levels deep`
  }
  const kind = fileKind(`${SOURCE_FOLDER}/${path}`)
  if (kind?.name !== SOURCE_KIND) {
    return `${SOURCE_FOLDER}/ holds only plain-named code, CSS, JSON, Markdown and text files (PRD-261 §4.2)`
  }
  if (data.length > kind.cap) return `it is ${data.length} bytes, over the ${kind.cap / KB} KB a source file may be`
  return isUtf8(data) ? null : 'it is not UTF-8 text'
}

function shownPair(path: string): string {
  return `${SOURCE_DIR}/${echo(path)} can't be packed as ${SOURCE_FOLDER}/${echo(path)}`
}

/** The refusal of one entry under src/, or null when it packs. */
function foundError(found: Found): ThemeError | null {
  const at = `${SOURCE_DIR}/${found.path}`
  if (found.kind === 'link') {
    return themeError('SOURCE_LINK', at, `${shownPair(found.path)}: it is a symbolic link; copy the file into ${SOURCE_DIR}/.`)
  }
  if (found.kind === 'other') return themeError('SOURCE_NOT_ALLOWED', at, `${shownPair(found.path)}: it is not a plain file.`)
  const problem = fileProblem(found.path, found.data)
  return problem === null ? null : themeError('SOURCE_NOT_ALLOWED', at, `${shownPair(found.path)}: ${problem}.`)
}

/** Refusals unless src/ holds exactly one entry module at its top level. */
function entryErrors(files: readonly string[]): ThemeError[] {
  const found = SOURCE_ENTRY_CANDIDATES.filter((name) => files.includes(name))
  if (found.length === 1) return []
  const names = SOURCE_ENTRY_CANDIDATES.map((name) => `${SOURCE_DIR}/${name}`).join(', ')
  if (found.length === 0) {
    const message = `${SOURCE_DIR}/ has no entry module: the review rebuilds from one of ${names}.`
    return [themeError('NO_SOURCE_ENTRY', `${SOURCE_DIR}/`, message)]
  }
  const several = found.map((name) => `${SOURCE_DIR}/${name}`).join(', ')
  const message = `${SOURCE_DIR}/ has more than one entry module (${several}): keep one of ${names}.`
  return [themeError('SEVERAL_SOURCE_ENTRIES', `${SOURCE_DIR}/`, message)]
}

/** Why the theme folder's own `source/` or `src/` stops the pack before src/ is read, or null. */
function folderError(themeDir: string): ThemeError | null {
  if (statOf(themeDir, SOURCE_FOLDER) !== 'none') {
    const message = `${SOURCE_FOLDER}/ is in the theme folder: pack writes ${SOURCE_FOLDER}/ from ${SOURCE_DIR}/, so delete it.`
    return themeError('SOURCE_ON_DISK', `${SOURCE_FOLDER}/`, message)
  }
  const src = statOf(themeDir, SOURCE_DIR)
  if (src === 'folder' || src === 'none') return null
  const code = src === 'link' ? 'SOURCE_LINK' : 'SOURCE_NOT_ALLOWED'
  const what = src === 'link' ? 'a symbolic link' : 'not a folder'
  return themeError(code, `${SOURCE_DIR}/`, `${SOURCE_DIR} is ${what}: pack copies a real ${SOURCE_DIR}/ folder to ${SOURCE_FOLDER}/.`)
}

/** The package's source/ files from the theme folder's src/, or every reason it can't have them. */
export function sourceEntries(themeDir: string): SourceResult {
  const refused = folderError(themeDir)
  if (refused !== null) return { ok: false, errors: [refused] }
  if (statOf(themeDir, SOURCE_DIR) === 'none') return { ok: true, entries: [], warnings: [NO_SOURCE_WARNING] }
  const found = sourceTree(join(themeDir, SOURCE_DIR))
  const fileErrors = found.map(foundError).filter((error): error is ThemeError => error !== null)
  const errors = [...fileErrors, ...entryErrors(found.filter((item) => item.kind === 'file').map((item) => item.path))]
  if (errors.length > 0) return { ok: false, errors }
  const entries = found.map((item): PackageEntry => ({ path: `${SOURCE_FOLDER}/${item.path}`, data: item.data }))
  return { ok: true, entries, warnings: [] }
}
