// Reading Play's stylesheets for the static CSS tests: the style rules' selectors and each selector's
// specificity. Play's CSS has no nesting and no braces inside strings, so a scan of the blocks is enough.

export type Specificity = readonly [number, number, number]

export interface StyleRule {
  /** The rule's selectors, as written. */
  readonly selectors: readonly string[]
  /** The at-rules around it, outermost first (e.g. ['@media (forced-colors: active)']). */
  readonly within: readonly string[]
  /** The properties its declarations set, lower-cased, in order. */
  readonly properties: readonly string[]
}

interface Frame {
  readonly prelude: string
  /** True inside a style rule, @keyframes or @font-face: no style rule starts in here. */
  readonly opaque: boolean
  readonly styleRule: boolean
  /** Where the block's text starts. */
  readonly body: number
}

/** At-rules whose blocks hold declarations or keyframe steps, never style rules. */
const OPAQUE_AT_RULE = /^@(?:-webkit-)?(?:keyframes|font-face)\b/i
const COMMENT = /\/\*[\s\S]*?\*\//g
const IDENT = /^-?[A-Za-z_][\w-]*/
const LEGACY_PSEUDO_ELEMENTS: ReadonlySet<string> = new Set(['before', 'after', 'first-line', 'first-letter'])
/** Pseudo-classes whose own weight is that of their most specific argument. */
const SELECTOR_ARGUMENT_PSEUDOS: ReadonlySet<string> = new Set(['is', 'not', 'has'])

export function stripComments(css: string): string {
  return css.replace(COMMENT, ' ')
}

/** A CSS module's selector as the build sees it once postcss-modules has run: `:global(x)` is `x`. */
export function withoutGlobal(selector: string): string {
  return selector.replace(/:global\(([^()]*)\)/g, '$1')
}

/** `text` split at commas outside brackets and quotes. */
export function splitTopLevel(text: string): string[] {
  const parts: string[] = []
  let depth = 0
  let quote = ''
  let start = 0
  for (let at = 0; at < text.length; at += 1) {
    const char = text[at]
    if (quote !== '') {
      if (char === quote) quote = ''
    } else if (char === '"' || char === "'") {
      quote = char
    } else if (char === '(' || char === '[') {
      depth += 1
    } else if (char === ')' || char === ']') {
      depth -= 1
    } else if (char === ',' && depth === 0) {
      parts.push(text.slice(start, at).trim())
      start = at + 1
    }
  }
  return [...parts, text.slice(start).trim()]
}

/** The property names of a block's declarations. */
function propertiesOf(body: string): string[] {
  return body.split(';').filter((declaration) => declaration.includes(':'))
    .map((declaration) => declaration.slice(0, declaration.indexOf(':')).trim().toLowerCase())
}

/** Every style rule of a stylesheet (comments removed), with the at-rules around it, in source order. */
export function styleRules(css: string): StyleRule[] {
  const text = stripComments(css)
  const rules: StyleRule[] = []
  const stack: Frame[] = []
  let start = 0
  for (let at = 0; at < text.length; at += 1) {
    const char = text[at]
    if (char === ';') start = at + 1
    if (char === '}') {
      const frame = stack.pop()
      if (frame?.styleRule === true) {
        const within = stack.map((outer) => outer.prelude)
        rules.push({ selectors: splitTopLevel(frame.prelude), within, properties: propertiesOf(text.slice(frame.body, at)) })
      }
      start = at + 1
    }
    if (char !== '{') continue
    const prelude = text.slice(start, at).trim()
    const atRule = prelude.startsWith('@')
    const inside = stack.some((frame) => frame.opaque)
    const opaque = inside || !atRule || OPAQUE_AT_RULE.test(prelude)
    stack.push({ prelude, opaque, styleRule: !inside && !atRule, body: at + 1 })
    start = at + 1
  }
  return rules
}

export function addSpecificity(a: Specificity, b: Specificity): Specificity {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

/** Negative when `a` ranks below `b`, zero on a tie, positive above. */
export function compareSpecificity(a: Specificity, b: Specificity): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2]
}

function highest(list: readonly Specificity[]): Specificity {
  return list.reduce((top, item) => (compareSpecificity(item, top) > 0 ? item : top), [0, 0, 0] as Specificity)
}

/** Where the bracket that opens at `open` closes (quotes respected). */
function closing(text: string, open: number): number {
  const close = text[open] === '(' ? ')' : ']'
  let depth = 0
  let quote = ''
  for (let at = open; at < text.length; at += 1) {
    const char = text[at]
    if (quote !== '') {
      if (char === quote) quote = ''
    } else if (char === '"' || char === "'") {
      quote = char
    } else if (char === text[open]) {
      depth += 1
    } else if (char === close && --depth === 0) {
      return at
    }
  }
  throw new Error(`unclosed ${text[open]} in "${text}"`)
}

/** One pseudo-class or pseudo-element at `at` (a ':'): its weight and where it ends. */
function pseudoAt(selector: string, at: number): { readonly weight: Specificity; readonly end: number } {
  const element = selector[at + 1] === ':'
  const nameStart = at + (element ? 2 : 1)
  const name = (IDENT.exec(selector.slice(nameStart))?.[0] ?? '').toLowerCase()
  let end = nameStart + name.length
  let args = ''
  if (selector[end] === '(') {
    const close = closing(selector, end)
    args = selector.slice(end + 1, close)
    end = close + 1
  }
  if (element || LEGACY_PSEUDO_ELEMENTS.has(name)) return { weight: [0, 0, 1], end }
  if (name === 'where') return { weight: [0, 0, 0], end }
  if (SELECTOR_ARGUMENT_PSEUDOS.has(name)) return { weight: highest(splitTopLevel(args).map(specificity)), end }
  return { weight: [0, 1, 0], end }
}

/** One compound piece at `at`: its weight and where it ends (combinators and '*' weigh nothing). */
function pieceAt(selector: string, at: number): { readonly weight: Specificity; readonly end: number } {
  const char = selector[at]
  const identAfter = (from: number): number => from + (IDENT.exec(selector.slice(from))?.[0].length ?? 0)
  if (char === '#') return { weight: [1, 0, 0], end: identAfter(at + 1) }
  if (char === '.') return { weight: [0, 1, 0], end: identAfter(at + 1) }
  if (char === '[') return { weight: [0, 1, 0], end: closing(selector, at) + 1 }
  if (char === ':') return pseudoAt(selector, at)
  if (IDENT.test(selector.slice(at))) return { weight: [0, 0, 1], end: identAfter(at) }
  return { weight: [0, 0, 0], end: at + 1 }
}

/** A selector's specificity (Selectors Level 4), for the plain selectors Play's CSS uses. */
export function specificity(selector: string): Specificity {
  let total: Specificity = [0, 0, 0]
  let at = 0
  while (at < selector.length) {
    const piece = pieceAt(selector, at)
    total = addSpecificity(total, piece.weight)
    at = piece.end
  }
  return total
}
