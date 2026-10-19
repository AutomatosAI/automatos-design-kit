/**
 * The theme's source tree, `<root>/src/`, and the one rule every source check shares: a module or
 * file the build reads must be a `\0` virtual id, one of the host's shared modules, or a file under
 * src/ (resolved through symlinks).
 */
import { realpathSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { isSharedModule } from './imports.ts'

/** The theme's source tree, relative to the theme root (a package's source/ is written out as it). */
export const SOURCE_DIR = 'src'

export const VIRTUAL_PREFIX = '\0'
export const QUERY_OR_HASH = /[?#].*$/s

export interface SourceTree {
  /** The theme root, for messages. */
  readonly root: string
  /** The source tree as given and as resolved through symlinks. */
  readonly dirs: readonly string[]
}

function realOr(path: string): string {
  try {
    return realpathSync(path)
  } catch {
    return path
  }
}

/** The source tree of the theme at `root`. */
export function sourceTree(root: string): SourceTree {
  const dir = resolve(root, SOURCE_DIR)
  return { root, dirs: Array.from(new Set([dir, realOr(dir)])) }
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
  return `The build would bundle ${shown(file, tree)}, which is outside the theme's ${SOURCE_DIR}/: a theme builds from its own source only.`
}
