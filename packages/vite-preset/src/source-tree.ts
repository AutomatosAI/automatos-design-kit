/**
 * The theme's source tree, `<root>/src/`, with the `src/` of each kit workspace package the theme bundles
 * (workspace-packages.ts), and the one rule every source check shares: a module or file the build reads
 * must be a `\0` virtual id, one of the host's shared modules, or a file under one of those src/ folders
 * (resolved through symlinks).
 */
import { realpathSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { isSharedModule } from './imports.ts'

/** The theme's source tree, relative to the theme root (a package's source/ is written out as it). */
export const SOURCE_DIR = 'src'

export const VIRTUAL_PREFIX = '\0'
export const QUERY_OR_HASH = /[?#].*$/s

/** A kit workspace package the build bundles: its name and its folder, of which the build reads only src/. */
export interface BundledPackage {
  readonly name: string
  readonly dir: string
}

export interface SourceTree {
  /** The theme root, for messages. */
  readonly root: string
  /** The folders the build reads, as given: the theme's src/, then each bundled package's src/. */
  readonly sources: readonly string[]
  /** The same folders as given and as resolved through symlinks. */
  readonly dirs: readonly string[]
  /** The workspace packages the build bundles. */
  readonly packages: readonly BundledPackage[]
}

/** `path` resolved through symlinks, or as given when it doesn't exist. */
export function realOr(path: string): string {
  try {
    return realpathSync(path)
  } catch {
    return path
  }
}

/** The source tree of the theme at `root`, with the src/ of each package in `packages`. */
export function sourceTree(root: string, packages: readonly BundledPackage[] = []): SourceTree {
  const sources = [resolve(root, SOURCE_DIR), ...packages.map((item) => join(item.dir, SOURCE_DIR))]
  return { root, sources, dirs: Array.from(new Set(sources.flatMap((dir) => [dir, realOr(dir)]))), packages }
}

/** True when `file` (resolved through symlinks when it exists) sits under the source tree. */
export function isInsideSource(file: string, tree: SourceTree): boolean {
  const path = realOr(resolve(file))
  return tree.dirs.some((dir) => {
    const rel = relative(dir, path)
    return rel !== '' && !isAbsolute(rel) && rel.split(sep)[0] !== '..'
  })
}

/** `file` relative to the theme root, for messages. */
export function shown(file: string, tree: SourceTree): string {
  return relative(tree.root, file).split(sep).join('/') || file
}

/** Why the build may not bundle the module `id`, or null when it may. */
export function moduleProblem(id: string, tree: SourceTree): string | null {
  if (id.startsWith(VIRTUAL_PREFIX) || isSharedModule(id)) return null
  const file = id.replace(QUERY_OR_HASH, '')
  if (!isAbsolute(file)) return `The build would bundle "${id}", which is not a file under the theme's ${SOURCE_DIR}/.`
  if (isInsideSource(file, tree)) return null
  return (
    `The build would bundle ${shown(file, tree)}, which is outside the theme's ${SOURCE_DIR}/ (and the ${SOURCE_DIR}/ `
    + 'of each workspace package it bundles): a theme builds from its own source only.'
  )
}
