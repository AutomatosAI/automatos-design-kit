// Candy's style sheet (styleSheet@1, the host's /looks/style) on the kit's harness: it names the active look and
// links back to Your look; it shows the type scale, Auto's twelve states as stills each with its word, and every
// design pair, measured from the colours painted on <html> ("not measured" until they are, and measured again when
// the host repaints); and it draws the three card gradients under Soft, Rich and Vivid with the very layers the
// first paint uses for each.
import { MASCOT_STATES } from '@automatos/mascot/types'
import { host } from '@automatos/theme-harness/host'
import { act, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { stateWord } from '../src/art/state-words.ts'
import { paletteById } from '../src/looks/catalogue.ts'
import { contrastRatio, rgbOfHex } from '../src/looks/colour.ts'
import { DESIGN_PAIRS } from '../src/looks/pairs.ts'
import { buildPrepaint } from '../src/looks/prepaint.ts'
import { GRADIENT_NOTES, PRESETS } from '../src/looks/spec.ts'
import { CARD_LAYERS } from '../src/style/card-layers.ts'
import { NOT_MEASURED, PAIRS_HEADING, verdictOf } from '../src/style/style-colours.tsx'
import { CARDS_HEADING, STATES_HEADING, TYPE_HEADING, TYPE_SCALE } from '../src/style/style-parts.tsx'
import { activeLookLine, BACK_TO_LOOK, STYLE_HEADING, StyleSheet } from '../src/style/style-sheet.tsx'

const NIGHTBLOOM = PRESETS[2]
const NIGHT_COLOURS = paletteById('nightbloom')?.colours
const PAINTED = { '--candy-text': NIGHT_COLOURS?.text ?? '', '--candy-page': NIGHT_COLOURS?.page ?? '' }

function paint(): void {
  Object.entries(PAINTED).forEach(([name, value]) => document.documentElement.style.setProperty(name, value))
}

const pairRow = (label: string): HTMLElement => {
  const row = within(screen.getByRole('list', { name: PAIRS_HEADING })).getByText(label).closest('li')
  if (row === null) throw new Error(`No pair row for ${label}`)
  return row
}

beforeEach(() => {
  host.reset()
  host.setLooks({ look: NIGHTBLOOM })
})

afterEach(() => {
  Object.keys(PAINTED).forEach((name) => document.documentElement.style.removeProperty(name))
})

describe('the style sheet', () => {
  it('names the active look and links back to Your look', () => {
    render(<StyleSheet />)
    expect(screen.getByRole('heading', { level: 1, name: STYLE_HEADING })).toHaveAttribute('data-theme-heading')
    expect(screen.getByText(activeLookLine(NIGHTBLOOM.name))).toBeInTheDocument()
    expect(screen.getByRole('link', { name: BACK_TO_LOOK })).toHaveAttribute('href', '/looks')
  })

  it('shows its heading alone until the looks have loaded', () => {
    host.setLooks({ look: NIGHTBLOOM, loaded: false })
    const { container } = render(<StyleSheet />)
    expect(container.firstElementChild).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('region', { name: TYPE_HEADING })).not.toBeInTheDocument()
  })

  it('shows the type scale, never under 12 px', () => {
    render(<StyleSheet />)
    expect(within(screen.getByRole('region', { name: TYPE_HEADING })).getAllByRole('listitem')).toHaveLength(TYPE_SCALE.length)
    expect(Math.min(...TYPE_SCALE.map((entry) => entry.size))).toBeGreaterThanOrEqual(12)
  })

  it("shows Auto's twelve states as stills, each with its word", () => {
    const { container } = render(<StyleSheet />)
    const states = screen.getByRole('region', { name: STATES_HEADING })
    expect(within(states).getAllByRole('listitem')).toHaveLength(MASCOT_STATES.length)
    MASCOT_STATES.forEach((state) => expect(states).toHaveTextContent(stateWord(state)))
    const drawings = [...container.querySelectorAll('svg[data-state]')]
    expect(drawings.map((svg) => svg.getAttribute('data-state'))).toEqual([...MASCOT_STATES])
    drawings.forEach((svg) => {
      expect(svg).toHaveAttribute('aria-hidden', 'true')
      expect(svg).not.toHaveAttribute('data-moving')
    })
  })

  it('lists every design pair, not measured until the page is painted', () => {
    render(<StyleSheet />)
    expect(within(screen.getByRole('list', { name: PAIRS_HEADING })).getAllByRole('listitem')).toHaveLength(DESIGN_PAIRS.length)
    DESIGN_PAIRS.forEach((pair) => expect(pairRow(pair.label)).toHaveTextContent(NOT_MEASURED))
  })

  it('measures a pair from the colours painted on <html>, and again when the host repaints', async () => {
    render(<StyleSheet />)
    expect(pairRow('Text / page')).toHaveTextContent(NOT_MEASURED)
    await act(async () => paint())
    const ratio = contrastRatio(rgbOfHex(PAINTED['--candy-text']), rgbOfHex(PAINTED['--candy-page']))
    expect(pairRow('Text / page')).toHaveTextContent(`${ratio.toFixed(2)}:1`)
    expect(pairRow('Text / page')).toHaveTextContent(verdictOf(ratio, 4.5))
    expect(verdictOf(ratio, 4.5)).toMatch(/^✓/)
  })

  it('draws the three card gradients under Soft, Rich and Vivid, with the first paint’s own layers', () => {
    render(<StyleSheet />)
    const cards = screen.getByRole('region', { name: CARDS_HEADING })
    Object.values(GRADIENT_NOTES).forEach((note) => expect(cards).toHaveTextContent(note))
    expect(['Soft', 'Rich', 'Vivid'].every((word) => within(cards).getByText(word))).toBe(true)
    expect(CARD_LAYERS).toEqual(buildPrepaint().knobs.gradient)
  })
})
