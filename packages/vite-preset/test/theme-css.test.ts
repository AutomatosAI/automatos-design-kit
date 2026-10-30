/**
 * The PostCSS step: every rule under the wrap (both forms), global names renamed, and the result
 * passing the server's scope check, or failing it where the wrap can't help.
 */
import postcss from 'postcss'
import { describe, expect, it } from 'vitest'
import { cssScopeErrors } from '../src/css-scope.ts'
import { checkedOptions, themeCssPlugin, transformThemeCss, wrapSelector, type WrapForm } from '../src/theme-css.ts'
import { themeName } from '../src/theme-names.ts'

const HTML_CLASS = 'hello'
const FORMS: readonly WrapForm[] = ['html', 'where']

/** A stylesheet as a theme's sources and CSS modules give it, before the wrap. */
const SOURCE = `
:root { --hello-accent: #2f6fed; }
.bar, .bar > button { color: var(--hello-accent); }
.hello-frame-a1B2c { padding: 4px; }
.card { .title { font-weight: 700; } &:hover { opacity: 0.9; } }
@media (min-width: 600px) { .bar { padding: 8px; } }
@supports (display: grid) { @media (hover: hover) { .grid { display: grid; } } }
@layer theme;
@layer theme { .layered { color: red; } }
@keyframes hello-fade { from { opacity: 0; } 50% { opacity: 0.5; } to { opacity: 1; } }
html.hello .already { color: blue; }
:where(html.hello) .already-where { color: blue; }
`

function transform(css: string, wrap: WrapForm = 'html'): string {
  return transformThemeCss(css, { htmlClass: HTML_CLASS, wrap })
}

describe('wrapSelector', () => {
  it.each([
    ['.a', 'html', 'html.hello .a'],
    ['.a', 'where', ':where(html.hello) .a'],
    [':root', 'html', 'html.hello'],
    [':root', 'where', ':where(html.hello)'],
    ['html', 'html', 'html.hello'],
    ['HTML', 'html', 'html.hello'],
    ['html.dark .a', 'html', 'html.hello.dark .a'],
    ['html.dark .a', 'where', ':where(html.hello).dark .a'],
    ['html.hello-x .a', 'html', 'html.hello.hello-x .a'],
    ['body', 'html', 'html.hello body'],
    ['html-card .a', 'html', 'html.hello html-card .a'],
    ['  .a  ', 'html', 'html.hello .a'],
    ['html.hello .a', 'html', 'html.hello .a'],
    [':where(html.hello) .a', 'html', ':where(html.hello) .a'],
    ['html.hello .a', 'where', 'html.hello .a'],
  ] as const)('%j (%s) → %j', (selector, wrap, expected) => {
    expect(wrapSelector(selector, HTML_CLASS, wrap)).toBe(expected)
  })
})

describe('the wrap over a whole stylesheet', () => {
  it.each([...FORMS])('puts every rule under the %s form and passes the server check', (wrap) => {
    const css = transform(SOURCE, wrap)
    expect(cssScopeErrors(css, HTML_CLASS)).toEqual([])
    const prefix = wrap === 'where' ? ':where(html.hello)' : 'html.hello'
    expect(css).toContain(`${prefix} { --hello-accent`)
    expect(css).toContain(`${prefix} .bar, ${prefix} .bar > button {`)
    expect(css).toContain(`${prefix} .hello-frame-a1B2c {`)
    expect(css).toContain(`@media (min-width: 600px) { ${prefix} .bar {`)
    expect(css).toContain(`@media (hover: hover) { ${prefix} .grid {`)
    expect(css).toContain(`@layer theme { ${prefix} .layered {`)
  })

  it('leaves nested rules and keyframe steps to their parent', () => {
    const css = transform(SOURCE)
    expect(css).toContain('html.hello .card { .title { font-weight: 700; } &:hover { opacity: 0.9; } }')
    expect(css).toContain('@keyframes hello-fade { from { opacity: 0; } 50% { opacity: 0.5; } to { opacity: 1; } }')
  })

  it('leaves rules already under the wrap as they are', () => {
    const css = transform(SOURCE)
    expect(css).toContain('html.hello .already { color: blue; }')
    expect(css).toContain(':where(html.hello) .already-where { color: blue; }')
  })

  it('gives the same stylesheet when run twice', () => {
    const once = transform(SOURCE)
    expect(transform(once)).toBe(once)
  })

  it('works as a PostCSS plugin', async () => {
    const result = await postcss([themeCssPlugin({ htmlClass: HTML_CLASS })]).process('.a { color: red; }', { from: undefined })
    expect(result.css).toBe('html.hello .a { color: red; }')
  })
})

describe('global names', () => {
  it('renames keyframes and the animations that use them', () => {
    const css = transform([
      '@keyframes spin { to { transform: rotate(1turn); } }',
      '@-webkit-keyframes "pulse" { to { opacity: 1; } }',
      '.a { animation: spin 1s linear infinite, pulse 2s; }',
      '.b { animation-name: spin; }',
      '.c { animation: hello-fade 1s; }',
    ].join('\n'))
    expect(css).toContain('@keyframes hello-spin {')
    expect(css).toContain('@-webkit-keyframes hello-pulse {')
    expect(css).toContain('animation: hello-spin 1s linear infinite, hello-pulse 2s;')
    expect(css).toContain('animation-name: hello-spin;')
    expect(css).toContain('animation: hello-fade 1s;')
    expect(cssScopeErrors(css, HTML_CLASS)).toEqual([])
  })

  it('renames font faces and every use of the family', () => {
    const css = transform([
      '@font-face { font-family: "Brand Sans"; src: local("Brand Sans"); }',
      '.a { font-family: "Brand Sans", serif; }',
      '.b { font: 700 12px/1.5 "Brand Sans", serif; }',
      '.c { font: italic 12px Brand Sans, serif; }',
      ':root { --hello-font: Brand Sans, serif; --hello-shadow: 0 1px 2px red,0 0 1px blue; }',
    ].join('\n'))
    expect(css).toContain('font-family: hello-Brand-Sans; src: local("Brand Sans");')
    expect(css).toContain('.a { font-family: hello-Brand-Sans, serif; }')
    expect(css).toContain('font: 700 12px/1.5 hello-Brand-Sans, serif;')
    expect(css).toContain('font: italic 12px hello-Brand-Sans, serif;')
    expect(css).toContain('--hello-font: hello-Brand-Sans, serif;')
    expect(css).toContain('--hello-shadow: 0 1px 2px red,0 0 1px blue;')
    expect(cssScopeErrors(css, HTML_CLASS)).toEqual([])
  })

  it('keeps names the theme already owns', () => {
    const source = '@font-face { font-family: hello-inter; } @keyframes hello-spin { to { opacity: 1; } }'
    expect(transform(source)).toBe(source)
  })

  it('makes a safe name from any keyframes or family name', () => {
    expect(themeName('Brand Sans', HTML_CLASS)).toBe('hello-Brand-Sans')
    expect(themeName('--x', HTML_CLASS)).toBe('hello-x')
    expect(themeName('é', HTML_CLASS)).toBe('hello-name')
  })
})

describe('what the wrap cannot fix still fails the check', () => {
  it.each([
    ['!important', '.a { color: red !important; }', 'CSS_IMPORTANT'],
    ['@import', '@import "other.css";', 'CSS_IMPORT'],
    ['a protected surface', '[data-protected-surface] { display: none; }', 'CSS_UNSCOPED'],
    ["the host's AI label", '[data-ai-label] { display: none; }', 'CSS_UNSCOPED'],
    ['& outside the start of a nested selector', '.a { :not(&) { display: none; } }', 'CSS_UNSCOPED'],
    ['an at-rule the server does not list', '@page { margin: 0; }', 'CSS_AT_RULE'],
  ])('%s', (_name, source, code) => {
    const codes = cssScopeErrors(transform(source), HTML_CLASS).map((error) => error.code)
    expect(codes).toContain(code)
  })
})

describe('options', () => {
  it('refuses a class the server would refuse, and an unknown wrap form', () => {
    expect(() => checkedOptions({ htmlClass: 'Hello' })).toThrow(/htmlClass/)
    expect(() => checkedOptions({ htmlClass: 'hi' })).toThrow(/htmlClass/)
    expect(() => checkedOptions({ htmlClass: 'hello', wrap: 'is' as WrapForm })).toThrow(/wrap/)
  })

  it('defaults to the html form', () => {
    expect(checkedOptions({ htmlClass: 'hello' })).toEqual({ htmlClass: 'hello', wrap: 'html' })
  })
})
