// @vitest-environment node
// Play 1.2.0 — Play's pages at a phone's width, from its stylesheets' text (css: false; jsdom lays nothing out, and
// the harness's phone shots at 390 x 844 photograph and scan the real thing). Every phone rule sits under the one
// media query Play's layout switches at (src/lib/play/phone-layout.ts PHONE_MEDIA: below core's 1024 px desktop), so
// the stylesheets and the frame agree on each side of the width. On a phone each page starts 16 px in, as the Ember
// design's 390 screens do; nothing lays out wider than the screen (the side columns stack, the shelf has two
// columns, the style sheet one); the phone bar's controls and the menu's are 44 px targets; and the shut menu draws
// nothing.
import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PHONE_MEDIA, PHONE_QUERY } from '../../src/lib/play/phone-layout.ts'
import { readSource } from '../source-files.ts'
import { playCssFiles, relative } from '../support/play-css.ts'
import { withoutComments } from '../support/css-cascade.ts'
import { declaredFor, tokenValue } from '../support/rule-values.ts'

const THEME_CSS = 'app/play-theme.css'
const PHONE_CSS = 'components/play/shell/phone.module.css'
const TAP = 'var(--pl-tap-min)'
const PHONE_INSET = 'var(--pl-space-4)'
/** Every @media prelude in a stylesheet, whitespace collapsed. */
const MEDIA = /@media\s*([^{]+)\{/g
/** The media features Play asks besides the phone's width: the OS's motion and forced colours settings. */
const OTHER_MEDIA = ['(prefers-reduced-motion: reduce)', '(forced-colors: active)']

/** Each page's outer box on a phone, by stylesheet and selector: whose left padding is the page's inset. */
const PHONE_PAGES: readonly (readonly [string, string])[] = [
  ['components/play/shell/play-frame.module.css', '.page'],
  ['components/play/shell/page-columns.module.css', '.pageHeader'],
  ['components/play/chat/chat.module.css', '.messages'],
  ['components/play/chat/first-open.module.css', '.hero'],
  ['components/play/conversations/conversations.module.css', '.body'],
  ['components/play/deliverables/shelf.module.css', '.page'],
  ['components/play/deliverables/deliverable-detail.module.css', '.page'],
  ['components/play/edges/edges.module.css', '.body'],
  ['components/looks/looks.module.css', '.main'],
  ['components/looks/style/style.module.css', '.page'],
]

/** The left value of a padding shorthand (one to four values). */
function leftOf(padding: string | undefined): string | undefined {
  const values = padding?.match(/var\([^)]*\)|calc\([^)]*\)\)?|[^\s]+/g) ?? []
  return [undefined, values[0], values[1], values[1], values[3]][values.length]
}

const onPhone = (file: string, selector: string): ReadonlyMap<string, string> => declaredFor(file, selector, PHONE_MEDIA)

describe('the phone width in the stylesheets', () => {
  it("is the frame's: below core's 1024 px desktop", () => {
    expect(PHONE_QUERY).toBe('(max-width: 1023px)')
    expect(PHONE_MEDIA).toBe('@media (max-width: 1023px)')
  })

  it('is the only width any of Play\'s stylesheets asks about', () => {
    const asked = playCssFiles().flatMap((file) =>
      Array.from(withoutComments(fs.readFileSync(file, 'utf8')).matchAll(MEDIA), (match) => `${relative(file)}: ${match[1].trim().replace(/\s+/g, ' ')}`),
    )
    expect(asked.length).toBeGreaterThan(0)
    expect(asked.filter((line) => ![PHONE_QUERY, ...OTHER_MEDIA].includes(line.slice(line.indexOf(': ') + 2)))).toEqual([])
  })
})

describe('the pages on a phone', () => {
  it.each(PHONE_PAGES)('%s %s starts 16 px in', (file, selector) => {
    expect(leftOf(onPhone(file, selector).get('padding'))).toBe(PHONE_INSET)
  })

  it('stacks what stands beside the page on a desktop: the Deliverable\'s panel, the look editor, the style sheet\'s columns', () => {
    expect(onPhone('components/play/deliverables/deliverable-detail.module.css', '.layout').get('grid-template-columns')).toBe('minmax(0, 1fr)')
    const panel = onPhone('components/play/deliverables/detail-panel.module.css', '.panel')
    expect([panel.get('position'), panel.get('border-left')]).toEqual(['static', '0'])
    expect(onPhone('components/looks/looks.module.css', '.screen').get('flex-direction')).toBe('column')
    const editor = onPhone('components/looks/editor.module.css', '.editor')
    expect([editor.get('width'), editor.get('border-left')]).toEqual(['auto', '0'])
    expect(onPhone('components/looks/style/style.module.css', '.columns').get('grid-template-columns')).toBe('minmax(0, 1fr)')
    expect(onPhone('components/looks/style/type.module.css', '.specimen').get('grid-template-columns')).toBe('minmax(0, 1fr)')
  })

  it('lays the shelf in two columns, as the design does, so the newest spans the screen and nothing more', () => {
    expect(onPhone('components/play/deliverables/shelf-card.module.css', '.grid').get('grid-template-columns')).toBe('repeat(2, minmax(0, 1fr))')
  })

  it("wraps what could run past the screen's edge: the composer's line, Auto beside his caption, the shelf's header", () => {
    expect(declaredFor('components/play/chat/composer.module.css', '.box').get('flex-wrap')).toBe('wrap')
    expect(onPhone('components/mascot/auto-mascot.module.css', '.auto[data-size="small"]').get('flex-wrap')).toBe('wrap')
    expect(onPhone('components/mascot/auto-mascot.module.css', '.auto[data-size="large"] .pause').get('position')).toBe('static')
    expect(onPhone('components/play/deliverables/shelf.module.css', '.header').get('flex-wrap')).toBe('wrap')
  })

  it("sets the headlines in the phone's sizes", () => {
    expect(onPhone('components/play/chat/first-open.module.css', ':global(html.play) .title').get('font')).toBe('var(--pl-text-hero-phone)')
    expect(onPhone('components/play/edges/edges.module.css', ':global(html.play) .title').get('font')).toBe('var(--pl-text-hero-phone)')
    expect(onPhone('components/play/edges/edges.module.css', '.big404').get('font')).toBe('var(--pl-text-404-phone)')
    expect(onPhone('components/play/shell/page-columns.module.css', ':global(html.play) .pageTitle').get('font')).toBe('var(--pl-text-status-phone)')
  })

  it('draws Auto at 170 px at his large size, as the design\'s first open does at 390', () => {
    const css = withoutComments(readSource(THEME_CSS))
    expect(css).toMatch(/@media \(max-width: 1023px\) \{\s*html\.play \{\s*--pl-mascot-size-large: 170px;/)
  })
})

describe('the phone bar and its menu', () => {
  it('is the design\'s 56 px bar, its controls 44 px targets', () => {
    expect(tokenValue(THEME_CSS, '--pl-phone-bar-height')).toBe('56px')
    expect(tokenValue(THEME_CSS, '--pl-tap-min')).toBe('44px')
    expect(declaredFor(PHONE_CSS, '.bar').get('height')).toBe('var(--pl-phone-bar-height)')
    const menu = declaredFor(PHONE_CSS, '.menuButton')
    expect([menu.get('width'), menu.get('height')]).toEqual([TAP, TAP])
    expect(declaredFor(PHONE_CSS, '.place').get('min-height')).toBe(TAP)
    expect(declaredFor(PHONE_CSS, '.wordmark').get('min-height')).toBe(TAP)
    const close = declaredFor(PHONE_CSS, '.close')
    expect([close.get('width'), close.get('height')]).toEqual([TAP, TAP])
    expect(declaredFor(PHONE_CSS, '.search').get('min-height')).toBe(TAP)
  })

  it("lets the wordmark give way on the narrowest phone rather than push Chats and Shelf off it", () => {
    const wordmark = declaredFor(PHONE_CSS, '.wordmark')
    expect([wordmark.get('flex'), wordmark.get('min-width')]).toEqual(['1 1 auto', '0'])
    const words = declaredFor(PHONE_CSS, '.wordmarkText')
    expect([words.get('overflow'), words.get('text-overflow')]).toEqual(['hidden', 'ellipsis'])
    expect(declaredFor(PHONE_CSS, '.places').get('flex')).toBe('none')
  })

  it('draws nothing of the menu while it is shut, and leaves glass to tap beside it when open', () => {
    expect(declaredFor(PHONE_CSS, '.layer[hidden]').get('display')).toBe('none')
    expect(declaredFor(PHONE_CSS, '.menu').get('width')).toBe('min(320px, calc(100% - var(--pl-space-7)))')
  })
})
