// A theme whose phone painting comes from its looks (`fromLooks`, made-up data): the phone view paints the member's
// look through the server's paint (theme-cli's mobile-paint paintLook, the port of mobile_tokens.py paint_look) and
// the tone it gives (lookTone), so the look switch repaints the screen: the default look first, another preset, or no
// stored look (the table's defaults). The look sets Light / Dark, so the scheme switch is off. The contrast panel
// follows the look, and a look that paints no ground or text is measured as it is while the phone gets the defaults.
import { paintLook, parseColour } from '@automatos/theme-cli/mobile-paint'
import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { NOTE_TEXT } from '../app/phone/contrast-panel.tsx'
import { NO_STORED_LOOK_NAME } from '../app/phone/controls.tsx'
import { host } from '../src/host.ts'
import { NO_STORED_LOOK } from '../src/phone/settings.ts'
import { cssColour, partsNamed, renderPhone, servedTheme, skinManifest, slotColour } from './phone-support.tsx'

const WHITE = '0 0% 100%'
const INK = '210 16.67% 9.41%'
const DARK_GROUND = '220 13% 9%'
const DARK_TEXT = '210 20% 96%'
const BLUE = '221.21 83.19% 53.33%'
const TABLE = {
  knobs: {
    ground: {
      paper: { '--background': WHITE, '--foreground': INK, '--card': '0 0% 98%' },
      ink: { '--background': DARK_GROUND, '--foreground': DARK_TEXT, '--card': '220 13% 14%' },
      bare: { '--foreground': INK },
    },
    accent: { blue: { '--primary': BLUE, '--primary-foreground': WHITE } },
  },
  pairs: [],
  numeric: [],
  defaults: { ground: 'paper', accent: 'blue' },
  tone: { knob: 'ground', values: { paper: 'light', ink: 'dark', bare: 'light' } },
}
const look = (id: string, ground: string) => ({ schema: 'sample-look/v1', id, name: `Look ${id}`, sub: ground, ground, accent: 'blue' })
const DAY = look('day', 'paper')
const NIGHT = look('night', 'ink')
const BARE = look('plain', 'bare')
const THEME = servedTheme({
  manifest: skinManifest({ fromLooks: true }, { tone: 'from-look', look: 'night' }),
  presets: [DAY, NIGHT, BARE],
  prepaint: TABLE,
})

const lookSwitch = (): HTMLElement => screen.getByLabelText(/^Look/)
const scheme = (): string | null => document.querySelector('[data-go-scheme]')?.getAttribute('data-go-scheme') ?? null
/** The colour the phone's screen and its cards are painted, as the DOM writes them back. */
const ground = (): string => slotColour(partsNamed('screen')[0], 'backgroundColor')
const card = (): string => slotColour(partsNamed('card')[0], 'backgroundColor')

/** The colour the server's paint gives a token for a look, as the DOM writes it. */
function painted(given: unknown, token: string): string {
  return cssColour(String(parseColour(paintLook(TABLE, given)[token])))
}

beforeEach(() => {
  host.reset()
})

describe('a painting from the looks', () => {
  it("paints the theme's default look first, in the tone it gives, with Light / Dark off", () => {
    renderPhone(THEME)
    expect([scheme(), ground(), card()]).toEqual(['dark', painted(NIGHT, '--background'), painted(NIGHT, '--card')])
    expect(lookSwitch()).toHaveValue('night')
    expect(screen.getByLabelText(/^Light \/ Dark/)).toBeDisabled()
  })

  it('repaints the screen for another preset, and for no stored look (the defaults)', () => {
    renderPhone(THEME)
    fireEvent.change(lookSwitch(), { target: { value: 'day' } })
    expect([scheme(), ground(), card()]).toEqual(['light', painted(DAY, '--background'), painted(DAY, '--card')])
    expect(screen.getByRole('option', { name: NO_STORED_LOOK_NAME })).toBeInTheDocument()
    fireEvent.change(lookSwitch(), { target: { value: NO_STORED_LOOK } })
    expect([scheme(), ground()]).toEqual(['light', painted(null, '--background')])
  })

  it('measures the look on screen in the contrast panel', () => {
    renderPhone(THEME)
    expect(screen.getByRole('table', { name: 'The pairs of Preset "night"' })).toBeInTheDocument()
    fireEvent.change(lookSwitch(), { target: { value: 'day' } })
    expect(screen.getByRole('table', { name: 'The pairs of Preset "day"' })).toBeInTheDocument()
  })

  it("paints the defaults for a look that paints no ground, and the panel fails that look as the review does", () => {
    renderPhone(THEME, [], { look: 'plain' })
    expect([scheme(), ground()]).toEqual(['light', painted(null, '--background')])
    expect(screen.getByRole('note')).toHaveTextContent(NOTE_TEXT['defaults-sent'])
    expect(document.querySelector('[data-outcome]')).toHaveAttribute('data-outcome', 'fail')
  })
})
