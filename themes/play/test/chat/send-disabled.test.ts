// @vitest-environment node
// Play 1.1.1: Send with nothing to send. It was the fill at 55% opacity: muddy, and 2.4:1 on Daylight. Now it is an
// outline (the outlined buttons' line, a transparent fill, the third text colour), on the empty chat's accent Send
// as well as a conversation's cream one; Send and Stop carry a transparent 1px edge, so the outline takes no more
// room than the fill. A static check of the stylesheet's text (css: false).
import { describe, expect, it } from 'vitest'
import { declaredFor } from '../support/rule-values.ts'

const COMPOSER_CSS = 'components/play/chat/composer.module.css'
const OUTLINE: Readonly<Record<string, string>> = {
  'border-color': 'var(--pl-line-button)',
  background: 'transparent',
  color: 'var(--pl-color-text-3)',
  'box-shadow': 'none',
}

describe('Send with nothing to send (Play 1.1.1)', () => {
  it.each(['.send:disabled', '.chat[data-empty] .send:disabled'])('%s is an outline, not a faded fill', (selector) => {
    const disabled = declaredFor(COMPOSER_CSS, selector)
    expect(Object.fromEntries(Object.keys(OUTLINE).map((name) => [name, disabled.get(name)]))).toEqual(OUTLINE)
    expect(disabled.get('opacity')).toBeUndefined()
  })

  it("outranks the empty chat's accent Send, so the first open's disabled Send is an outline too", () => {
    expect(declaredFor(COMPOSER_CSS, '.chat[data-empty] .send').get('background')).toBe('var(--pl-color-accent)')
    expect(declaredFor(COMPOSER_CSS, '.chat[data-empty] .send:disabled').get('background')).toBe('transparent')
  })

  it('gives Send and Stop a transparent 1px edge, so the outline moves nothing', () => {
    expect(declaredFor(COMPOSER_CSS, '.send').get('border')).toBe('1px solid transparent')
    expect(declaredFor(COMPOSER_CSS, '.stop').get('border')).toBe('1px solid transparent')
  })
})
