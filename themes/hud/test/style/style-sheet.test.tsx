// The style sheet (styleSheet@1) on the harness's look runtime: its heading carries the host's focus mark; it names
// the active look and shows what that look paints (each knob with its variable, HUD's colours and Studio's tokens with
// their values, rounded to three places and wrapping only after a comma, a chip drawn in each variable, the live
// contrast with a verdict in words), and it redraws as soon as the look changes anywhere in the app. Until the looks are read it is its heading alone, busy.
import { renderToString } from 'react-dom/server'
import { act, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { ACCENTS, FONTS } from '../../src/lib/looks/catalogue.ts'
import { ARC, FORGE, NOVA, PRESETS } from '../../src/lib/looks/presets.ts'
import { lookToCssVars } from '../../src/lib/looks/vars.ts'
import { AA_PASS, COLOURS_TITLE, CONTRAST_TITLE, KNOBS_TITLE, STUDIO_TITLE } from '../../src/style/style-sections.tsx'
import { BACK_TO_LOOK, STYLE_TITLE, activeLookLine } from '../../src/style/style-screen.tsx'
import { displayDetail, STATUS_SAMPLES, TYPE_TITLE } from '../../src/style/style-specimens.tsx'
import { CONTRAST_PAIRS, displayValue, glowWords } from '../../src/style/tokens.ts'
import { mountLooks, pick, renderSheet, sheetTree, startLooksTest, withProbe } from '../looks/looks-harness.tsx'

const region = (name: string) => within(screen.getByRole('region', { name }))
const heading = () => screen.getByRole('heading', { level: 1, name: STYLE_TITLE })

/** A swatch's list item, by the variable it names. */
function swatch(section: string, name: string): HTMLElement {
  const item = region(section).getByText(name, { selector: 'code' }).closest('li')
  if (!item) throw new Error(`no swatch for ${name}`)
  return item
}

function chipOf(item: HTMLElement): string {
  const chip = item.firstElementChild
  if (!(chip instanceof HTMLElement)) throw new Error('a swatch with no chip')
  return chip.style.getPropertyValue('--hud-swatch')
}

/** A row of the knob table, by its knob's label. */
function knobRow(label: string): HTMLElement {
  const row = region(KNOBS_TITLE).getByRole('rowheader', { name: label }).closest('tr')
  if (!row) throw new Error(`no row for ${label}`)
  return row
}

beforeEach(() => {
  startLooksTest()
})

describe('the style sheet', () => {
  it('has a heading the host can hand the focus to, names the active look and links back to the look', () => {
    renderSheet()
    expect(heading()).toHaveAttribute('data-theme-heading', 'true')
    expect(heading()).toHaveAttribute('tabindex', '-1')
    expect(screen.getByText(activeLookLine(ARC.name))).toBeInTheDocument()
    expect(screen.getByRole('link', { name: BACK_TO_LOOK })).toHaveAttribute('href', '/looks')
    for (const name of [KNOBS_TITLE, COLOURS_TITLE, STUDIO_TITLE, CONTRAST_TITLE, TYPE_TITLE]) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument()
    }
  })

  it('shows each knob with its choice and the variable it paints', () => {
    renderSheet()
    const vars = lookToCssVars(ARC)
    expect(knobRow('Accent')).toHaveTextContent(ACCENTS.arc.name)
    expect(within(knobRow('Accent')).getByText('--hud-accent')).toBeInTheDocument()
    expect(within(knobRow('Accent')).getByText(ACCENTS.arc.hex)).toBeInTheDocument()
    expect(knobRow('Type')).toHaveTextContent(FONTS.raj.face)
    expect(within(knobRow('Grid')).getByText(displayValue(vars['--hud-grid'] ?? ''))).toBeInTheDocument()
    expect(knobRow('Motion')).toHaveTextContent('On')
  })

  it('shows a painted value rounded to three places, free to wrap after each comma and never inside a number', () => {
    renderSheet()
    const grid = within(knobRow('Grid')).getByText('rgba(63,224,255,0.047)')
    expect(grid.tagName).toBe('CODE')
    expect(grid.querySelectorAll('wbr')).toHaveLength(3)
    expect(Array.from(grid.childNodes, (node) => node.textContent).join('')).toBe('rgba(63,224,255,0.047)')
  })

  it("shows HUD's colours and Studio's tokens with the values the look paints, each chip drawn in its variable", () => {
    renderSheet()
    const vars = lookToCssVars(ARC)
    const accent = swatch(COLOURS_TITLE, '--hud-accent')
    expect(accent).toHaveTextContent(ACCENTS.arc.hex)
    expect(chipOf(accent)).toBe('var(--hud-accent)')
    const background = swatch(STUDIO_TITLE, '--background')
    expect(background).toHaveTextContent(vars['--background'] ?? '')
    expect(chipOf(background)).toBe('hsl(var(--background))')
  })

  it('redraws as soon as the look changes anywhere in the app', () => {
    renderSheet([FORGE, NOVA])
    pick(FORGE)
    expect(screen.getByText(activeLookLine(FORGE.name))).toBeInTheDocument()
    expect(swatch(COLOURS_TITLE, '--hud-accent')).toHaveTextContent(ACCENTS.forge.hex)
    expect(region(TYPE_TITLE).getByText(displayDetail(FORGE))).toBeInTheDocument()
    pick(NOVA)
    expect(swatch(COLOURS_TITLE, '--hud-bg')).toHaveTextContent(lookToCssVars(NOVA)['--hud-bg'] ?? '')
    expect(knobRow('Glow')).toHaveTextContent(glowWords(NOVA))
  })

  it.each(PRESETS)('measures $name live: every pair of HUD\'s own colours at AA, said in words', (look) => {
    renderSheet([], { look })
    const rows = within(region(CONTRAST_TITLE).getByRole('table')).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(CONTRAST_PAIRS.length)
    expect(rows.filter((row) => !row.textContent?.includes(AA_PASS)).map((row) => row.textContent)).toEqual([])
    expect(rows.every((row) => /\d+\.\d{2}:1/.test(row.textContent ?? ''))).toBe(true)
  })

  it('names every status with a word beside its glyph', () => {
    renderSheet()
    const words = within(screen.getByRole('list', { name: 'Status words' })).getAllByRole('listitem').map((item) => item.textContent)
    expect(words).toEqual(STATUS_SAMPLES.map(([glyph, word]) => `${glyph} ${word}`))
  })
})

describe('the style sheet before the looks are read', () => {
  it('renders on the server as a busy page with its heading alone', () => {
    mountLooks({ loaded: false })
    const html = renderToString(withProbe(sheetTree()))
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain(STYLE_TITLE)
    expect(html).not.toContain(COLOURS_TITLE)
  })

  it('shows the look once it is read', () => {
    renderSheet([], { loaded: false })
    expect(heading().closest('[aria-busy]')).not.toBeNull()
    expect(screen.queryByRole('region', { name: COLOURS_TITLE })).toBeNull()
    act(() => mountLooks({ look: NOVA }))
    expect(heading().closest('[aria-busy]')).toBeNull()
    expect(screen.getByText(activeLookLine(NOVA.name))).toBeInTheDocument()
  })
})
