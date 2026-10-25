// Play 1.1.1: Obsidian's Cream accent is its text colour, so the accent primary and the cream secondary (filled in
// the text colour) were the same button. Where a look's accent reads as its text colour (lib/looks/accent-like-text
// .ts: Cream on a dark ground, and no other pair in the catalogue), Play's frame and asleep screen carry
// data-accent-like-text, and every secondary button reads app/play-theme.css's --pl-button-2-* tokens, which turn
// it into an outline there. The mark is an attribute in the DOM; the buttons' colours are the stylesheets' text.
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AsleepScreen } from '../../src/components/play/edges/asleep-screen.tsx'
import { accentLikeText, colourDistance, SAME_COLOUR_DISTANCE } from '../../src/lib/looks/accent-like-text.ts'
import { ACCENT_KEYS, ACCENTS, GROUND_KEYS, GROUNDS } from '../../src/lib/looks/catalogue.ts'
import { EMBER, OBSIDIAN, PRESETS } from '../../src/lib/looks/presets.ts'
import { PlayFrameSlot } from '../../src/play-slots.tsx'
import { host } from '@automatos/theme-harness/host'
import { declaredFor, tokenValue } from '../support/rule-values.ts'

vi.mock('../../src/components/play/shell/play-sidebar.tsx', async () => {
  const { createElement } = await import('react')
  return { PlaySidebar: () => createElement('aside', { 'data-testid': 'play-sidebar' }) }
})
// Auto as his state only: this test is about the buttons around him.
vi.mock('../../src/components/mascot/auto-mascot.tsx', async () => {
  const { createElement } = await import('react')
  return { AutoMascot: ({ state }: { readonly state: string }) => createElement('div', { 'data-testid': 'auto', 'data-state': state }) }
})

const MARK = 'data-accent-like-text'
const THEME_CSS = 'app/play-theme.css'
/** Every secondary (cream) button: its stylesheet and selector. */
const SECONDARY_BUTTONS: readonly (readonly [string, string])[] = [
  ['components/play/shell/play-sidebar.module.css', '.newChat'],
  ['components/play/conversations/conversations.module.css', '.newChat'],
  ['components/play/chat/composer.module.css', '.send'],
  ['components/play/chat/composer.module.css', '.stop'],
  ['components/looks/style/style.module.css', '.copyButton'],
  ['components/play/edges/edges.module.css', '.checkAgain'],
]

const frameRoot = () => screen.getByTestId('play-sidebar').parentElement as HTMLElement

function renderFrame() {
  render(
    <PlayFrameSlot>
      <p>The page</p>
    </PlayFrameSlot>,
  )
}

beforeEach(() => {
  host.reset()
})

describe('a look whose accent reads as its text colour (Play 1.1.1)', () => {
  it('measures the distance between two colours by their sRGB channels', () => {
    expect(colourDistance('#000000', '#000000')).toBe(0)
    expect(colourDistance('#000000', '#030400')).toBe(5)
  })

  it('is Obsidian alone among the presets', () => {
    expect(PRESETS.filter(accentLikeText).map((look) => look.id)).toEqual([OBSIDIAN.id])
  })

  it('is Cream on every dark ground, and no other accent on any ground', () => {
    const pairs = GROUND_KEYS.flatMap((ground) => ACCENT_KEYS.map((accent) => ({ ground, accent })))
    const like = pairs.filter(accentLikeText).map(({ ground, accent }) => `${accent} on ${ground}`)
    expect(like).toEqual(['cream on graphite', 'cream on obsidian', 'cream on indigo'])
    const nearest = pairs.filter((pair) => !accentLikeText(pair)).map(({ ground, accent }) => colourDistance(ACCENTS[accent].hex, GROUNDS[ground].text))
    expect(Math.min(...nearest)).toBeGreaterThan(SAME_COLOUR_DISTANCE)
  })

  it("marks Play's frame on Obsidian", () => {
    host.setLooks({ look: OBSIDIAN })
    renderFrame()
    expect(frameRoot()).toHaveAttribute(MARK, 'true')
  })

  it('leaves the frame unmarked on Ember', () => {
    host.setLooks({ look: EMBER })
    renderFrame()
    expect(frameRoot()).not.toHaveAttribute(MARK)
  })

  it('marks the asleep screen on Obsidian too, so Check again is an outline there', () => {
    host.setLooks({ look: OBSIDIAN })
    const { container } = render(
      <AsleepScreen mascot="sleeping" detail="Automatos didn't answer." onCheck={vi.fn()} checking={false} recheckSeconds={10} local={false} />,
    )
    expect(container.firstElementChild).toHaveAttribute(MARK, 'true')
  })

  it('fills the secondary button in the text colour by default, and outlines it under the mark', () => {
    expect(['fill', 'ink', 'edge'].map((part) => tokenValue(THEME_CSS, `--pl-button-2-${part}`))).toEqual([
      'var(--pl-color-text)', 'var(--pl-color-bg)', 'var(--pl-color-text)',
    ])
    const marked = declaredFor(THEME_CSS, `html.play [${MARK}]`)
    expect(['fill', 'ink', 'edge'].map((part) => marked.get(`--pl-button-2-${part}`))).toEqual([
      'transparent', 'var(--pl-color-text)', 'var(--pl-line-button)',
    ])
  })

  it.each(SECONDARY_BUTTONS)('%s %s draws itself from the secondary button tokens', (file, selector) => {
    const button = declaredFor(file, selector)
    expect([button.get('background'), button.get('color'), button.get('border')]).toEqual([
      'var(--pl-button-2-fill)', 'var(--pl-button-2-ink)', '1px solid var(--pl-button-2-edge)',
    ])
  })
})
