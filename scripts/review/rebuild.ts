/**
 * The reproducible build: the submission's source/ rebuilt with the kit's own vite-preset, and its
 * dist/ compared with the package's, file by file (PRD-261 §9; D3, 19 Oct: required in v1).
 *
 * The layout a package's source/ follows: it is the theme folder's src/ as it was built, so every
 * file under source/ is the file at the same path under the theme's src/. The review writes the
 * package back out as a theme folder (every file but dist/, with source/ as src/), and builds it
 * the way a kit theme builds: `vite build` from the theme folder with only `automatosTheme()` (the
 * entry is the one `src/entry.{ts,tsx,js,jsx}` there is; the names are the theme CLI's, which packs
 * source/ from src/ and refuses a src/ without exactly one). Never the package's own config: no
 * config file, no .env, PostCSS options set inline (empty, so no postcss.config is searched for),
 * and only the preset's plugins.
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { build } from 'vite'
import { automatosTheme, OUT_DIR } from '@automatos/vite-preset'
import { SOURCE_DIR, SOURCE_ENTRY_CANDIDATES } from '../../packages/theme-cli/src/source.ts'
import { SOURCE_PREFIX } from './js-rules.ts'

export const BUILD_SOURCE_DIR = `${SOURCE_DIR}/`
export const ENTRY_CANDIDATES: readonly string[] = SOURCE_ENTRY_CANDIDATES.map((name) => `${BUILD_SOURCE_DIR}${name}`)
export const DIST_PREFIX = `${OUT_DIR}/`
const BUILD_ERROR_MAX = 1_500

export type Files = ReadonlyMap<string, Uint8Array>

export type RebuildResult =
  | { readonly ok: true; readonly entry: string; readonly dist: Files }
  | { readonly ok: false; readonly error: string }

export interface DistComparison {
  readonly same: boolean
  readonly differing: readonly string[]
  /** In the package's dist/ but not built from source/. */
  readonly onlyInPackage: readonly string[]
  /** Built from source/ but not in the package's dist/. */
  readonly onlyInBuild: readonly string[]
}

/** The theme folder a package's files rebuild in: no dist/, and source/ as src/. */
export function themeFolderFiles(files: Files): Map<string, Uint8Array> {
  const folder = new Map<string, Uint8Array>()
  files.forEach((data, path) => {
    if (path.startsWith(DIST_PREFIX)) return
    const target = path.startsWith(SOURCE_PREFIX) ? `${BUILD_SOURCE_DIR}${path.slice(SOURCE_PREFIX.length)}` : path
    folder.set(target, data)
  })
  return folder
}

/** The one entry the folder has, or why there isn't one. */
export function entryOf(folder: ReadonlyMap<string, Uint8Array>): { entry: string } | { error: string } {
  const found = ENTRY_CANDIDATES.filter((path) => folder.has(path))
  if (found.length === 1) return { entry: found[0] }
  const names = ENTRY_CANDIDATES.map((path) => `${SOURCE_PREFIX}${path.slice(BUILD_SOURCE_DIR.length)}`).join(', ')
  if (found.length === 0) return { error: `source/ has no entry module: one of ${names}.` }
  return { error: `source/ has more than one entry module (${found.join(', ')}); keep one of ${names}.` }
}

function writeFolder(root: string, folder: ReadonlyMap<string, Uint8Array>): void {
  rmSync(root, { recursive: true, force: true })
  folder.forEach((data, path) => {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), data)
  })
}

/** Every file under `dir`, keyed by `prefix` + its path relative to `dir`. */
export function readTree(dir: string, prefix: string): Map<string, Uint8Array> {
  const tree = new Map<string, Uint8Array>()
  const walk = (relative: string): void => {
    readdirSync(join(dir, relative), { withFileTypes: true }).forEach((dirent) => {
      const path = relative ? `${relative}/${dirent.name}` : dirent.name
      if (dirent.isDirectory()) walk(path)
      else if (dirent.isFile()) tree.set(`${prefix}${path}`, new Uint8Array(readFileSync(join(dir, path))))
    })
  }
  walk('')
  return tree
}

/**
 * `vite build` of a theme folder with the kit's preset alone, run from the folder as a kit theme's
 * build is (CSS module names hash the file's path from the working folder).
 */
export async function buildThemeFolder(root: string, entry: string): Promise<void> {
  const previous = process.cwd()
  process.chdir(root)
  try {
    await build({
      root,
      configFile: false,
      envDir: false,
      logLevel: 'silent',
      css: { postcss: {} },
      plugins: [automatosTheme({ entry })],
    })
  } finally {
    process.chdir(previous)
  }
}

function buildErrorText(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  return text.length > BUILD_ERROR_MAX ? `${text.slice(0, BUILD_ERROR_MAX)}…` : text
}

/** Rebuilds the package's source/ in `workDir` and reads the dist/ it wrote. */
export async function rebuildDist(files: Files, workDir: string): Promise<RebuildResult> {
  const folder = themeFolderFiles(files)
  const found = entryOf(folder)
  if ('error' in found) return { ok: false, error: found.error }
  const root = join(workDir, 'theme')
  writeFolder(root, folder)
  try {
    await buildThemeFolder(root, found.entry)
  } catch (error) {
    return { ok: false, error: `The kit's build of source/ failed: ${buildErrorText(error)}` }
  }
  return { ok: true, entry: found.entry, dist: readTree(join(root, OUT_DIR), DIST_PREFIX) }
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0
}

/** The package's dist/ against the rebuilt one: equal only when every path and byte matches. */
export function compareDist(files: Files, rebuilt: Files): DistComparison {
  const shipped = Array.from(files.keys()).filter((path) => path.startsWith(DIST_PREFIX)).sort()
  const built = Array.from(rebuilt.keys()).sort()
  const onlyInPackage = shipped.filter((path) => !rebuilt.has(path))
  const onlyInBuild = built.filter((path) => !files.has(path))
  const differing = shipped.filter((path) => {
    const fresh = rebuilt.get(path)
    return fresh !== undefined && !sameBytes(files.get(path) as Uint8Array, fresh)
  })
  const same = onlyInPackage.length === 0 && onlyInBuild.length === 0 && differing.length === 0
  return { same, differing, onlyInPackage, onlyInBuild }
}
