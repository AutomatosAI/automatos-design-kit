// Reading HUD's own files for the static tests: the theme folder, its src/ and the kit's root beside it.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const THEME_MANIFEST = 'theme.json'

/**
 * HUD's folder: two levels up from this module's file. The file URL goes to Node as the plain string, never
 * through `new URL(...)`: under jsdom the global URL is jsdom's own, and Node's fileURLToPath refuses the object
 * it makes. The folder must hold theme.json, so a wrong path fails loudly here.
 */
function themeRoot(): string {
  const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
  if (!existsSync(join(root, THEME_MANIFEST))) throw new Error(`HUD's folder not found: ${root} has no ${THEME_MANIFEST}`)
  return root
}

export const THEME_ROOT = themeRoot()
export const SOURCE_ROOT = join(THEME_ROOT, 'src')
/** The kit's root, two folders up from themes/hud. */
export const KIT_ROOT = join(THEME_ROOT, '..', '..')
/** The Command design's look files, which HUD's looks/ copies byte for byte. */
export const DESIGN_LOOKS = join(KIT_ROOT, 'references', 'designs', 'command')

const SCRIPT_FILE = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/
const STYLE_FILE = /\.css$/

function filesUnder(root: string, pattern: RegExp): string[] {
  return readdirSync(root, { encoding: 'utf8', recursive: true })
    .map((rel) => rel.split('\\').join('/'))
    .filter((rel) => pattern.test(rel))
    .sort()
}

/** Every script under src/, relative to src/ with forward slashes. */
export function sourceScripts(): string[] {
  return filesUnder(SOURCE_ROOT, SCRIPT_FILE)
}

/** Every stylesheet under src/, relative to src/. */
export function sourceStyles(): string[] {
  return filesUnder(SOURCE_ROOT, STYLE_FILE)
}

export function readSource(rel: string): string {
  return readFileSync(join(SOURCE_ROOT, rel), 'utf8')
}

export function readThemeFile(rel: string): string {
  return readFileSync(join(THEME_ROOT, rel), 'utf8')
}

export function readThemeJson<T>(rel: string): T {
  return JSON.parse(readThemeFile(rel)) as T
}

/**
 * A statement's `from '…'` (import, export … from, and the closing `} from '…'` of a multi-line one), a bare
 * `import '…'` and `import('…')`, as themes/play/test/source-files.ts reads them (Play 1.1.1).
 */
const SPECIFIERS = [
  /^[ \t]*(?:import|export|\})[^'"\n]*?\bfrom[ \t]*['"]([^'"\n]+)['"]/gm,
  /^[ \t]*import[ \t]*['"]([^'"\n]+)['"]/gm,
  /\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g,
]

/** The module specifiers a script names. */
export function importSpecifiers(code: string): string[] {
  return SPECIFIERS.flatMap((pattern) => Array.from(code.matchAll(pattern), (match) => match[1]))
}

export function isRelative(specifier: string): boolean {
  return specifier.startsWith('./') || specifier.startsWith('../')
}
