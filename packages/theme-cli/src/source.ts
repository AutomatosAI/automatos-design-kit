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
 *
 * PRD-261 B-01i: the src/ of each kit workspace package the theme bundles (the vite-preset's
 * bundledPackages, the kit libraries its package.json names under dependencies) is packed as
 * `source/packages/<name>/src/<same path>`, under the same rules, so the review rebuilds every byte the
 * build read. source/packages/ is the packages' alone: a theme's own src/packages/ is refused.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { bundledPackages, kitPackageFolder, type BundledPackage } from '@automatos/vite-preset'
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
/** The folder of source/ that holds the workspace packages a theme bundles, each as <name>/src/. */
export const SOURCE_PACKAGES_DIR = 'packages'
const SOURCE_KIND = 'source'

export const NO_SOURCE_WARNING = (
  `the theme has no ${SOURCE_DIR}/ folder, so the package carries no ${SOURCE_FOLDER}/: it installs privately, `
  + `but the Marketplace review can't rebuild it.`
)

export type SourceResult =
  | { readonly ok: true; readonly entries: readonly PackageEntry[]; readonly warnings: readonly string[] }
  | { readonly ok: false; readonly errors: readonly ThemeError[] }

/** Where a src/ folder's files go: packed under source/`into`, shown from the theme folder under `from`. */
interface Placing {
  readonly into: string
  readonly from: string
}

interface Found {
  /** The path relative to its src/ folder. */
  readonly rel: string
  /** Where that folder's files are packed and shown. */
  readonly placing: Placing
  readonly kind: 'file' | 'link' | 'other'
  /** A file's bytes; empty for anything else. */
  readonly data: Uint8Array
}

const EMPTY = new Uint8Array(0)
/** The theme's own src/: packed as source/<same path>. */
const THEME_SOURCE: Placing = { into: '', from: `${SOURCE_DIR}/` }

/** The path a found file is packed at, relative to source/. */
const packedPath = (found: Found): string => `${found.placing.into}${found.rel}`

/**
 * Every non-dot entry under `srcDir` with its bytes, depth first, in name order; a link is listed, never followed.
 * Each path is placed as `placing` says.
 */
function sourceTree(srcDir: string, placing: Placing, under = ''): Found[] {
  return readdirSync(join(srcDir, under), { withFileTypes: true })
    .filter((dirent) => !isHidden(dirent.name))
    .sort((a, b) => byText(a.name, b.name))
    .flatMap((dirent): Found[] => {
      const rel = under ? `${under}/${dirent.name}` : dirent.name
      if (dirent.isSymbolicLink()) return [{ rel, placing, kind: 'link', data: EMPTY }]
      if (dirent.isDirectory()) return sourceTree(srcDir, placing, rel)
      if (!dirent.isFile()) return [{ rel, placing, kind: 'other', data: EMPTY }]
      return [{ rel, placing, kind: 'file', data: new Uint8Array(readFileSync(join(srcDir, rel))) }]
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

/** Why `data` can't be packed as source/`path`, or null. */
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

function shownPair({ rel, placing }: Found): string {
  return `${placing.from}${echo(rel)} can't be packed as ${SOURCE_FOLDER}/${placing.into}${echo(rel)}`
}

/** The refusal of one entry under src/ (or a bundled package's src/), or null when it packs. */
function foundError(found: Found): ThemeError | null {
  const at = `${found.placing.from}${found.rel}`
  if (found.kind === 'link') {
    return themeError('SOURCE_LINK', at, `${shownPair(found)}: it is a symbolic link; copy the file into ${SOURCE_DIR}/.`)
  }
  if (found.kind === 'other') return themeError('SOURCE_NOT_ALLOWED', at, `${shownPair(found)}: it is not a plain file.`)
  const problem = fileProblem(packedPath(found), found.data)
  return problem === null ? null : themeError('SOURCE_NOT_ALLOWED', at, `${shownPair(found)}: ${problem}.`)
}

/** The refusal of a theme's own src/packages/: source/packages/ holds the bundled packages alone. */
function reservedError(own: readonly Found[]): ThemeError | null {
  const prefix = `${SOURCE_PACKAGES_DIR}/`
  if (!own.some((item) => item.rel === SOURCE_PACKAGES_DIR || item.rel.startsWith(prefix))) return null
  const message = (
    `${SOURCE_DIR}/${prefix} is taken: pack writes ${SOURCE_FOLDER}/${prefix} from the workspace packages the theme `
    + `bundles, so give the folder another name.`
  )
  return themeError('SOURCE_RESERVED', `${SOURCE_DIR}/${prefix}`, message)
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

/** A bundled package's src/ files, placed under source/packages/<name>/src/, or why it has no src/ folder to pack. */
function packageFound(themeDir: string, bundled: BundledPackage): Found[] | ThemeError {
  const shown = relative(themeDir, bundled.dir).split(sep).join('/')
  const kind = statOf(bundled.dir, SOURCE_DIR)
  if (kind !== 'folder') {
    const what = kind === 'link' ? 'a symbolic link' : kind === 'none' ? 'missing' : 'not a folder'
    const message = `${bundled.name}'s ${SOURCE_DIR}/ (${shown}/${SOURCE_DIR}) is ${what}: pack copies a real ${SOURCE_DIR}/ folder.`
    return themeError(kind === 'link' ? 'SOURCE_LINK' : 'SOURCE_PACKAGE', `${shown}/${SOURCE_DIR}/`, message)
  }
  const into = `${SOURCE_PACKAGES_DIR}/${kitPackageFolder(bundled.name) ?? ''}/${SOURCE_DIR}/`
  return sourceTree(join(bundled.dir, SOURCE_DIR), { into, from: `${shown}/${SOURCE_DIR}/` })
}

/** Every bundled package's src/ files, or the refusals: a package with no src/, or one the build would refuse. */
function bundledFound(themeDir: string): { readonly found: readonly Found[] } | { readonly errors: readonly ThemeError[] } {
  let packages: readonly BundledPackage[]
  try {
    packages = bundledPackages(themeDir)
  } catch (error) {
    return { errors: [themeError('SOURCE_PACKAGE', 'package.json', error instanceof Error ? error.message : String(error))] }
  }
  const placed = packages.map((bundled) => packageFound(themeDir, bundled))
  const errors = placed.filter((item): item is ThemeError => !Array.isArray(item))
  return errors.length > 0 ? { errors } : { found: placed.flatMap((item) => (Array.isArray(item) ? item : [])) }
}

/** The package's source/ files from the theme folder's src/ and its bundled packages', or every reason it can't have them. */
export function sourceEntries(themeDir: string): SourceResult {
  const refused = folderError(themeDir)
  if (refused !== null) return { ok: false, errors: [refused] }
  if (statOf(themeDir, SOURCE_DIR) === 'none') return { ok: true, entries: [], warnings: [NO_SOURCE_WARNING] }
  const own = sourceTree(join(themeDir, SOURCE_DIR), THEME_SOURCE)
  const bundled = bundledFound(themeDir)
  if ('errors' in bundled) return { ok: false, errors: bundled.errors }
  const found = [...own, ...bundled.found]
  const fileErrors = found.map(foundError).filter((error): error is ThemeError => error !== null)
  const reserved = reservedError(own)
  const entryNames = own.filter((item) => item.kind === 'file').map((item) => item.rel)
  const errors = [...fileErrors, ...entryErrors(entryNames), ...(reserved === null ? [] : [reserved])]
  if (errors.length > 0) return { ok: false, errors }
  const entries = found.map((item): PackageEntry => ({ path: `${SOURCE_FOLDER}/${packedPath(item)}`, data: item.data }))
  return { ok: true, entries, warnings: [] }
}
