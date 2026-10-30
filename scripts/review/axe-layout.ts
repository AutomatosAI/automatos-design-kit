/**
 * The submitted package laid out for the browser harness (PRD-261 B-02j's axe pass, axe.ts), in a work folder of its
 * own outside the review's container, so `automatos-theme shots` draws the package's own source as the kit draws a
 * theme of its own:
 *
 * - the theme folder as the reproducible build lays it out (rebuild.ts `themeFolderFiles`: every file but dist/,
 *   source/ as src/), at themes/theme/;
 * - each kit library it bundles (source/packages/<name>/src/, rebuild.ts `packageFolders`) at packages/<name>/ beside
 *   it, with a package.json whose exports name each src/ module as the kit's preset resolves it
 *   (`@automatos/<name>/<module>` is src/<module>, the first of MODULE_EXTENSIONS there, and `@automatos/<name>` is
 *   src/index), linked from node_modules/@automatos/<name>, so the harness's build finds the package's own copy of the
 *   library, never the kit's. React and the SDK come from the harness itself (its import map), as in kit CI.
 *
 * The harness draws a theme from src/entry.ts alone, so a package whose source/ entry is another is not laid out,
 * and the reason is given instead.
 */
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DEFAULT_ENTRY, KIT_SCOPE, MODULE_EXTENSIONS } from '@automatos/vite-preset'
import { entryOf, packageFolders, themeFolderFiles, writeFolder, type Files } from './rebuild.ts'

export const AXE_THEME_DIR = 'themes/theme'
export const AXE_PACKAGES_DIR = 'packages'
const NODE_MODULES_DIR = 'node_modules'
/** The one entry the harness draws (vite.harness.config.ts ENTRY_FILE): the preset's default, src/entry.ts. */
export const HARNESS_ENTRY = DEFAULT_ENTRY
const SRC_PREFIX = 'src/'
const INDEX_MODULE = 'index'
const MANIFEST_FILE = 'package.json'

export type Layout =
  | { readonly ok: true; readonly themeDir: string }
  | { readonly ok: false; readonly why: string }

/** A module path without its extension, or null for a file that is no module (MODULE_EXTENSIONS). */
function moduleOf(file: string): { readonly module: string; readonly rank: number } | null {
  const rank = MODULE_EXTENSIONS.findIndex((extension) => file.endsWith(extension))
  return rank < 0 ? null : { module: file.slice(0, -MODULE_EXTENSIONS[rank].length), rank }
}

/**
 * A bundled library's exports from the files of its src/ (paths relative to src/): `./<module>` for each module, the
 * first of MODULE_EXTENSIONS where two share a name, and `.` for src/index, as the preset resolves `@automatos/<name>`.
 */
export function packageExports(sourceFiles: readonly string[]): Record<string, string> {
  const chosen = new Map<string, { readonly file: string; readonly rank: number }>()
  sourceFiles.forEach((file) => {
    const found = moduleOf(file)
    const held = found === null ? undefined : chosen.get(found.module)
    if (found !== null && (held === undefined || found.rank < held.rank)) chosen.set(found.module, { file, rank: found.rank })
  })
  const entries = Array.from(chosen, ([module, { file }]): [string, string] => [`./${module}`, `./${SRC_PREFIX}${file}`])
  const index = chosen.get(INDEX_MODULE)
  const root: [string, string][] = index === undefined ? [] : [['.', `./${SRC_PREFIX}${index.file}`]]
  return Object.fromEntries([...root, ...entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))])
}

/** Each bundled library's package.json and its link under node_modules/@automatos/. */
function linkPackages(work: string, laid: ReadonlyMap<string, Uint8Array>, names: readonly string[]): void {
  names.forEach((name) => {
    const prefix = `${name}/${SRC_PREFIX}`
    const sources = Array.from(laid.keys()).filter((path) => path.startsWith(prefix)).map((path) => path.slice(prefix.length))
    const dir = join(work, AXE_PACKAGES_DIR, name)
    const manifest = { name: `${KIT_SCOPE}${name}`, private: true, type: 'module', exports: packageExports(sources) }
    writeFileSync(join(dir, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`)
    const link = join(work, NODE_MODULES_DIR, `${KIT_SCOPE}${name}`)
    mkdirSync(dirname(link), { recursive: true })
    rmSync(link, { force: true, recursive: true })
    symlinkSync(dir, link, 'dir')
  })
}

/** Lays the package out under `workDir` for the harness; the theme folder, or why it can't be drawn there. */
export function layOutPackage(files: Files, workDir: string): Layout {
  const folder = themeFolderFiles(files)
  const found = entryOf(folder)
  if ('error' in found) return { ok: false, why: found.error }
  if (found.entry !== HARNESS_ENTRY) {
    const entry = `source/${found.entry.slice(SRC_PREFIX.length)}`
    return { ok: false, why: `the harness draws a theme from ${HARNESS_ENTRY}, and this package's entry is ${entry}.` }
  }
  const bundled = packageFolders(files)
  if ('error' in bundled) return { ok: false, why: bundled.error }
  const themeDir = join(workDir, AXE_THEME_DIR)
  writeFolder(themeDir, folder)
  writeFolder(join(workDir, AXE_PACKAGES_DIR), bundled.files)
  linkPackages(workDir, bundled.files, bundled.names)
  return { ok: true, themeDir }
}
