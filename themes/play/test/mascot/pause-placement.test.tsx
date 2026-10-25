// Play 1.1.1: Pause Auto at the large size (the first open, the asleep screen). It was a 68px row between Auto's ring
// and "Hi, I'm Auto."; now it is a quiet ghost button at the top right of his stage, out of the column's height, and
// still on the page wherever he moves (WCAG 2.2.2). The control is a role and a name in the DOM; where it stands is
// the stylesheet's text (css: false), read here. jsdom plays no media: play() is a mock that resolves.
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PAUSE_AUTO } from '@automatos/mascot/mascot-pause-button'
import { host } from '@automatos/theme-harness/host'
import { AutoMascot } from '../../src/components/mascot/auto-mascot.tsx'
import { declaredFor } from '../support/rule-values.ts'

const CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
const MASCOT_CSS = 'components/mascot/auto-mascot.module.css'
const LARGE = '.auto[data-size="large"]'
const LARGE_PAUSE = `${LARGE} .pause`

beforeEach(() => {
  host.reset()
  host.setFilesRoot('/api/themes/files/0123abcd/')
  Object.defineProperty(window.navigator, 'userAgent', { configurable: true, value: CHROME })
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
})

afterEach(() => {
  Reflect.deleteProperty(window.navigator, 'userAgent')
  vi.restoreAllMocks()
})

describe('Pause Auto at the large size (Play 1.1.1, WCAG 2.2.2)', () => {
  it('is still on the page beside a moving Auto at the large size, with no caption between', () => {
    const { container } = render(<AutoMascot state="idle" size="large" showCaption={false} />)
    expect(container.firstElementChild).toHaveAttribute('data-size', 'large')
    expect(screen.getByRole('button', { name: PAUSE_AUTO })).toHaveAttribute('aria-pressed', 'false')
    expect(container.querySelector('[aria-live]')).toBeNull()
  })

  it("stands at the top right of Auto's stage, out of the column, as a ghost button", () => {
    expect(declaredFor(MASCOT_CSS, LARGE).get('position')).toBe('relative')
    const pause = declaredFor(MASCOT_CSS, LARGE_PAUSE)
    expect(pause.get('position')).toBe('absolute')
    expect(pause.get('top')).toBe('0')
    expect(pause.get('left')).toBe('calc(50% + var(--pl-auto-size) * 0.45 + var(--pl-space-2))')
    expect(pause.get('border-color')).toBe('transparent')
    expect(pause.get('color')).toBe('var(--pl-color-text-2)')
  })

  it('shows its edge once pressed, so a paused Auto still reads as paused', () => {
    const pressed = declaredFor(MASCOT_CSS, `${LARGE_PAUSE}[aria-pressed="true"]`)
    expect(pressed.get('border-color')).toBe('var(--pl-line-button)')
    expect(pressed.get('background')).toBe('var(--pl-tint-selected)')
  })

  it('keeps the regular size under him, in the flow', () => {
    expect(declaredFor(MASCOT_CSS, '.pause').get('position')).toBeUndefined()
  })
})
