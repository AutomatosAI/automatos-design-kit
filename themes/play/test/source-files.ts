// Reading Play's source for the static tests: the files under src/ and the modules each one imports.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const THEME_MANIFEST = 'theme.json'

/**
 * Play's folder. In node, from this module's own file URL. Under jsdom, vitest gives modules web-style
 * URLs (not file:), so the folder vitest runs in is used instead: the workspace's `vitest run` runs in
 * themes/play. Either way the folder must hold theme.json, so a wrong guess fails loudly here.
 */
function themeRoot(): string {
  const root = import.meta.url.startsWith('file:') ? fileURLToPath(new URL('..', import.meta.url)) : process.cwd()
  if (!existsSync(join(root, THEME_MANIFEST))) throw new Error(`Play's folder not found: ${root} has no ${THEME_MANIFEST}`)
  return root
}

export const THEME_ROOT = themeRoot()
export const SOURCE_ROOT = join(THEME_ROOT, 'src')

const SCRIPT_FILE = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/
/**
 * A statement's `from '…'` (import, export … from, and the closing `} from '…'` of a multi-line
 * one), a bare `import '…'` and `import('…')`. The first two are read only at the start of a line, so
 * text such as "imported from 'zustand/traditional'" in a vendored warning is not taken for an import.
 */
const SPECIFIERS = [
  /^[ \t]*(?:import|export|\})[^'"\n]*?\bfrom[ \t]*['"]([^'"\n]+)['"]/gm,
  /^[ \t]*import[ \t]*['"]([^'"\n]+)['"]/gm,
  /\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g,
]

/** Every script file under src/, as a path relative to src/ with forward slashes. */
export function sourceScripts(): string[] {
  return readdirSync(SOURCE_ROOT, { encoding: 'utf8', recursive: true })
    .map((rel) => rel.split('\\').join('/'))
    .filter((rel) => SCRIPT_FILE.test(rel))
    .sort()
}

export function readSource(rel: string): string {
  return readFileSync(join(SOURCE_ROOT, rel), 'utf8')
}

export function readThemeFile(rel: string): string {
  return readFileSync(join(THEME_ROOT, rel), 'utf8')
}

/** The module specifiers a script names, in order of appearance per pattern. */
export function importSpecifiers(code: string): string[] {
  return SPECIFIERS.flatMap((pattern) => Array.from(code.matchAll(pattern), (match) => match[1]))
}

export function isRelative(specifier: string): boolean {
  return specifier.startsWith('./') || specifier.startsWith('../')
}
