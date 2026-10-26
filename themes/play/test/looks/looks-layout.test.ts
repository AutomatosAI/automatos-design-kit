// @vitest-environment node
// Play 1.1.1: the Look page's header at 1024 to 1280 px, where the column beside the editor is narrow. The look's
// name broke mid-word (overflow-wrap: anywhere) and "See the style sheet" wrapped; now the name breaks between words,
// the link stays on one line, and under a 560px column (a container query on the page's main column) the header
// stacks: the heading, then the name and the link on the left. Auto in the preview is centred once the chat slice
// wraps under him. The Looks row cut its cards at the edge with no sign of more: now each card snaps to the row's
// start and the row's end fades. Play 1.2.1: the editor's option groups sit 20 px apart and 8 px under their labels, so
// at 1440 by 900 the whole panel fits under the header row and Save as new look is no longer cut at the window's foot.
// A static check of the stylesheet's text (css: false).
import { describe, expect, it } from 'vitest'
import { declaredFor } from '../support/rule-values.ts'

const LOOKS_CSS = 'components/looks/looks.module.css'
const EDITOR_CSS = 'components/looks/editor.module.css'
const NARROW = '@container (max-width: 560px)'

describe("the Look page's header in a narrow column (Play 1.1.1)", () => {
  it('makes the main column the container the header asks about', () => {
    expect(declaredFor(LOOKS_CSS, '.main').get('container-type')).toBe('inline-size')
  })

  it("breaks the look's name between words, never mid-word, and keeps the style sheet link on one line", () => {
    expect(declaredFor(LOOKS_CSS, '.status').get('overflow-wrap')).toBe('break-word')
    expect(declaredFor(LOOKS_CSS, '.styleLink').get('white-space')).toBe('nowrap')
  })

  it('stacks the header under 560px: the heading, then the name and the link, on the left', () => {
    const header = declaredFor(LOOKS_CSS, '.header', NARROW)
    expect([header.get('flex-direction'), header.get('align-items')]).toEqual(['column', 'flex-start'])
    expect(declaredFor(LOOKS_CSS, '.headerSide', NARROW).get('align-items')).toBe('flex-start')
    expect(declaredFor(LOOKS_CSS, '.status', NARROW).get('text-align')).toBe('left')
  })

  it('keeps the header in one row in a wide column, the name on the right', () => {
    expect(declaredFor(LOOKS_CSS, '.header').get('flex-direction')).toBeUndefined()
    expect(declaredFor(LOOKS_CSS, '.status').get('text-align')).toBe('right')
  })

  it("centres the preview's Auto on his own line once the chat slice wraps under him", () => {
    expect(declaredFor(LOOKS_CSS, '.previewAuto').get('margin-inline')).toBe('auto')
  })
})

describe('the Looks row when it overflows (Play 1.1.1)', () => {
  it('snaps each card to the start of the row as it scrolls sideways', () => {
    const row = declaredFor(LOOKS_CSS, '.row')
    expect([row.get('overflow-x'), row.get('scroll-snap-type')]).toEqual(['auto', 'x mandatory'])
    expect(declaredFor(LOOKS_CSS, '.rowItem').get('scroll-snap-align')).toBe('start')
  })

  it("fades the row's end over its end padding, so a cut card reads as more to scroll to and the last one lands clear", () => {
    const row = declaredFor(LOOKS_CSS, '.row')
    expect(row.get('mask-image')).toBe('linear-gradient(to right, currentcolor calc(100% - var(--pl-space-6)), transparent)')
    expect(row.get('padding')?.split(' ')[1]).toBe('var(--pl-space-6)')
  })
})

describe("the Look page's editor at 1440 by 900 (Play 1.2.1)", () => {
  it('sets its option groups 20 px apart and 8 px under their labels, so Save as new look and Reset fit the window', () => {
    expect(declaredFor(EDITOR_CSS, '.editor').get('gap')).toBe('calc(var(--pl-space-4) + var(--pl-space-1))')
    expect(declaredFor(EDITOR_CSS, '.section').get('gap')).toBe('var(--pl-space-2)')
  })

  it('keeps the actions at the foot, the panel scrolling on its own in a shorter window', () => {
    expect(declaredFor(EDITOR_CSS, '.actions').get('margin-top')).toBe('auto')
    expect(declaredFor(EDITOR_CSS, '.editor').get('overflow-y')).toBe('auto')
  })
})
