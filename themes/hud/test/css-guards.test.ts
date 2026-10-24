// @vitest-environment node
// HUD's CSS guards, over every stylesheet under src/:
// - scope: each one, wrapped as the kit's preset wraps it (vite-preset's theme-css), passes the server's scope check
//   (vite-preset's css-scope, a port of core's css_scope.py), and the global ones (src/app/) pass it as written;
// - no `!important` and no `@import`, and no selector names the host's protected surfaces;
// - every @keyframes name and @font-face family starts with hud-, as written, so the build renames none of them;
// - HUD defines only --hud-* variables, and Studio's --radius on purpose; it reads only its own, the host's fonts and
//   the host's motion factor (the look's variables are --hud-*, painted by the host from boot/prepaint.json);
// - no literal colour: no #hex, no colour function of numbers and no named colour, a system colour only inside a
//   forced-colours block. src/lib/looks/catalogue.ts is the one home for a colour.
import { cssScopeErrors } from '@automatos/vite-preset/css-scope'
import { transformThemeCss } from '@automatos/vite-preset/theme-css'
import { describe, expect, it } from 'vitest'
import { readSource, sourceStyles } from './support/files.ts'

const HTML_CLASS = 'hud'
const GLOBAL_STYLE = /^app\//
const COMMENT = /\/\*[\s\S]*?\*\//g
/** Variables HUD may define besides its own: Studio's corner radius, which HUD sets to 0 on purpose. */
const DEFINED_OUTSIDE_PREFIX: readonly string[] = ['--radius']
/** Variables HUD may read besides its own: the host's Geist faces and its motion factor. */
const READ_OUTSIDE_PREFIX: readonly string[] = ['--font-geist-sans', '--font-geist-mono', '--theme-motion']
const OWN_PREFIX = '--hud-'
const HEX_COLOUR = /#[0-9a-f]{3,8}\b/i
const COLOUR_FUNCTION = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(\s*[-+.\d]/i
const NAMED_COLOURS: readonly string[] = [
  'black', 'white', 'red', 'green', 'blue', 'gray', 'grey', 'orange', 'yellow', 'purple', 'pink', 'cyan', 'magenta',
  'navy', 'teal', 'lime', 'maroon', 'olive', 'silver', 'aqua', 'fuchsia', 'gold', 'coral', 'violet', 'indigo',
]
const SYSTEM_COLOURS: readonly string[] = [
  'highlight', 'highlighttext', 'canvas', 'canvastext', 'buttontext', 'buttonface', 'buttonborder', 'linktext',
  'graytext', 'field', 'fieldtext', 'mark', 'marktext', 'accentcolor', 'accentcolortext', 'visitedtext', 'activetext',
]
/** A forced-colours block, from its @media line to its closing brace (HUD's hold one level of rules). */
const FORCED_COLOURS_BLOCK = /@media\s*\(forced-colors:\s*active\)\s*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g
const DECLARATION = /(--[\w-]+|[a-z-]+)\s*:\s*([^;{}]+);/g

function stripped(rel: string): string {
  return readSource(rel).replace(COMMENT, ' ')
}

/** Every `name: value;` of a stylesheet, comments out. */
function declarations(css: string): { readonly name: string; readonly value: string }[] {
  return Array.from(css.matchAll(DECLARATION), (match) => ({ name: match[1], value: match[2].trim() }))
}

function valueWords(value: string): string[] {
  return value.toLowerCase().split(/[\s,()/]+/).filter(Boolean)
}

const STYLES = sourceStyles()

describe("HUD's stylesheets", () => {
  it('are found: the two global ones and the modules', () => {
    expect(STYLES).toEqual(expect.arrayContaining(['app/hud-fonts.css', 'app/hud-theme.css']))
    expect(STYLES.filter((rel) => rel.endsWith('.module.css')).length).toBeGreaterThan(0)
  })

  it.each(STYLES)('%s passes the scope check once wrapped as the preset wraps it', (rel) => {
    expect(cssScopeErrors(transformThemeCss(readSource(rel), { htmlClass: HTML_CLASS }), HTML_CLASS)).toEqual([])
  })

  it.each(STYLES.filter((rel) => GLOBAL_STYLE.test(rel)))('%s is under html.hud as written', (rel) => {
    expect(cssScopeErrors(readSource(rel), HTML_CLASS)).toEqual([])
  })

  it.each(STYLES)('%s marks nothing important, imports nothing and leaves the protected surfaces alone', (rel) => {
    const css = stripped(rel)
    expect(css).not.toMatch(/!\s*important/i)
    expect(css).not.toMatch(/@import\b/i)
    expect(css).not.toMatch(/data-protected-surface/)
  })

  it.each(STYLES)("%s names its keyframes and font families hud-…", (rel) => {
    const css = stripped(rel)
    const keyframes = Array.from(css.matchAll(/@(?:-webkit-)?keyframes\s+([^\s{]+)/g), (match) => match[1])
    const families = Array.from(css.matchAll(/@font-face\s*\{[^}]*font-family:\s*([^;]+);/g), (match) => match[1].trim())
    expect([...keyframes, ...families].filter((name) => !name.startsWith(`${HTML_CLASS}-`))).toEqual([])
  })

  it.each(STYLES)('%s defines only --hud-* variables (and --radius), and reads only its own and the host\'s', (rel) => {
    const css = stripped(rel)
    const defined = declarations(css).map(({ name }) => name).filter((name) => name.startsWith('--'))
    const read = Array.from(css.matchAll(/var\(\s*(--[\w-]+)/g), (match) => match[1])
    expect(defined.filter((name) => !name.startsWith(OWN_PREFIX) && !DEFINED_OUTSIDE_PREFIX.includes(name))).toEqual([])
    expect(read.filter((name) => !name.startsWith(OWN_PREFIX) && !READ_OUTSIDE_PREFIX.includes(name))).toEqual([])
  })

  it.each(STYLES)('%s holds no literal colour, and a system colour only for forced colours', (rel) => {
    const css = stripped(rel)
    const outside = css.replace(FORCED_COLOURS_BLOCK, ' ')
    const values = declarations(css).map(({ value }) => value)
    expect(values.filter((value) => HEX_COLOUR.test(value) || COLOUR_FUNCTION.test(value))).toEqual([])
    expect(values.flatMap(valueWords).filter((word) => NAMED_COLOURS.includes(word))).toEqual([])
    const system = declarations(outside).flatMap(({ value }) => valueWords(value)).filter((word) => SYSTEM_COLOURS.includes(word))
    expect(system).toEqual([])
  })
})
