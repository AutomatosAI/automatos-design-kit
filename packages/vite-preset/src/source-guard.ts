/**
 * The guard that keeps a theme's build to the theme's own source tree, `<root>/src/`.
 *
 * The Marketplace review rebuilds a package's source/ (written out as src/) and compares the dist/
 * byte for byte (PRD-261 §9). That proves the dist/ came from source/ only if nothing else can get
 * into the bundle, so the guard fails the build on:
 *   - a module the build loads that is not a `\0` virtual id and not a file under src/ (every
 *     import, import.meta.glob match and `?raw`/`?url` asset passes through `load`);
 *   - a chunk listing such a module, or importing at run time anything but the host's shared
 *     modules or its own chunks (a backstop on the output);
 *   - `new URL('<path>', import.meta.url)` and CSS `url()`, `@import`, `composes … from` and
 *     `image-set()` references that are absolute or resolve outside src/: Vite reads those files
 *     straight from disk and inlines them, without a `load`. CSS imports are followed, since their
 *     own references are read the same way.
 * Author builds run the same guard, so a theme that builds for its author builds in the review.
 */
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import type { Plugin } from 'vite'
import { isSharedModule } from './imports.ts'

/** The theme's source tree, relative to the theme root (a package's source/ is written out as it). */
export const SOURCE_DIR = 'src'

const VIRTUAL_PREFIX = '\0'
const QUERY_OR_HASH = /[?#].*$/s
const STYLE_ID = /\.(?:css|pcss|postcss|sss)$/
const SCRIPT_ID = /\.(?:[cm]?[jt]sx?)$/
/** Vite's own pattern for `new URL(..., import.meta.url)` (vite:asset-import-meta-url). */
const ASSET_URL = /\bnew\s+URL\s*\(\s*('[^']+'|"[^"]+"|`[^`]+`)\s*,\s*import\.meta\.url\s*(?:,\s*)?\)/g
const CSS_URL = /\burl\(\s*(?:'([^']*)'|"([^"]*)"|([^'")\s]*))\s*\)/gi
const CSS_IMPORT = /@import\s+(?:'([^']*)'|"([^"]*)")/gi
const CSS_COMPOSES = /\bcomposes\s*:[^;{}]*?\bfrom\s+(?:'([^']*)'|"([^"]*)")/gi
const CSS_IMAGE_SET = /\bimage-set\(((?:[^()]|\([^()]*\))*)\)/gi
const QUOTED = /'([^']*)'|"([^"]*)"/g
/** A reference the build leaves as text: data:, a scheme:// URL other than file:, //host, #fragment. */
const NOT_A_FILE = /^(?:data:|(?!file:)[a-z][a-z0-9+.-]*:\/\/|\/\/|#)/i
const ABSOLUTE = /^(?:\/|file:|[a-z]:[\\/])/i

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

function shown(file: string, tree: SourceTree): string {
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

/** Why a file reference in `from` may not be read by the build, or null when it may. */
export function referenceProblem(reference: string, from: string, tree: SourceTree): string | null {
  const ref = reference.trim()
  if (ref === '' || NOT_A_FILE.test(ref) || (ref.startsWith('`') && ref.includes('${'))) return null
  const path = ref.replace(/^`|`$/g, '').replace(QUERY_OR_HASH, '')
  const where = shown(from, tree)
  if (ABSOLUTE.test(path)) {
    return `${where} refers to "${path}", an absolute path: refer to files under ${SOURCE_DIR}/ by a relative path.`
  }
  if (!path.startsWith('./') && !path.startsWith('../')) {
    return `${where} refers to "${path}": write it as a relative path (./ or ../) to a file under ${SOURCE_DIR}/.`
  }
  if (isInsideSource(resolve(dirname(from), path), tree)) return null
  return `${where} refers to "${path}", which is outside the theme's ${SOURCE_DIR}/.`
}

function captured(text: string, pattern: RegExp): string[] {
  return Array.from(text.matchAll(pattern), (match) => match.slice(1).find((group) => group !== undefined) ?? '')
}

/** The `new URL(..., import.meta.url)` references in a script (quotes kept off, backticks kept on). */
export function scriptReferences(code: string): string[] {
  return captured(code, ASSET_URL).map((raw) => (raw.startsWith('`') ? raw : raw.slice(1, -1)))
}

/** The file references in a stylesheet: url(), image-set() strings, @import and composes … from. */
export function styleReferences(css: string): { readonly imports: string[]; readonly assets: string[] } {
  const imports = [...captured(css, CSS_IMPORT), ...captured(css, CSS_COMPOSES)]
  const sets = captured(css, CSS_IMAGE_SET).flatMap((inner) => captured(inner, QUOTED))
  return { imports, assets: [...captured(css, CSS_URL), ...sets] }
}

/** Every problem in a stylesheet's references, following its imports under src/. */
function styleProblems(file: string, css: string, tree: SourceTree, seen: Set<string>): string[] {
  seen.add(file)
  const { imports, assets } = styleReferences(css)
  const problems = [...imports, ...assets].flatMap((ref) => referenceProblem(ref, file, tree) ?? [])
  const nested = imports.flatMap((ref) => {
    if (referenceProblem(ref, file, tree) !== null || NOT_A_FILE.test(ref.trim())) return []
    const target = resolve(dirname(file), ref.trim().replace(QUERY_OR_HASH, ''))
    if (seen.has(target) || !existsSync(target)) return []
    return styleProblems(target, readFileSync(target, 'utf8'), tree, seen)
  })
  return [...problems, ...nested]
}

/** Every problem in the file references of the module `id` with text `code`. */
export function transformProblems(code: string, id: string, tree: SourceTree): string[] {
  if (id.startsWith(VIRTUAL_PREFIX)) return []
  const file = id.replace(QUERY_OR_HASH, '')
  if (STYLE_ID.test(file)) return styleProblems(file, code, tree, new Set())
  if (!SCRIPT_ID.test(file)) return []
  return scriptReferences(code).flatMap((ref) => referenceProblem(ref, file, tree) ?? [])
}

interface ChunkLike {
  readonly type: 'chunk'
  readonly moduleIds: readonly string[]
  readonly imports: readonly string[]
  readonly dynamicImports: readonly string[]
}

/** Every problem in the output: modules from outside src/, run-time imports the host can't serve. */
export function bundleProblems(bundle: Readonly<Record<string, { readonly type: string }>>, tree: SourceTree): string[] {
  const chunks = Object.values(bundle).filter((item): item is ChunkLike => item.type === 'chunk')
  return chunks.flatMap((chunk) => [
    ...chunk.moduleIds.flatMap((id) => moduleProblem(id, tree) ?? []),
    ...[...chunk.imports, ...chunk.dynamicImports].flatMap((target) => (
      target in bundle || isSharedModule(target)
        ? []
        : [`The build imports "${target}" at run time, which is not one of the host's shared modules.`]
    )),
  ])
}

function report(problems: readonly string[]): string {
  return Array.from(new Set(problems)).join('\n')
}

/** The plugin that fails the build on anything from outside the theme's src/. */
export function sourceGuard(): Plugin {
  let tree: SourceTree | null = null
  const current = (): SourceTree => {
    if (tree === null) throw new Error('automatosTheme(): the source guard ran before the config was resolved.')
    return tree
  }
  return {
    name: 'automatos-theme:source',
    enforce: 'pre',
    configResolved(config) {
      tree = sourceTree(config.root)
    },
    load(id) {
      const problem = moduleProblem(id, current())
      if (problem !== null) this.error(problem)
      return null
    },
    transform(code, id) {
      const problems = transformProblems(code, id, current())
      if (problems.length > 0) this.error(report(problems))
      return null
    },
    generateBundle(_options, bundle) {
      const problems = bundleProblems(bundle, current())
      if (problems.length > 0) this.error(report(problems))
    },
  }
}
