/**
 * The files of a theme folder that go into its package.
 *
 * A package holds theme.json, the top-level docs (README.md, CHANGELOG.md, LICENSE), and everything
 * under dist/, boot/, looks/, assets/ and source/ (PRD-261 §4.2). This file reads all of them but
 * source/ from the theme folder as they are; pack writes source/ from the folder's src/ (source.ts)
 * and never reads a source/ folder from disk. The rest of the folder (package.json, vite.config.ts,
 * node_modules) is the theme's build, not its package, and is left out. Inside the packed folders
 * nothing is skipped but dotfiles (a Finder .DS_Store), so a file
 * the server would refuse, a source map say, is reported rather than dropped. A symbolic link is
 * reported as one (the server refuses links) and never followed.
 */
import { lstatSync, readdirSync, readFileSync, type Dirent } from 'node:fs'
import { join } from 'node:path'
import type { PackageEntry } from './members.ts'

export const PACKED_FOLDERS: readonly string[] = ['dist', 'boot', 'looks', 'assets']
export const PACKED_TOP_FILES: readonly string[] = [
  'theme.json', 'README.md', 'CHANGELOG.md', 'LICENSE', 'LICENSE.md', 'LICENSE.txt',
]

const EMPTY = new Uint8Array(0)

/** True for a dotfile or dot folder, which no package holds. */
export function isHidden(name: string): boolean {
  return name.startsWith('.')
}

/** Orders anything with a name or a path by it, code unit by code unit (the zip's order). */
export function byText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function entryFor(themeDir: string, path: string, linked: boolean): PackageEntry {
  if (linked) return { path, data: EMPTY, link: true }
  return { path, data: new Uint8Array(readFileSync(join(themeDir, path))) }
}

/** Every file under `folder` (a package path), depth first, in name order. */
function folderEntries(themeDir: string, folder: string): PackageEntry[] {
  const dirents: Dirent[] = readdirSync(join(themeDir, folder), { withFileTypes: true })
  return dirents
    .filter((dirent) => !isHidden(dirent.name))
    .sort((a, b) => byText(a.name, b.name))
    .flatMap((dirent): PackageEntry[] => {
      const path = `${folder}/${dirent.name}`
      if (dirent.isSymbolicLink()) return [entryFor(themeDir, path, true)]
      if (dirent.isDirectory()) return folderEntries(themeDir, path)
      return dirent.isFile() ? [entryFor(themeDir, path, false)] : []
    })
}

/** The kind of thing at `path` in the theme folder, without following a link. */
export function statOf(themeDir: string, path: string): 'file' | 'folder' | 'link' | 'none' {
  try {
    const stat = lstatSync(join(themeDir, path))
    if (stat.isSymbolicLink()) return 'link'
    return stat.isDirectory() ? 'folder' : stat.isFile() ? 'file' : 'none'
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 'none'
    throw error
  }
}

/** The package's files from a theme folder, in path order. */
export function collectThemeFiles(themeDir: string): PackageEntry[] {
  const top = PACKED_TOP_FILES.flatMap((path): PackageEntry[] => {
    const kind = statOf(themeDir, path)
    return kind === 'file' || kind === 'link' ? [entryFor(themeDir, path, kind === 'link')] : []
  })
  const folders = PACKED_FOLDERS.flatMap((folder): PackageEntry[] => {
    const kind = statOf(themeDir, folder)
    if (kind === 'link') return [entryFor(themeDir, folder, true)]
    return kind === 'folder' ? folderEntries(themeDir, folder) : []
  })
  return [...top, ...folders].sort((a, b) => byText(a.path, b.path))
}
