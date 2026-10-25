/**
 * Play 1.1.1's polish tests read what a stylesheet declares for one selector: at the top level, or inside one
 * at-rule (a container query, a forced-colours block). vitest runs with css: false and jsdom lays nothing out, so
 * the layout is proven from the stylesheets' text, with the readers the guards use (css-cascade.ts, play-css.ts).
 */
import { readSource } from '../source-files.ts'
import { cssRules, withoutComments } from './css-cascade.ts'
import { bodyOf, declarations } from './play-css.ts'

/** Where the block that opens at `open` (a `{`) closes. */
function closingBrace(css: string, open: number): number {
  let depth = 0
  for (let at = open; at < css.length; at += 1) {
    if (css[at] === '{') depth += 1
    else if (css[at] === '}' && --depth === 0) return at
  }
  return css.length
}

/** Each at-rule group in `css`: its prelude (whitespace collapsed), where it starts and where its block ends. */
function groups(css: string): { readonly prelude: string; readonly start: number; readonly open: number; readonly close: number }[] {
  const found: { prelude: string; start: number; open: number; close: number }[] = []
  for (let start = css.indexOf('@'); start >= 0; start = css.indexOf('@', start + 1)) {
    const open = css.indexOf('{', start)
    if (open < 0) break
    const close = closingBrace(css, open)
    found.push({ prelude: css.slice(start, open).trim().replace(/\s+/g, ' '), start, open, close })
    start = close
  }
  return found
}

/** The stylesheet's text with every at-rule group taken out: its top-level rules only. */
export function topLevelOnly(css: string): string {
  const bare = withoutComments(css)
  return groups(bare).reduceRight((text, group) => text.slice(0, group.start) + text.slice(group.close + 1), bare)
}

/** The text inside each at-rule group whose prelude is `prelude` (whitespace collapsed). */
export function insideAtRule(css: string, prelude: string): string {
  const bare = withoutComments(css)
  return groups(bare).filter((group) => group.prelude === prelude).map((group) => bare.slice(group.open + 1, group.close)).join('\n')
}

/** What the rules for `selector` in `rel` (a path under src/) declare, a later one winning: top level, or inside `prelude`. */
export function declaredFor(rel: string, selector: string, prelude?: string): ReadonlyMap<string, string> {
  const css = readSource(rel)
  const text = prelude === undefined ? topLevelOnly(css) : insideAtRule(css, prelude)
  return declarations(bodyOf(cssRules(text), selector))
}

/** The value a custom property gets in `rel`'s top-level rules (play-theme.css's tokens), or undefined. */
export function tokenValue(rel: string, name: string): string | undefined {
  const match = new RegExp(`(?:^|[;{\\s])${name}\\s*:\\s*([^;]+);`).exec(topLevelOnly(readSource(rel)))
  return match?.[1].trim().replace(/\s+/g, ' ')
}
