// The base layer the mock host draws a theme on (src/host/core-base.ts), as core's every page has it: Tailwind
// 3.3.3's preflight with core's theme values (every box border-box, its border reset to 0 solid, no default margins,
// buttons that inherit their text), then core's globals.css base (every border in hsl(var(--border)), the body in
// hsl(var(--background)) on hsl(var(--foreground)), and Studio's Geist type), installed once as the first sheet of
// the page's <head>, before the theme's own. Without it a theme's sidebar measured 264 px where core draws 232.
import postcss from 'postcss'
import { afterEach, describe, expect, it } from 'vitest'
import { CORE_BASE_CSS, CORE_BASE_STYLE_ID, installCoreBase } from '../src/host/core-base.ts'
import { CORE_MONO, CORE_SANS } from '../src/vendor/tailwind-preflight/preflight.ts'

const sheet = postcss.parse(CORE_BASE_CSS)

/** Every declaration of the rules whose selector list is exactly `selector`, later rules over earlier ones. */
function declared(selector: string): Record<string, string> {
  const found: Record<string, string> = {}
  sheet.walkRules((rule) => {
    if (rule.selectors.join(', ') !== selector) return
    rule.walkDecls((decl) => {
      found[decl.prop] = decl.value
    })
  })
  return found
}

afterEach(() => {
  document.getElementById(CORE_BASE_STYLE_ID)?.remove()
  document.head.querySelectorAll('[data-test-sheet]').forEach((node) => node.remove())
})

describe("Tailwind's preflight, with core's theme values", () => {
  it('sizes every box and its ::before and ::after border-box, with a border reset to 0 solid', () => {
    expect(declared('*, ::before, ::after')).toEqual({
      'box-sizing': 'border-box', 'border-width': '0', 'border-style': 'solid', 'border-color': '#e5e7eb',
    })
  })

  it("draws the page in core's sans stack at line height 1.5, code in core's mono stack", () => {
    expect(declared('html')).toMatchObject({ 'font-family': CORE_SANS, 'line-height': '1.5' })
    expect(CORE_SANS.startsWith('ui-sans-serif, system-ui')).toBe(true)
    expect(declared('code, kbd, samp, pre')).toMatchObject({ 'font-family': CORE_MONO })
  })

  it('takes the default margins off, and leaves a button its text and no background', () => {
    expect(declared('blockquote, dl, dd, h1, h2, h3, h4, h5, h6, hr, figure, p, pre')).toEqual({ margin: '0' })
    expect(declared('ol, ul, menu')).toEqual({ 'list-style': 'none', margin: '0', padding: '0' })
    expect(declared('button, input, optgroup, select, textarea')).toMatchObject({ 'font-family': 'inherit', padding: '0' })
    expect(declared("button, [type='button'], [type='reset'], [type='submit']")).toMatchObject({ 'background-color': 'transparent' })
  })
})

describe("core's own base layer", () => {
  it("draws every border in core's border token and the body on its ground and text tokens", () => {
    expect(declared('*')).toEqual({ 'border-color': 'hsl(var(--border))' })
    expect(declared('body')).toEqual({
      margin: '0', 'line-height': 'inherit', 'background-color': 'hsl(var(--background))', color: 'hsl(var(--foreground))',
    })
  })

  it("holds core's values of those tokens for Studio, light and dark, and Studio's Geist type", () => {
    expect(declared('.studio')).toMatchObject({ '--background': '38 50% 92%', '--foreground': '30 12% 9%', '--border': '40 30% 80%' })
    expect(declared('.studio.dark')).toMatchObject({ '--background': '30 12% 9%', '--border': '30 10% 22%' })
    expect(declared('.studio')['font-family']?.startsWith('var(--font-geist-sans),')).toBe(true)
    expect(declared('.studio h1, .studio h2, .studio .font-serif, .studio [data-studio-serif]')['font-family']).toMatch(/^var\(--font-newsreader\),/)
  })
})

describe('installCoreBase', () => {
  it("puts the base first in <head>, before a sheet already there, once however often it's called", () => {
    const theme = document.createElement('style')
    theme.setAttribute('data-test-sheet', '')
    document.head.appendChild(theme)
    installCoreBase(document)
    installCoreBase(document)
    const base = document.getElementById(CORE_BASE_STYLE_ID)
    expect(document.head.firstElementChild).toBe(base)
    expect(document.querySelectorAll(`#${CORE_BASE_STYLE_ID}`)).toHaveLength(1)
    expect(base?.textContent).toBe(CORE_BASE_CSS)
  })
})
