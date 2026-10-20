// The toolchain Play's component tests run on (packages/theme-harness, through vitest.config.ts): jsdom by
// default, React with Testing Library and user-event, the jest-dom matchers, React's act environment, and
// a clean document between tests, <html> included (test/setup.ts). It renders Play's Looks preview, which
// needs no host beyond the SDK stand-in.
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { LookPreview, PREVIEW_CAPTION, PREVIEW_LABEL } from '../src/components/looks/look-preview.tsx'

// The stand-in has no media preferences: reduced motion keeps Auto a still, so no clip starts in jsdom.
vi.mock('@automatos/theme-sdk', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useMediaPreferences: () => ({ reducedMotion: true }),
}))

/** jsdom's own user agent ends in jsdom/<version>. */
const JSDOM_AGENT = /\bjsdom\/\d/
const TOGGLE = 'Toggle'
const PROBE_ATTRIBUTE = 'data-toolchain-probe'
const PROBE_PROPERTY = '--toolchain-probe'

function Toggle() {
  const [on, setOn] = useState(false)
  return (
    <button type="button" aria-pressed={on} onClick={() => setOn((value) => !value)}>
      {TOGGLE}
    </button>
  )
}

describe('the test toolchain', () => {
  it('runs a component test in jsdom', () => {
    expect(navigator.userAgent).toMatch(JSDOM_AGENT)
    expect(document.body).toBeInstanceOf(HTMLElement)
  })

  it("turns on React's act environment for the file", () => {
    expect(Reflect.get(globalThis, 'IS_REACT_ACT_ENVIRONMENT')).toBe(true)
  })

  it("renders Play's Looks preview: Auto with his caption and the sample chat", () => {
    render(<LookPreview />)
    const preview = screen.getByRole('region', { name: PREVIEW_LABEL })
    expect(preview).toBeInTheDocument()
    expect(within(preview).getByRole('img', { name: PREVIEW_CAPTION })).toBeVisible()
    expect(within(preview).getByText('Laptop shortlist')).toBeInTheDocument()
  })

  it('unmounts what the test before rendered', () => {
    expect(document.body).toBeEmptyDOMElement()
  })

  it('drives a component with user-event, its updates inside act', async () => {
    const user = userEvent.setup()
    render(<Toggle />)
    const toggle = screen.getByRole('button', { name: TOGGLE })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
  })
})

describe("Play's setup", () => {
  it('lets a test write onto <html>, as the look code does', () => {
    const root = document.documentElement
    root.setAttribute(PROBE_ATTRIBUTE, 'written')
    root.style.setProperty(PROBE_PROPERTY, '1')
    expect(root).toHaveAttribute(PROBE_ATTRIBUTE, 'written')
    expect(root.style.getPropertyValue(PROBE_PROPERTY)).toBe('1')
  })

  it('gives the next test the <html> it started with', () => {
    const root = document.documentElement
    expect(root).not.toHaveAttribute(PROBE_ATTRIBUTE)
    expect(root.style.getPropertyValue(PROBE_PROPERTY)).toBe('')
  })
})
