/**
 * The `uses` check: theme.json's declared SDK areas against the SDK names the bundle imports.
 *
 * A port of core's orchestrator/services/themes/sdk_uses.py (`uses_check`) at the commit
 * report.ts's CORE_SHA names, over its name list `data/sdk-surface.json`, vendored byte for byte in
 * src/core/data. It reads the code the browser runs (`dist/entry.js`, `dist/chunks/*.js`):
 *
 * - a named import or re-export gives exact names; a name the SDK doesn't export is an error: the
 *   module can't link, so the theme can never load;
 * - a namespace import or a dynamic import() gives no list, so every SDK name found anywhere in the
 *   bundle text counts as used, and the check is a warning that names were not checked one by one;
 * - an area the code uses that `uses` doesn't declare, or a `uses` entry that is no SDK area, is a
 *   warning; a declared area the code never touches is reported, not warned.
 *
 * A page area (`pages/agents`) is written in `uses` as `pages-agents` or `pages.agents`. Python's
 * `\w` and `\b` read Unicode letters and digits as word characters, so the patterns here spell them
 * as `[\p{L}\p{N}_]` with the `u` flag.
 */
import { readFileSync } from 'node:fs'
import { byText } from '../collect.ts'
import { LEVEL_ERROR, LEVEL_PASS, LEVEL_WARNING, type CheckEntry, type CheckText, type Files, type Manifest } from './report.ts'

/** The vendored copy of core's services/themes/data/sdk-surface.json. */
export const SDK_SURFACE_FILE = new URL('../core/data/sdk-surface.json', import.meta.url)
const BUNDLE_PREFIXES: readonly string[] = ['dist/entry.js', 'dist/chunks/']
const BUNDLE_SUFFIX = '.js'

const WORD = String.raw`[\p{L}\p{N}_]`
const IDENT_PART = String.raw`[\p{L}\p{N}_$]`
const IDENT = String.raw`[A-Za-z_$]${IDENT_PART}*`
const KEYWORD = `(?<!${WORD})`
const SDK = String.raw`(?<quote>["'])@automatos/theme-sdk\k<quote>`
const NAMED_IMPORT = new RegExp(String.raw`${KEYWORD}(?:import|export)\s*(?:${IDENT}\s*,\s*)?\{([^{}]*)\}\s*from\s*${SDK}`, 'gu')
const NAMESPACE_IMPORT = new RegExp(String.raw`${KEYWORD}import\s*(?:${IDENT}\s*,\s*)?\*\s*as\s*${IDENT}\s*from\s*${SDK}`, 'u')
const DYNAMIC_IMPORT = new RegExp(String.raw`${KEYWORD}import\s*\(\s*${SDK}\s*\)`, 'u')
const STAR_EXPORT = new RegExp(String.raw`${KEYWORD}export\s*\*\s*(?:as\s*${IDENT}\s*)?from\s*${SDK}`, 'u')
const SPECIFIER_NAME = new RegExp(String.raw`^\s*(?:type\s+)?(?:(${IDENT})|(["'])([^"']*)\2)`, 'u')
const REGEXP_SYNTAX = /[\\^$.*+?()[\]{}|/]/g

/** `{area: names}` of an SDK's runtime exports, in the name list's order. */
export type SurfaceAreas = Readonly<Record<string, readonly string[]>>

export const SURFACE_MISSING = (
  'This build has no readable SDK name list (services/themes/data/sdk-surface.json), '
  + 'so the SDK names the theme imports were not checked.'
)
export const UNKNOWN_NAMES = "The theme imports names this host's SDK doesn't export, so its code can't load: {names}."
export const UNDECLARED = 'The code uses SDK areas theme.json\'s "uses" doesn\'t declare: {areas}.'
export const NOT_AREAS = '"uses" names entries that are not SDK areas: {entries}.'
export const WIDE_IMPORT = (
  'The code imports the SDK as a whole (a namespace or a dynamic import), so the names it uses '
  + 'were found by searching the bundle text, not checked one by one.'
)

export interface UsesEntry extends CheckEntry {
  readonly status: 'checked' | 'not_checked'
  readonly reason?: string
  readonly problems?: readonly string[]
  readonly usedAreas?: readonly string[]
  readonly declaredUnused?: readonly string[]
}

interface SdkImports {
  readonly named: ReadonlySet<string>
  readonly wide: boolean
}

/** sdk_uses.py `sdk_surface`: the SDK's names by area from `file`, or null when it can't be read. */
export function sdkSurface(file: URL = SDK_SURFACE_FILE): SurfaceAreas | null {
  try {
    const areas = (JSON.parse(readFileSync(file, 'utf8')) as { readonly areas?: unknown }).areas
    if (typeof areas !== 'object' || areas === null || Array.isArray(areas)) return null
    const entries = Object.entries(areas as Record<string, unknown>)
    if (!entries.every(([, names]) => Array.isArray(names))) return null
    return Object.fromEntries(entries.map(([area, names]) => [area, (names as unknown[]).map(String)]))
  } catch {
    return null
  }
}

/** How `uses` writes `area`: `pages/agents` as `pages-agents`. */
export function usesName(area: string): string {
  return area.replaceAll('/', '-')
}

/** Every accepted `uses` spelling → its area. */
function aliasesOf(surface: SurfaceAreas): Map<string, string> {
  return new Map(Object.keys(surface).flatMap((area) => (
    [area, usesName(area), area.replaceAll('/', '.')].map((spelling): [string, string] => [spelling, area])
  )))
}

/** The exported names of `a, b as c, "d" as e` (the name before `as`). */
function specifierNames(block: string): Set<string> {
  const names = new Set<string>()
  block.split(',').forEach((part) => {
    const match = SPECIFIER_NAME.exec(part)
    if (match !== null && part.trim()) names.add(match[1] ?? match[3])
  })
  return names
}

/** The browser's code, each file's path and text, in path order (sdk_uses.py `bundle_texts`). */
export function bundleFiles(files: Files): Array<readonly [string, string]> {
  const decoder = new TextDecoder('utf-8', { ignoreBOM: true })
  return Array.from(files.keys())
    .filter((path) => BUNDLE_PREFIXES.some((prefix) => path.startsWith(prefix)) && path.endsWith(BUNDLE_SUFFIX))
    .sort(byText)
    .map((path) => [path, decoder.decode(files.get(path))] as const)
}

/** The browser's code, in path order. */
export function bundleTexts(files: Files): string[] {
  return bundleFiles(files).map(([, text]) => text)
}

/** The names imported from the SDK across `texts`, and whether any imports it whole. */
export function findSdkImports(texts: readonly string[]): SdkImports {
  const named = new Set<string>()
  let wide = false
  texts.forEach((text) => {
    for (const match of text.matchAll(NAMED_IMPORT)) specifierNames(match[1]).forEach((name) => named.add(name))
    wide = wide || [NAMESPACE_IMPORT, DYNAMIC_IMPORT, STAR_EXPORT].some((pattern) => pattern.test(text))
  })
  return { named, wide }
}

/** Which of `names` appear as whole identifiers anywhere in `texts`. */
function namesInText(texts: readonly string[], names: Iterable<string>): Set<string> {
  const wanted = Array.from(new Set(names)).sort((a, b) => b.length - a.length)
  if (wanted.length === 0) return new Set()
  const alternatives = wanted.map((name) => name.replace(REGEXP_SYNTAX, String.raw`\$&`)).join('|')
  const pattern = new RegExp(`(?<!${IDENT_PART})(${alternatives})(?!${IDENT_PART})`, 'gu')
  return new Set(texts.flatMap((text) => Array.from(text.matchAll(pattern), (match) => match[1])))
}

function usedNames(texts: readonly string[], imports: SdkImports, owner: ReadonlyMap<string, string>): Set<string> {
  const known = new Set(Array.from(imports.named).filter((name) => owner.has(name)))
  return imports.wide ? new Set([...known, ...namesInText(texts, owner.keys())]) : known
}

/** The areas `uses` declares, and the entries that name no area. */
function declaredAreas(manifest: Manifest, aliases: ReadonlyMap<string, string>): { declared: Set<string>; notAreas: string[] } {
  const listed = Array.isArray(manifest.uses) ? (manifest.uses as unknown[]) : []
  const entries = listed.filter((entry): entry is string => typeof entry === 'string')
  const declared = new Set(entries.filter((entry) => aliases.has(entry)).map((entry) => aliases.get(entry) as string))
  return { declared, notAreas: entries.filter((entry) => !aliases.has(entry)) }
}

/** `template` with its one `{field}` replaced by `values` (a function, so a `$` in a name is kept as written). */
export function filled(template: string, field: string, values: readonly string[]): string {
  return template.replace(`{${field}}`, () => values.join(', '))
}

function problemsOf(unknown: readonly string[], undeclared: readonly string[], notAreas: readonly string[], wide: boolean): string[] {
  return [
    ...(unknown.length > 0 ? [filled(UNKNOWN_NAMES, 'names', unknown)] : []),
    ...(undeclared.length > 0 ? [filled(UNDECLARED, 'areas', undeclared)] : []),
    ...(notAreas.length > 0 ? [filled(NOT_AREAS, 'entries', notAreas)] : []),
    ...(wide ? [WIDE_IMPORT] : []),
  ]
}

function sortedUsesNames(areas: Iterable<string>): string[] {
  return Array.from(areas, usesName).sort(byText)
}

/** sdk_uses.py `uses_check`: the `uses` entry of the report; `surface` defaults to the vendored SDK names. */
export function usesCheck(manifest: Manifest, files: Files, surface: SurfaceAreas | null = sdkSurface()): UsesEntry {
  if (surface === null) return { level: LEVEL_WARNING, status: 'not_checked', reason: SURFACE_MISSING }
  const owner = new Map(Object.entries(surface).flatMap(([area, names]) => names.map((name): [string, string] => [name, area])))
  const texts = bundleTexts(files)
  const imports = findSdkImports(texts)
  const used = usedNames(texts, imports, owner)
  const usedAreas = new Set(Array.from(used, (name) => owner.get(name) as string))
  const { declared, notAreas } = declaredAreas(manifest, aliasesOf(surface))
  const unknown = Array.from(imports.named).filter((name) => !owner.has(name)).sort(byText)
  const undeclared = sortedUsesNames(Array.from(usedAreas).filter((area) => !declared.has(area)))
  const problems = problemsOf(unknown, undeclared, notAreas, imports.wide)
  const level = unknown.length > 0 ? LEVEL_ERROR : problems.length > 0 ? LEVEL_WARNING : LEVEL_PASS
  return {
    level, status: 'checked', problems, unknownNames: unknown,
    usedAreas: sortedUsesNames(usedAreas), usedNames: Array.from(used).sort(byText),
    undeclaredAreas: undeclared, notAreas,
    declaredUnused: sortedUsesNames(Array.from(declared).filter((area) => !usedAreas.has(area))), wideImport: imports.wide,
  }
}

/** The `uses` line: its problems, or the areas the code uses. */
export function describeUses(entry: UsesEntry): CheckText {
  if (entry.status === 'not_checked') return { text: entry.reason ?? SURFACE_MISSING, items: [] }
  const used = entry.usedAreas ?? []
  const unused = entry.declaredUnused ?? []
  const text = [
    `The code uses ${used.length} SDK area(s)${used.length > 0 ? `: ${used.join(', ')}` : ''}.`,
    ...(unused.length > 0 ? [`Declared and never used: ${unused.join(', ')}.`] : []),
  ].join(' ')
  return { text, items: entry.problems ?? [] }
}
