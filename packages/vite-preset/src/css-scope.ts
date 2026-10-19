/**
 * The server's CSS scope check, run in the kit so a theme that core would refuse never builds.
 *
 * A line-for-line port of core's orchestrator/services/themes/css_scope.py (PRD-261 §4.3 item 8).
 * Every rule sits under `html.<htmlClass>` (or `:where()`/`:is()` of it); nested rules may name `&`
 * only at a selector's start; every `@keyframes` name and `@font-face` family starts with
 * `<htmlClass>-`; no selector names `data-protected-surface`; no `!` outside strings and comments
 * (so no `!important`); no `@import` or other at-rule beyond @media, @supports, @layer, @container,
 * @font-face and @keyframes; and anything the tokenizer could read differently from a browser is a
 * refusal. The corpus cases `cssScope` (packages/theme-cli/test/fixtures/core/cases.json) hold this
 * port to the server's verdicts.
 */
import {
  isAnchoredNestedSelectorList, isScopedSelectorList, isThemeName, namesProtectedSurface, PROTECTED_SURFACE_NAME,
} from './css-selectors.ts'
import { echo, themeError, type ThemeError } from './echo.ts'

export type { ThemeError } from './echo.ts'

export const STYLE_PATH = 'dist/theme.css'
export const CSS_ERROR_CODES: readonly string[] = ['CSS_UNSCOPED', 'CSS_IMPORTANT', 'CSS_IMPORT', 'CSS_AT_RULE', 'CSS_SYNTAX']
const MAX_ERRORS = 20
/** Brackets and blocks nest at most this deep; deeper is refused, so the scan stays linear. */
const MAX_NESTING = 64

const GROUP_AT_RULES: ReadonlySet<string> = new Set(['media', 'supports', 'layer', 'container'])
const FONT_FACE = 'font-face'
const KEYFRAMES_AT_RULES: ReadonlySet<string> = new Set(['keyframes', '-webkit-keyframes'])
const CONTAINED_AT_RULES: ReadonlySet<string> = new Set([FONT_FACE, ...KEYFRAMES_AT_RULES])
const STATEMENT_AT_RULES: ReadonlySet<string> = new Set(['charset', 'layer'])
const FONT_FAMILY = 'font-family'
const URL_NAME = 'url'
const OPENERS: ReadonlySet<string> = new Set(['(', '['])
const OPENING_BRACKET: ReadonlyMap<string, string> = new Map([[')', '('], [']', '[']])

/** A backslash may escape punctuation only: an escaped letter or digit can spell a keyword. */
const REFUSED_ESCAPE = /[A-Za-z0-9\n\r\f]/
const IDENT_CHAR = /[A-Za-z0-9_\-\u{80}-\u{10FFFF}\\]/u
const AT_NAME = /^@(-?[A-Za-z][A-Za-z0-9-]*)/
const QUOTED_URL = /\([ \t\n\r\f]*["']/y
/** Written so no two runs can match the same characters: linear, never backtracking. */
const PLAIN_URL = /\([ \t\n\r\f]*(?:[^ \t\n\r\f"'()\\\x00-\x08\x0b\x0e-\x1f\x7f]+[ \t\n\r\f]*)?\)/y
const TOKEN = new RegExp([
  String.raw`(?<comment>\/\*[\s\S]*?\*\/)`,
  String.raw`(?<bad_comment>\/\*)`,
  String.raw`(?<string>"(?:[^"\\\n\r\f]|\\[\s\S])*"|'(?:[^'\\\n\r\f]|\\[\s\S])*')`,
  String.raw`(?<bad_string>["'])`,
  String.raw`(?<escape>\\[\s\S]?)`,
  String.raw`(?<ident>-{0,2}[A-Za-z_\u{80}-\u{10FFFF}][A-Za-z0-9_\-\u{80}-\u{10FFFF}]*)`,
  String.raw`(?<punct>[{};()\[\]!])`,
  String.raw`(?<other>[^{};()\[\]!"'\/\\A-Za-z_\-\u{80}-\u{10FFFF}]+|[\/\-])`,
].join('|'), 'uy')
const TOKEN_KINDS: readonly string[] = ['comment', 'bad_comment', 'string', 'bad_string', 'escape', 'ident', 'punct', 'other']

interface Frame {
  /** "top", "group", "style", "contained" or "font-face". */
  readonly kind: string
  /** Whether rules inside it are already contained. */
  readonly scoped: boolean
}

interface Token {
  readonly kind: string
  readonly text: string
  readonly at: number
  readonly end: number
}

function atName(prelude: string): string {
  const match = AT_NAME.exec(prelude)
  return match === null ? '' : match[1].toLowerCase()
}

/** The value of a `font-family` declaration, or null for any other declaration. */
function fontFamilyValue(declaration: string): string | null {
  const colon = declaration.indexOf(':')
  if (colon < 0 || declaration.slice(0, colon).trim().toLowerCase() !== FONT_FAMILY) return null
  return declaration.slice(colon + 1)
}

/** `pattern` (a sticky regex) matched at `at` exactly. The scan is synchronous, so one instance serves. */
function sticky(pattern: RegExp, text: string, at: number): RegExpExecArray | null {
  pattern.lastIndex = at
  return pattern.exec(text)
}

function readToken(css: string, at: number): Token | null {
  const match = sticky(TOKEN, css, at)
  if (match === null || match.groups === undefined) return null
  const groups = match.groups
  const kind = TOKEN_KINDS.find((name) => groups[name] !== undefined) ?? 'other'
  return { kind, text: match[0], at, end: at + match[0].length }
}

/** One pass over the stylesheet's tokens, keeping the open blocks on a stack. */
class Scanner {
  private readonly stack: Frame[] = [{ kind: 'top', scoped: false }]
  private prelude: string[] = []
  private brackets: string[] = []
  private readonly errors: ThemeError[] = []
  private afterEscape = false
  private readonly css: string
  private readonly htmlClass: string

  constructor(css: string, htmlClass: string) {
    this.css = css
    this.htmlClass = htmlClass
  }

  run(): ThemeError[] {
    let at = 0
    while (at < this.css.length && this.errors.length < MAX_ERRORS) {
      const token = readToken(this.css, at)
      if (token === null) {
        this.error('CSS_SYNTAX', at, "this character can't be read.")
        break
      }
      at = this.take(token)
    }
    if (this.errors.length < MAX_ERRORS) this.finish()
    return this.errors.slice(0, MAX_ERRORS)
  }

  private error(code: string, at: number, message: string): void {
    const line = this.css.slice(0, at).split('\n').length
    this.errors.push(themeError(code, `${STYLE_PATH}:${line}`, `${STYLE_PATH} line ${line}: ${message}`))
  }

  private takePrelude(): string {
    const text = this.prelude.join('').trim()
    this.prelude = []
    return text
  }

  /** Handle one token; return where the next one starts. */
  private take(token: Token): number {
    const afterEscape = this.afterEscape
    this.afterEscape = token.kind === 'escape'
    if (token.kind === 'bad_comment' || token.kind === 'bad_string') {
      const what = token.kind === 'bad_comment' ? 'comment' : 'quoted string'
      this.error('CSS_SYNTAX', token.at, `a ${what} is never closed.`)
      return this.css.length
    }
    if (token.kind === 'escape' && (token.text.length < 2 || REFUSED_ESCAPE.test(token.text[1]))) {
      this.error('CSS_SYNTAX', token.at, 'a backslash may escape punctuation only, never a letter or a digit.')
    }
    if (token.kind === 'ident' && token.text.toLowerCase() === URL_NAME && !afterEscape) return this.takeUrl(token)
    if (token.kind === 'punct') {
      this.takePunct(token.text, token.at)
      return token.end
    }
    this.prelude.push(token.kind === 'comment' ? ' ' : token.text)
    return token.end
  }

  /** `url(` unquoted is one opaque token up to its `)`, as a browser reads it. */
  private takeUrl(token: Token): number {
    const glued = token.at > 0 && IDENT_CHAR.test(this.css[token.at - 1])
    if (glued || !this.css.startsWith('(', token.end) || sticky(QUOTED_URL, this.css, token.end) !== null) {
      this.prelude.push(token.text)
      return token.end
    }
    const plain = sticky(PLAIN_URL, this.css, token.end)
    if (plain === null) {
      this.error('CSS_SYNTAX', token.at, 'an unquoted url() may hold no spaces, quotes, brackets or backslashes.')
      return this.css.length
    }
    const end = token.end + plain[0].length
    this.prelude.push(this.css.slice(token.at, end))
    return end
  }

  private takePunct(char: string, at: number): void {
    if (char === '!') {
      this.error('CSS_IMPORTANT', at, "!important (or any other !) is not allowed in a theme's CSS.")
    } else if (OPENERS.has(char) || OPENING_BRACKET.has(char)) {
      this.takeBracket(char, at)
    } else {
      this.takeBlockPunct(char, at)
    }
  }

  /** Brackets nest by kind, as a browser reads them: '( ]' is not a closed pair. */
  private takeBracket(char: string, at: number): void {
    this.prelude.push(char)
    const opener = OPENING_BRACKET.get(char)
    if (opener === undefined) {
      if (this.brackets.length >= MAX_NESTING) {
        this.error('CSS_SYNTAX', at, `brackets nest deeper than ${MAX_NESTING}.`)
        return
      }
      this.brackets.push(char)
      return
    }
    if (this.brackets.length === 0 || this.brackets[this.brackets.length - 1] !== opener) {
      this.error('CSS_SYNTAX', at, `a ${char} closes nothing.`)
      this.brackets = []
      return
    }
    this.brackets.pop()
  }

  private takeBlockPunct(char: string, at: number): void {
    if (this.brackets.length > 0) {
      this.error('CSS_SYNTAX', at, `a ${char} sits inside an unclosed bracket.`)
      this.brackets = []
    }
    if (char === '{') this.openBlock(at)
    else if (char === '}') this.closeBlock(at)
    else this.endStatement(at)
  }

  private openBlock(at: number): void {
    const prelude = this.takePrelude()
    const parent = this.stack[this.stack.length - 1]
    if (this.stack.length > MAX_NESTING) {
      this.error('CSS_SYNTAX', at, `blocks nest deeper than ${MAX_NESTING}.`)
      return
    }
    const frame = prelude.startsWith('@') ? this.atRuleFrame(prelude, parent, at) : this.ruleFrame(prelude, parent, at)
    this.stack.push(frame)
  }

  private atRuleFrame(prelude: string, parent: Frame, at: number): Frame {
    const name = atName(prelude)
    if (GROUP_AT_RULES.has(name)) return { kind: 'group', scoped: parent.scoped }
    if (KEYFRAMES_AT_RULES.has(name)) this.checkKeyframesName(prelude.slice(name.length + 1), at)
    else if (!CONTAINED_AT_RULES.has(name)) this.refuseAtRule(name, prelude, at)
    return { kind: name === FONT_FACE ? FONT_FACE : 'contained', scoped: true }
  }

  private checkKeyframesName(keyframesName: string, at: number): void {
    if (isThemeName(keyframesName, this.htmlClass)) return
    this.error('CSS_UNSCOPED', at, (
      `the animation "${echo(keyframesName.trim())}" must be named ${this.htmlClass}-something: `
      + "animation names are shared with the whole app, so this one could replace the app's own."
    ))
  }

  private checkFontFamily(declaration: string, at: number): void {
    const family = fontFamilyValue(declaration)
    if (family === null || isThemeName(family, this.htmlClass)) return
    this.error('CSS_UNSCOPED', at, (
      `the font "${echo(family.trim())}" must be named ${this.htmlClass}-something: `
      + "font names are shared with the whole app, so this one could replace the app's own."
    ))
  }

  private ruleFrame(prelude: string, parent: Frame, at: number): Frame {
    const contained = parent.kind === 'contained' || parent.scoped
    if (namesProtectedSurface(prelude)) {
      this.error('CSS_UNSCOPED', at, (
        `the rule "${echo(prelude)}" names ${PROTECTED_SURFACE_NAME}: `
        + 'a theme may not style the approval cards, which must always show as the app draws them.'
      ))
    } else if (contained && !isAnchoredNestedSelectorList(prelude)) {
      this.error('CSS_UNSCOPED', at, (
        `the nested rule "${echo(prelude)}" names & other than at the start of a selector, `
        + `so it can reach outside html.${this.htmlClass}.`
      ))
    } else if (!contained && !isScopedSelectorList(prelude, this.htmlClass)) {
      this.error('CSS_UNSCOPED', at, (
        `the rule "${echo(prelude)}" is not under html.${this.htmlClass} (or :where(html.${this.htmlClass})).`
      ))
    }
    return { kind: 'style', scoped: true }
  }

  private refuseAtRule(name: string, prelude: string, at: number): void {
    if (name === 'import') {
      this.error('CSS_IMPORT', at, '@import is not allowed: a theme ships one stylesheet.')
      return
    }
    this.error('CSS_AT_RULE', at, `"${echo(prelude)}" is an at-rule a theme's CSS may not use.`)
  }

  private closeBlock(at: number): void {
    const leftover = this.takePrelude()
    const frame = this.stack[this.stack.length - 1]
    if (frame.kind === 'top') {
      this.error('CSS_SYNTAX', at, 'a } closes nothing.')
      return
    }
    if (leftover && frame.kind === 'group') this.error('CSS_SYNTAX', at, `"${echo(leftover)}" has no block.`)
    if (leftover && frame.kind === FONT_FACE) this.checkFontFamily(leftover, at)
    this.stack.pop()
  }

  private endStatement(at: number): void {
    const prelude = this.takePrelude()
    const kind = this.stack[this.stack.length - 1].kind
    if (prelude.startsWith('@')) {
      const name = atName(prelude)
      if (!STATEMENT_AT_RULES.has(name)) this.refuseAtRule(name, prelude, at)
      return
    }
    if (prelude && (kind === 'top' || kind === 'group')) {
      this.error('CSS_SYNTAX', at, `"${echo(prelude)}" is not inside a rule.`)
    } else if (kind === FONT_FACE) {
      this.checkFontFamily(prelude, at)
    }
  }

  private finish(): void {
    const end = this.css.length
    if (this.stack.length > 1) this.error('CSS_SYNTAX', end, 'a { is never closed.')
    const leftover = this.takePrelude()
    if (leftover && this.stack.length === 1) this.error('CSS_SYNTAX', end, `"${echo(leftover)}" has no block.`)
    if (this.brackets.length > 0) this.error('CSS_SYNTAX', end, 'a bracket is never closed.')
  }
}

/** Every scope, `!important`, at-rule and syntax refusal in `css`, at most MAX_ERRORS. */
export function cssScopeErrors(css: string, htmlClass: string): ThemeError[] {
  return new Scanner(css, htmlClass).run()
}
