// The skin designer beside the phone view (app/phone/designer/), on made-up themes. Each token's control repaints
// exactly the parts of the Studio layout that read that token at rest (src/phone/parts.ts: the thread's boxes made from
// it included), on each of the three screens; the colour picker repaints too, and a value the validator would refuse
// is marked and not used. The scheme switch moves the controls to the scheme on screen: Dark's own colours, or Light's
// when the draft has no Dark (which the phone then draws under Dark), and the schemes control gives Dark its own or
// takes them away. A theme with no block starts a draft from Studio's colours or from a look's tokens (in the scheme of
// the look's tone) and can paint from the looks instead. The contrast panel follows each change, marks a failing pair
// and fixes it in one click with its nearest passing value, at or over its minimum.
import { MOBILE_AA_TEXT, MOBILE_TOKEN_NAMES } from '@automatos/theme-cli/mobile'
import { measurePair } from '@automatos/theme-cli/mobile-contrast'
import { paintLook, parseColour } from '@automatos/theme-cli/mobile-paint'
import { STUDIO_COLOURS, STUDIO_LIGHT_SOURCE, tokenName, type StudioColourName } from '@automatos/theme-cli/phone'
import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { SCHEME_CHOICES, SOURCE_NAMES } from '../app/phone/designer/designer.tsx'
import { START_LOOK, START_LOOK_LABEL, START_STUDIO } from '../app/phone/designer/start.tsx'
import { borrowedText, INVALID_TEXT, pickerLabel, valueLabel } from '../app/phone/designer/token-fields.tsx'
import { host } from '../src/host.ts'
import { STUDIO_PARTS, tokensOfPaint, type PaintSlot, type Paints, type StudioPart } from '../src/phone/parts.ts'
import { PHONE_SCREENS, type PhoneScreen } from '../src/phone/settings.ts'
import { cssColour, partsNamed, renderPhone, servedTheme, skinManifest, slotColour, type Json } from './phone-support.tsx'

type Scheme = Readonly<Record<string, string>>

/** A grey of its own for the n-th token (#010101, #020202, ...), as the phone view's own tests give every token. */
const grey = (n: number): string => `#${n.toString(16).padStart(2, '0').repeat(3)}`.toUpperCase()
const LIGHT: Scheme = Object.fromEntries(MOBILE_TOKEN_NAMES.map((name, index) => [name, grey(index + 1)]))
const DARK: Scheme = Object.fromEntries(MOBILE_TOKEN_NAMES.map((name, index) => [name, grey(index + 0x80)]))
/** A colour of its own for the n-th token, no grey: what each control sets. */
const fresh = (n: number): string => `#c0${n.toString(16).padStart(2, '0')}3a`
const SLOTS: readonly PaintSlot[] = ['backgroundColor', 'borderColor', 'borderTopColor', 'borderBottomColor', 'color']
const PARTS = Object.keys(STUDIO_PARTS) as StudioPart[]
const WHITE = '0 0% 100%'
const INK = '210 16.67% 9.41%'
const DARK_GROUND = '220 13% 9%'
const PER_SCREEN_TIMEOUT = 30_000

function theme(mobile: Json | null) {
  return servedTheme({ manifest: skinManifest(mobile), presets: [], prepaint: null })
}

const EVERY = theme({ tokens: { light: LIGHT, dark: DARK } })

/** The parts that read a Studio colour at rest: their own paints, the thread's boxes made from it among them. */
function restReaders(name: string): StudioPart[] {
  return PARTS.filter((part) => {
    const paints: Paints = STUDIO_PARTS[part].paints
    return Object.values(paints).some((ref) => ref !== undefined && tokensOfPaint(ref).includes(name as StudioColourName))
  })
}

/** Each part on screen with its colour in each slot, as the DOM writes them. */
function partColours(): [StudioPart, string][] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-go-part]'), (element) => (
    [element.getAttribute('data-go-part') as StudioPart, SLOTS.map((slot) => slotColour(element, slot)).join(' ')]
  ))
}

/** The parts whose colours changed between two readings of one screen. */
function changedParts(before: readonly [StudioPart, string][], after: readonly [StudioPart, string][]): StudioPart[] {
  const changed = before.filter(([, colours], index) => colours !== after[index][1]).map(([part]) => part)
  return Array.from(new Set(changed)).sort()
}

const setValue = (token: string, value: string): void => {
  fireEvent.change(screen.getByLabelText(valueLabel(token)), { target: { value } })
}
const schemeSwitch = (): HTMLElement => screen.getByLabelText(/^Light \/ Dark/)
const editing = (): string | null => document.querySelector('[data-skin-scheme]')?.getAttribute('data-skin-scheme') ?? null
const partColour = (part: StudioPart, slot: PaintSlot = 'backgroundColor'): string => slotColour(partsNamed(part)[0], slot)
const pairRow = (pair: string): HTMLTableRowElement | null => document.querySelector<HTMLTableRowElement>(`tr[data-pair="${pair}"]`)

beforeEach(() => {
  host.reset()
})

describe("each token's control", () => {
  it.each<PhoneScreen>([...PHONE_SCREENS])('repaints exactly the parts that read the token at rest, on %s', (phoneScreen) => {
    renderPhone(EVERY, [], { screen: phoneScreen })
    const drawn = new Set(partColours().map(([part]) => part))
    MOBILE_TOKEN_NAMES.forEach((token, index) => {
      const before = partColours()
      setValue(token, fresh(index))
      const expected = restReaders(tokenName(token)).filter((part) => drawn.has(part)).sort()
      expect([token, changedParts(before, partColours())]).toEqual([token, expected])
    })
    expect(partColour('screen')).toBe(cssColour(fresh(0)))
  }, PER_SCREEN_TIMEOUT)

  it('takes a #rrggbb from its picker, shows it in the text field and repaints with it', () => {
    renderPhone(EVERY)
    fireEvent.change(screen.getByLabelText(pickerLabel('--primary')), { target: { value: '#aa3311' } })
    expect(screen.getByLabelText(valueLabel('--primary'))).toHaveValue('#aa3311')
    expect(partColour('sendButton')).toBe(cssColour('#aa3311'))
  })

  it("marks a value the validator would refuse and keeps the last colour it took; an empty field leaves Studio's", () => {
    renderPhone(EVERY)
    const field = screen.getByLabelText(valueLabel('--primary'))
    fireEvent.change(field, { target: { value: 'hsl(0 0% 50%)' } })
    expect([field.getAttribute('aria-invalid'), partColour('sendButton')]).toEqual(['true', cssColour(LIGHT['--primary'])])
    expect(screen.getByText(INVALID_TEXT)).toBeInTheDocument()
    fireEvent.change(field, { target: { value: '0 0% 101%' } })
    expect(partColour('sendButton')).toBe(cssColour(LIGHT['--primary']))
    fireEvent.change(field, { target: { value: '200 50% 40%' } })
    expect([field.getAttribute('aria-invalid'), partColour('sendButton')]).toEqual(['false', cssColour(String(parseColour('200 50% 40%')))])
    fireEvent.change(field, { target: { value: '' } })
    expect(partColour('sendButton')).toBe(cssColour(STUDIO_COLOURS.light.primary))
  })
})

describe('the scheme on screen', () => {
  it("moves the controls to Dark's own colours, which repaint Dark alone", () => {
    renderPhone(EVERY)
    expect(editing()).toBe('light')
    fireEvent.change(schemeSwitch(), { target: { value: 'dark' } })
    expect(editing()).toBe('dark')
    expect(screen.getByLabelText(valueLabel('--background'))).toHaveValue(DARK['--background'])
    setValue('--background', '#203040')
    expect(partColour('screen')).toBe(cssColour('#203040'))
    fireEvent.change(schemeSwitch(), { target: { value: 'light' } })
    expect([editing(), partColour('screen')]).toEqual(['light', cssColour(LIGHT['--background'])])
    expect(screen.getByLabelText(valueLabel('--background'))).toHaveValue(LIGHT['--background'])
  })

  it("edits Light's colours under Dark for a draft with no Dark, and gives Dark its own or takes them away", () => {
    renderPhone(theme({ tokens: { light: LIGHT } }), [], { scheme: 'dark' })
    expect(editing()).toBe('light')
    expect(screen.getByText(borrowedText('light', 'dark'))).toBeInTheDocument()
    setValue('--background', '#203040')
    expect(partColour('screen')).toBe(cssColour('#203040'))
    fireEvent.click(screen.getByLabelText(SCHEME_CHOICES.both))
    expect([editing(), partColour('screen')]).toEqual(['dark', cssColour(STUDIO_COLOURS.dark.background)])
    fireEvent.click(screen.getByLabelText(SCHEME_CHOICES.light))
    expect([editing(), partColour('screen')]).toEqual(['light', cssColour('#203040')])
  })
})

describe('a theme with no mobile block', () => {
  const TABLE = {
    knobs: {
      ground: {
        paper: { '--background': WHITE, '--foreground': INK, '--card': '0 0% 98%' },
        ink: { '--background': DARK_GROUND, '--foreground': '210 20% 96%', '--card': '220 13% 14%' },
        bare: { '--foreground': INK },
      },
      accent: { blue: { '--primary': '221.21 83.19% 53.33%', '--primary-foreground': WHITE } },
    },
    pairs: [],
    numeric: [],
    defaults: { ground: 'paper', accent: 'blue' },
    tone: { knob: 'ground', values: { paper: 'light', ink: 'dark', bare: 'light' } },
  }
  const look = (id: string, ground: string) => ({ schema: 'sample-look/v1', id, name: `Look ${id}`, sub: ground, ground, accent: 'blue' })
  const NIGHT = look('night', 'ink')

  it("starts a draft from Studio's own colours, which the phone then paints", () => {
    renderPhone(theme(null))
    expect(document.querySelector('[data-phone-mode]')).toHaveAttribute('data-phone-mode', 'studio')
    expect(screen.queryByLabelText(valueLabel('--background'))).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: START_STUDIO }))
    expect(document.querySelector('[data-phone-mode]')).toHaveAttribute('data-phone-mode', 'skin')
    expect(screen.getByLabelText(valueLabel('--muted-foreground'))).toHaveValue(STUDIO_LIGHT_SOURCE['--muted-foreground'])
    expect(partColour('screen')).toBe(cssColour(STUDIO_COLOURS.light.background))
  })

  it("starts one from a look's tokens, in the scheme of its tone, and paints from the looks on request", () => {
    const manifest = skinManifest(null, { tone: 'from-look', look: 'night' })
    renderPhone(servedTheme({ manifest, presets: [look('day', 'paper'), NIGHT, look('plain', 'bare')], prepaint: TABLE }))
    expect(screen.getByLabelText(START_LOOK_LABEL)).toHaveValue('night')
    fireEvent.click(screen.getByRole('button', { name: START_LOOK }))
    fireEvent.change(schemeSwitch(), { target: { value: 'dark' } })
    expect(screen.getByLabelText(valueLabel('--background'))).toHaveValue(DARK_GROUND)
    expect(partColour('screen')).toBe(cssColour(String(parseColour(paintLook(TABLE, NIGHT)['--background']))))
    fireEvent.change(screen.getByLabelText(START_LOOK_LABEL), { target: { value: 'day' } })
    fireEvent.click(screen.getByRole('button', { name: START_LOOK }))
    fireEvent.change(schemeSwitch(), { target: { value: 'light' } })
    expect(screen.getByLabelText(valueLabel('--card'))).toHaveValue('0 0% 98%')
    fireEvent.change(screen.getByLabelText(START_LOOK_LABEL), { target: { value: 'plain' } })
    expect(screen.getByRole('button', { name: START_LOOK })).toBeDisabled()
    fireEvent.click(screen.getByLabelText(SOURCE_NAMES.fromLooks))
    expect(editing()).toBeNull()
    expect(screen.getByLabelText(/^Look/)).toHaveValue('night')
    expect(document.querySelector('[data-phone-notice]')).toHaveTextContent('(fromLooks)')
  })
})

describe('the contrast panel', () => {
  const PAIR = '--foreground on --background'

  it('follows each change, marks a failing pair and fixes it in one click, at or over its minimum', () => {
    renderPhone(theme({ tokens: { light: { '--background': WHITE, '--foreground': INK } } }))
    expect(pairRow(PAIR)).toHaveAttribute('data-status', 'pass')
    setValue('--foreground', '0 0% 60%')
    expect(pairRow(PAIR)).toHaveAttribute('data-status', 'fail')
    expect(document.querySelector('[data-outcome]')).toHaveAttribute('data-outcome', 'fail')
    const fix = screen.getByRole('button', { name: /^Nearest passing for --foreground on --background: / })
    const value = (fix.getAttribute('aria-label') ?? '').split(': ').at(-1) ?? ''
    fireEvent.click(fix)
    expect(pairRow(PAIR)).toHaveAttribute('data-status', 'pass')
    expect(Number.parseFloat(pairRow(PAIR)?.cells[1].textContent ?? '0')).toBeGreaterThanOrEqual(MOBILE_AA_TEXT)
    expect(screen.getByLabelText(valueLabel('--foreground'))).toHaveValue(value)
    expect(measurePair({ '--background': WHITE, '--foreground': value }, ['--foreground', '--background', 'text']).status).toBe('pass')
    expect(screen.queryByRole('button', { name: /^Nearest passing for --foreground/ })).toBeNull()
  })

  it("fixes Studio Light's own muted text once a draft starts from Studio's colours", () => {
    renderPhone(theme(null))
    fireEvent.click(screen.getByRole('button', { name: START_STUDIO }))
    expect(pairRow('--muted-foreground on --muted')).toHaveAttribute('data-status', 'fail')
    fireEvent.click(screen.getByRole('button', { name: /^Nearest passing for --muted-foreground on --muted: / }))
    expect(pairRow('--muted-foreground on --muted')).toHaveAttribute('data-status', 'pass')
  })
})
