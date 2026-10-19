/**
 * The guard that keeps a theme's build to the theme's own source tree, `<root>/src/`.
 *
 * The Marketplace review rebuilds a package's source/ (written out as src/) and compares the dist/
 * byte for byte (PRD-261 §9). That proves the dist/ came from source/ only if nothing else can get
 * into the bundle. The guarantee comes from what the build actually read and wrote, not from how a
 * reference is spelled:
 *   - `load` refuses a module that is not a `\0` virtual id and not a file under src/ (every import,
 *     import.meta.glob match and `?raw`/`?url` asset passes through it);
 *   - css-origin.ts refuses a stylesheet that took in CSS from a file outside src/ (an `@import`
 *     however written: postcss-import reads it from disk without a `load`);
 *   - output-check.ts refuses an output that lists a module from outside src/, imports at run time
 *     anything but the host's shared modules or its own chunks, emits an asset made from a file
 *     outside src/, or inlines a data: URL that is not the content of a file under src/ (Vite inlines
 *     every url() and `new URL('…', import.meta.url)` asset in library mode, read straight from disk).
 * The scan below of `new URL('<path>', import.meta.url)` and CSS `url()`, `@import`, `composes … from`
 * and `image-set()` references is only an early, friendly error with the file and the reference in
 * it. It reads the text with patterns, so a reference spelled another way (a CSS escape, a comment, a
 * string built at run time) can pass it; the checks above still refuse what such a reference pulls in.
 * Two gaps remain: the scan is the only check on `composes … from` (postcss-modules prepends the
 * composed file's CSS with no source file on it), and nothing here reads a Sass, Less or Stylus
 * file's own imports (the preprocessor merges them before PostCSS sees the result).
 * Author builds run the same guard, so a theme that builds for its author builds in the review.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { Plugin } from 'vite'
import { bundleProblems } from './output-check.ts'
import { isInsideSource, moduleProblem, QUERY_OR_HASH, shown, sourceTree, SOURCE_DIR, VIRTUAL_PREFIX, type SourceTree } from './source-tree.ts'

export { isInsideSource, moduleProblem, sourceTree, SOURCE_DIR, type SourceTree } from './source-tree.ts'

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
    // After Vite's own generateBundle hooks, so the library's stylesheet is in the bundle too.
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const problems = bundleProblems(bundle, current())
        if (problems.length > 0) this.error(report(problems))
      },
    },
  }
}
