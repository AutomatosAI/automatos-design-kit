/**
 * Renames a stylesheet's global names into the theme's own: every `@keyframes` name and every
 * `@font-face` family that does not start with `<htmlClass>-` gets that prefix, and the
 * declarations in the same stylesheet that use the old name are rewritten to the new one.
 *
 * The server refuses a keyframes name or font family without the prefix (css_scope.py), since
 * both are shared with the whole app: `@keyframes spin` would replace the host's own. CSS modules
 * already name their keyframes `<htmlClass>-[local]-[hash]` (the preset's generateScopedName), so
 * this pass changes only global CSS. It runs once on the whole built stylesheet, so a keyframes
 * rule in one source file and the `animation` that uses it in another are renamed together.
 *
 * PostCSS works by changing its tree in place; these helpers change only the tree they are given.
 */
import { list, type AtRule, type Declaration, type Root } from 'postcss'
import { isThemeName, unquoted } from './css-selectors.ts'

const KEYFRAMES = /^(?:-webkit-)?keyframes$/i
const FONT_FACE = /^font-face$/i
const FONT_FAMILY = /^font-family$/i
const FONT_SHORTHAND = /^font$/i
const ANIMATION = /^(?:-webkit-)?animation(?:-name)?$/i
const CUSTOM_PROPERTY_PREFIX = '--'
const NOT_NAME_CHARS = /[^A-Za-z0-9_-]+/g
const EDGE_DASHES = /^-+|-+$/g
const FALLBACK_NAME = 'name'
const QUOTED_TAIL = /(["'])((?:\\[\s\S]|(?!\1)[^\\])*)\1\s*$/

/** `<htmlClass>-<name>`, with anything a CSS name can't hold unquoted turned into dashes. */
export function themeName(name: string, htmlClass: string): string {
  const safe = name.replace(NOT_NAME_CHARS, '-').replace(EDGE_DASHES, '') || FALLBACK_NAME
  return `${htmlClass}-${safe}`
}

/** A font family as fonts match it: no quotes, spaces collapsed, any case. */
function familyKey(family: string): string {
  return unquoted(family.trim()).trim().replace(/\s+/g, ' ').toLowerCase()
}

function renameKeyframes(root: Root, htmlClass: string): ReadonlyMap<string, string> {
  const names = new Map<string, string>()
  root.walkAtRules(KEYFRAMES, (atRule: AtRule) => {
    const name = unquoted(atRule.params.trim())
    if (isThemeName(name, htmlClass)) return
    const renamed = themeName(name, htmlClass)
    names.set(name, renamed)
    atRule.params = renamed
  })
  return names
}

function renameFontFaces(root: Root, htmlClass: string): ReadonlyMap<string, string> {
  const families = new Map<string, string>()
  root.walkAtRules(FONT_FACE, (atRule: AtRule) => {
    atRule.walkDecls(FONT_FAMILY, (decl: Declaration) => {
      if (isThemeName(decl.value, htmlClass)) return
      const renamed = themeName(unquoted(decl.value.trim()), htmlClass)
      families.set(familyKey(decl.value), renamed)
      decl.value = renamed
    })
  })
  return families
}

/** Each item replaced by `rename` (or kept); null when none was, so untouched values keep their spacing. */
function renamedItems(
  items: readonly string[],
  rename: (item: string, index: number) => string | undefined,
): string[] | null {
  const renamed = items.map((item, index) => rename(item, index) ?? item)
  return renamed.some((item, index) => item !== items[index]) ? renamed : null
}

/** An `animation` or `animation-name` value with each renamed keyframes name replaced, or null. */
function renamedAnimation(value: string, names: ReadonlyMap<string, string>): string | null {
  const renamePart = (part: string): string | undefined => (
    renamedItems(list.space(part), (token) => names.get(unquoted(token)))?.join(' ')
  )
  return renamedItems(list.comma(value), renamePart)?.join(', ') ?? null
}

/** A family list with each renamed family replaced, or null. */
function renamedFamilies(value: string, families: ReadonlyMap<string, string>): string | null {
  return renamedItems(list.comma(value), (item) => families.get(familyKey(item)))?.join(', ') ?? null
}

/** The first part of a `font` shorthand (size and style, then a family at its end) renamed, or undefined. */
function renamedShorthandHead(part: string, families: ReadonlyMap<string, string>): string | undefined {
  const quoted = QUOTED_TAIL.exec(part)
  if (quoted !== null) {
    const renamed = families.get(familyKey(quoted[2]))
    return renamed === undefined ? undefined : `${part.slice(0, quoted.index)}${renamed}`
  }
  const words = part.trim().split(/\s+/)
  for (let start = 1; start < words.length; start += 1) {
    const renamed = families.get(familyKey(words.slice(start).join(' ')))
    if (renamed !== undefined) return [...words.slice(0, start), renamed].join(' ')
  }
  return undefined
}

/** A `font` shorthand with its families renamed, or null. */
function renamedShorthand(value: string, families: ReadonlyMap<string, string>): string | null {
  const rename = (item: string, index: number): string | undefined => (
    index === 0 ? renamedShorthandHead(item, families) : families.get(familyKey(item))
  )
  return renamedItems(list.comma(value), rename)?.join(', ') ?? null
}

function setIfRenamed(decl: Declaration, value: string | null): void {
  if (value !== null) decl.value = value
}

function rewriteFamilyUses(root: Root, families: ReadonlyMap<string, string>): void {
  root.walkDecls((decl: Declaration) => {
    const parent = decl.parent
    if (parent !== undefined && parent.type === 'atrule' && FONT_FACE.test((parent as AtRule).name)) return
    if (FONT_FAMILY.test(decl.prop) || decl.prop.startsWith(CUSTOM_PROPERTY_PREFIX)) {
      setIfRenamed(decl, renamedFamilies(decl.value, families))
    } else if (FONT_SHORTHAND.test(decl.prop)) {
      setIfRenamed(decl, renamedShorthand(decl.value, families))
    }
  })
}

/** Renames the stylesheet's keyframes and font families to `<htmlClass>-…` and every use of them. */
export function renameGlobalNames(root: Root, htmlClass: string): void {
  const names = renameKeyframes(root, htmlClass)
  const families = renameFontFaces(root, htmlClass)
  if (names.size > 0) {
    root.walkDecls(ANIMATION, (decl: Declaration) => setIfRenamed(decl, renamedAnimation(decl.value, names)))
  }
  if (families.size > 0) rewriteFamilyUses(root, families)
}
