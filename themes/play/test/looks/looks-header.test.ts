// @vitest-environment node
// Play 1.1.1: the Look page's header at 1024 to 1280 px, where the column beside the editor is narrow. The look's
// name broke mid-word (overflow-wrap: anywhere) and "See the style sheet" wrapped; now the name breaks between words,
// the link stays on one line, and under a 560px column (a container query on the page's main column) the header
// stacks: the heading, then the name and the link on the left. Auto in the preview is centred once the chat slice
// wraps under him. A static check of the stylesheet's text (css: false).
import { describe, expect, it } from 'vitest'
import { declaredFor } from '../support/rule-values.ts'

const LOOKS_CSS = 'components/looks/looks.module.css'
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
