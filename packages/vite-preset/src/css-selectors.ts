/**
 * The selector and name rules of the server's CSS scope check.
 *
 * A line-for-line port of the selector helpers in core's orchestrator/services/themes/css_scope.py
 * (the server has no TypeScript twin of that check). The corpus cases `cssScope` in
 * packages/theme-cli/test/fixtures/core/cases.json hold this port to the server's verdicts.
 */

const MAX_WRAP_DEPTH = 3
const WRAPPING_PSEUDOS: readonly string[] = [':where(', ':is(']
const NESTING_SELECTOR = '&'
/** A string or an escape: an & inside one doesn't count. */
const OPAQUE_SELECTOR_START: ReadonlySet<string> = new Set(['"', "'", '\\'])
const SELECTOR_BOUNDARY: ReadonlySet<string> = new Set([' ', '\t', '\n', '\r', '\f', '>', '+', '~', '.', ':', '[', '#'])
const BRACKET_STEP: ReadonlyMap<string, number> = new Map([['(', 1], ['[', 1], [')', -1], [']', -1]])
const QUOTES: ReadonlySet<string> = new Set(['"', "'"])

/**
 * The protected surfaces' wrapper attributes (the approval cards and the voice button's control); this prefix covers
 * data-protected-surface-inner too.
 */
export const PROTECTED_SURFACE_NAME = 'data-protected-surface'
/** A backslash before a character stands for that character. */
const ESCAPED_CHAR = /\\([\s\S])/g
/** A selector's pieces: an escape, a string, a bracket or comma, or a run of anything else. */
const SELECTOR_TOKEN = /\\[\s\S]?|"(?:[^"\\]|\\[\s\S])*"?|'(?:[^'\\]|\\[\s\S])*'?|[()\[\],]|[^()\[\],"'\\]+/g

interface Piece {
  readonly text: string
  readonly at: number
}

/** Every selector piece of `text` from `start` on (Python's SELECTOR_TOKEN.finditer(text, start)). */
function selectorPieces(text: string, start = 0): Piece[] {
  const token = new RegExp(SELECTOR_TOKEN.source, 'g')
  token.lastIndex = start
  const pieces: Piece[] = []
  for (let match = token.exec(text); match !== null; match = token.exec(text)) {
    pieces.push({ text: match[0], at: match.index })
  }
  return pieces
}

/** `text` split at commas outside brackets and strings. */
export function splitTopLevel(text: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (const piece of selectorPieces(text)) {
    depth += BRACKET_STEP.get(piece.text) ?? 0
    if (piece.text === ',' && depth === 0) {
      parts.push(text.slice(start, piece.at))
      start = piece.at + 1
    }
  }
  return [...parts, text.slice(start)]
}

/** Where the bracket opened just before `start` closes, or null. */
function closingBracket(text: string, start: number): number | null {
  let depth = 1
  for (const piece of selectorPieces(text, start)) {
    depth += BRACKET_STEP.get(piece.text) ?? 0
    if (depth === 0) return piece.at
  }
  return null
}

/** True when the selector can only match inside `html.<htmlClass>`. */
export function isScopedSelector(selector: string, htmlClass: string, level = 0): boolean {
  const text = selector.trim()
  const wrap = `html.${htmlClass}`
  if (text.startsWith(wrap)) {
    const rest = text.slice(wrap.length)
    return rest === '' || SELECTOR_BOUNDARY.has(rest[0])
  }
  const lower = text.toLowerCase()
  const pseudo = WRAPPING_PSEUDOS.find((name) => lower.startsWith(name))
  if (pseudo === undefined || level >= MAX_WRAP_DEPTH) return false
  const close = closingBracket(text, pseudo.length)
  if (close === null) return false
  return splitTopLevel(text.slice(pseudo.length, close)).every((part) => isScopedSelector(part, htmlClass, level + 1))
}

/** True when every selector of the list is scoped. */
export function isScopedSelectorList(prelude: string, htmlClass: string): boolean {
  return splitTopLevel(prelude).every((part) => isScopedSelector(part, htmlClass))
}

/** True when `&` appears in the selector outside a string or an escape. */
function namesNestingSelector(selector: string): boolean {
  return selectorPieces(selector).some(
    (piece) => !OPAQUE_SELECTOR_START.has(piece.text[0]) && piece.text.includes(NESTING_SELECTOR),
  )
}

/** True when a selector nested in a scoped rule can only match inside that rule's reach. */
function isAnchoredNestedSelector(selector: string): boolean {
  const text = selector.trim()
  return text.startsWith(NESTING_SELECTOR) || !namesNestingSelector(text)
}

/** True when every selector of a nested rule's list is anchored. */
export function isAnchoredNestedSelectorList(prelude: string): boolean {
  return splitTopLevel(prelude).every((part) => isAnchoredNestedSelector(part))
}

/** True when the selector names a protected surface's attribute anywhere, in any case or escape. */
export function namesProtectedSurface(selector: string): boolean {
  return selector.replace(ESCAPED_CHAR, '$1').toLowerCase().includes(PROTECTED_SURFACE_NAME)
}

/** `text` without one pair of matching quotes around it (a CSS string), else as given. */
export function unquoted(text: string): string {
  if (text.length >= 2 && QUOTES.has(text[0]) && text[text.length - 1] === text[0]) return text.slice(1, -1)
  return text
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|\[\]\\]/g, '\\$&')
}

/** True for a global name (an animation, a font family) the theme owns: `<htmlClass>-` then more. */
export function isThemeName(text: string, htmlClass: string): boolean {
  const pattern = new RegExp(`^${escapeRegExp(htmlClass)}-[A-Za-z0-9_-]+$`)
  return pattern.test(unquoted(text.trim()))
}
