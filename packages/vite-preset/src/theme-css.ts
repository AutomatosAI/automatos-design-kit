/**
 * The PostCSS step that puts a theme's whole stylesheet under its own class on <html>.
 *
 * Every top-level rule (and every rule inside @media, @supports, @layer or @container) gets the
 * wrap in front of each selector: `html.<htmlClass>` by default (specificity 0,1,1), or
 * `:where(html.<htmlClass>)` (specificity 0) when `wrap: 'where'`. A selector that is
 * already under the wrap is left as it is; a leading `:root` or `html` becomes the wrap itself,
 * so `:root { --x: 1 }` styles `html.<htmlClass>`. Rules nested in a rule and keyframe steps are
 * not wrapped (their parent already is). Keyframes names and font families are renamed to
 * `<htmlClass>-…` first (theme-names.ts).
 *
 * The step does not decide what passes: css-scope.ts checks the result exactly as the server will,
 * so a selector the wrap can't fix (one naming data-protected-surface or data-ai-label, say) still fails the build.
 */
import postcss, { type AtRule, type Container, type Document, type Plugin, type Root, type Rule } from 'postcss'
import { isScopedSelector } from './css-selectors.ts'
import { renameGlobalNames } from './theme-names.ts'

export type WrapForm = 'html' | 'where'

export interface ThemeCssOptions {
  readonly htmlClass: string
  /** 'html' (default): html.<htmlClass>. 'where': :where(html.<htmlClass>). */
  readonly wrap?: WrapForm
}

/** A theme's own class on <html> (core's HTML_CLASS_PATTERN). */
export const HTML_CLASS_PATTERN = /^[a-z][a-z0-9-]{2,31}$/
export const WRAP_FORMS: readonly WrapForm[] = ['html', 'where']
const PLUGIN_NAME = 'automatos-theme-css'
const KEYFRAMES = /^(?:-webkit-)?keyframes$/i
/** A selector that starts with the root element, written as :root or html. */
const ROOT_ELEMENT = /^(?::root|html)(?![\w-])/i

/** Throws when the options can't make a stylesheet the server would accept. */
export function checkedOptions(options: ThemeCssOptions): Required<ThemeCssOptions> {
  if (!HTML_CLASS_PATTERN.test(options.htmlClass)) {
    throw new Error(`htmlClass "${options.htmlClass}" must be 3 to 32 lower-case letters, digits or dashes, starting with a letter.`)
  }
  const wrap = options.wrap ?? 'html'
  if (!WRAP_FORMS.includes(wrap)) throw new Error(`wrap must be one of ${WRAP_FORMS.join(', ')}.`)
  return { htmlClass: options.htmlClass, wrap }
}

/** The wrap that goes in front of every selector. */
export function wrapPrefix(htmlClass: string, wrap: WrapForm = 'html'): string {
  return wrap === 'where' ? `:where(html.${htmlClass})` : `html.${htmlClass}`
}

/** One selector under the wrap (unchanged when it already is). */
export function wrapSelector(selector: string, htmlClass: string, wrap: WrapForm = 'html'): string {
  const text = selector.trim()
  if (isScopedSelector(text, htmlClass)) return text
  const prefix = wrapPrefix(htmlClass, wrap)
  const rootElement = ROOT_ELEMENT.exec(text)
  if (rootElement !== null) return `${prefix}${text.slice(rootElement[0].length)}`
  return `${prefix} ${text}`
}

/** True for a rule its parent already contains: one nested in a rule, or a keyframe step. */
function isContained(rule: Rule): boolean {
  let node: Container | Document | undefined = rule.parent
  while (node !== undefined && node.type !== 'root' && node.type !== 'document') {
    if (node.type === 'rule') return true
    if (node.type === 'atrule' && KEYFRAMES.test((node as AtRule).name)) return true
    node = node.parent
  }
  return false
}

/** Puts every rule of `root` under the wrap. */
export function wrapRules(root: Root, htmlClass: string, wrap: WrapForm = 'html'): void {
  root.walkRules((rule: Rule) => {
    if (isContained(rule)) return
    const selectors = rule.selectors
    const wrapped = selectors.map((selector) => wrapSelector(selector, htmlClass, wrap))
    if (wrapped.some((selector, index) => selector !== selectors[index])) rule.selectors = wrapped
  })
}

/** The PostCSS plugin: rename the global names, then wrap every rule. */
export function themeCssPlugin(options: ThemeCssOptions): Plugin {
  const { htmlClass, wrap } = checkedOptions(options)
  return {
    postcssPlugin: PLUGIN_NAME,
    Once(root: Root) {
      renameGlobalNames(root, htmlClass)
      wrapRules(root, htmlClass, wrap)
    },
  }
}
themeCssPlugin.postcss = true as const

/** `css` with the plugin applied (synchronously: the plugin does no I/O). */
export function transformThemeCss(css: string, options: ThemeCssOptions): string {
  return postcss([themeCssPlugin(options)]).process(css, { from: undefined }).css
}
