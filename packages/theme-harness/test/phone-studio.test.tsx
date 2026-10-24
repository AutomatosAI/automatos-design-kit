// The phone view draws Automatos Go's Studio layout from a theme's mobile block as the app's paint.ts puts the colours:
// a made-up theme gives every one of the block's 24 tokens a colour of its own, in Light and in Dark, and each part of
// the three screens (src/phone/parts.ts) shows, in each colour property it paints, the colour the paint gave it: the
// theme's for the 21 tokens the Studio layout has a colour for, Studio's for the rest, the thread's boxes mixed from
// them. The pressed and focused parts take their state's colours. The token panel says where each token lands (the
// three the layout has no colour for land nowhere, and seven are painted but drawn by none of these screens). A
// scheme switch repaints every part; a theme that leaves Dark out is drawn in Light's colours under Dark too. The
// theme's fonts are declared and set on their role's text, and a theme with no block is drawn in Studio's colours.
import { MOBILE_TOKEN_NAMES } from '@automatos/theme-cli/mobile'
import { phonePaint, STUDIO_COLOURS, threadPaint, tokenName, type StudioColours } from '@automatos/theme-cli/phone'
import { act, fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { NOTE_TEXT } from '../app/phone/contrast-panel.tsx'
import { STUDIO_REASONS } from '../app/phone/page.tsx'
import { DROPPED_TEXT, UNDRAWN_TEXT } from '../app/phone/token-panel.tsx'
import { host } from '../src/host.ts'
import { partPaint, STUDIO_PARTS, type PaintSlot, type PartState, type StudioPart } from '../src/phone/parts.ts'
import { PHONE_SCREENS, type PhoneScheme } from '../src/phone/settings.ts'
import { answerFor, phoneSourceOf } from '../src/phone/skin.ts'
import { cssColour, partsNamed, renderPhone, servedTheme, skinManifest, slotColour, type Json } from './phone-support.tsx'

/** A grey of its own for the n-th token (#010101, #020202, ...): no two tokens, and no two schemes, share one. */
const grey = (n: number): string => `#${n.toString(16).padStart(2, '0').repeat(3)}`.toUpperCase()
const LIGHT: Json = Object.fromEntries(MOBILE_TOKEN_NAMES.map((name, index) => [name, grey(index + 1)]))
const DARK: Json = Object.fromEntries(MOBILE_TOKEN_NAMES.map((name, index) => [name, grey(index + 0x80)]))
const DROPPED = ['--background-gradient-from', '--background-gradient-to', '--glass-border-hover']
const UNDRAWN = ['--card-foreground', '--popover', '--popover-foreground', '--secondary-foreground', '--muted', '--destructive-foreground', '--input']
const PARTS = Object.keys(STUDIO_PARTS) as StudioPart[]

function skinTheme(mobile: Json, assets: readonly string[] = [], changes: Json = {}) {
  const theme = servedTheme({ manifest: skinManifest(mobile, changes), presets: [], prepaint: null })
  const paint = phonePaint(answerFor(phoneSourceOf(theme, assets), null))
  return { theme, paint }
}

const EVERY = skinTheme({ tokens: { light: LIGHT, dark: DARK } })

function coloursOf(scheme: PhoneScheme): StudioColours {
  if (EVERY.paint === null) throw new Error('the made-up theme paints')
  return EVERY.paint.colours[scheme]
}

/** Each colour property of `element` is the one the part's paint gives it in `state`. */
function expectPainted(element: HTMLElement, part: StudioPart, colours: StudioColours, state: PartState = 'rest'): void {
  const painted = partPaint(part, colours, threadPaint(colours), state)
  Object.entries(painted).forEach(([slot, colour]) => {
    expect([part, slot, slotColour(element, slot as PaintSlot)]).toEqual([part, slot, cssColour(colour)])
  })
}

/** Every part on screen at rest, checked; the parts found. */
function checkRestingParts(colours: StudioColours): StudioPart[] {
  return PARTS.filter((part) => {
    const found = partsNamed(part).filter((element) => !element.hasAttribute('data-go-state'))
    found.forEach((element) => expectPainted(element, part, colours))
    return found.length > 0
  })
}

const schemeSwitch = (): HTMLElement => screen.getByLabelText(/^Light \/ Dark/)

beforeEach(() => {
  host.reset()
})

describe("every token lands where the app's paint puts it", () => {
  it("the paint holds each of the 21 tokens the Studio layout has a colour for under its Studio name, in each scheme", () => {
    const named = MOBILE_TOKEN_NAMES.filter((name) => !DROPPED.includes(name))
    named.forEach((name) => {
      const key = tokenName(name) as keyof StudioColours
      expect([name, coloursOf('light')[key], coloursOf('dark')[key]]).toEqual([name, LIGHT[name], DARK[name]])
    })
    expect(coloursOf('light').olive).toBe(STUDIO_COLOURS.light.olive)
  })

  it('every part of the three screens shows the colours its paint gives it, and every part is drawn', () => {
    const found = PHONE_SCREENS.flatMap((phoneScreen) => {
      const { unmount } = renderPhone(EVERY.theme, [], { screen: phoneScreen })
      const parts = checkRestingParts(coloursOf('light'))
      unmount()
      return parts
    })
    expect(new Set(found)).toEqual(new Set(PARTS))
  })

  it("a pressed card, button or pill takes the hover look, and the focused message box the ring", () => {
    renderPhone(EVERY.theme)
    const colours = coloursOf('light')
    const pressable: StudioPart[] = ['card', 'menuButton', 'ghostButton', 'attachButton']
    pressable.forEach((part) => {
      const [element] = partsNamed(part)
      fireEvent.pointerDown(element)
      expect(element).toHaveAttribute('data-go-state', 'pressed')
      expectPainted(element, part, colours, 'pressed')
      fireEvent.pointerUp(element)
      expectPainted(element, part, colours)
    })
    const [pill] = partsNamed('pillInput')
    act(() => pill.focus())
    expectPainted(pill, 'pillInput', colours, 'focused')
    expect(slotColour(pill, 'borderColor')).toBe(cssColour(String(LIGHT['--ring'])))
  })

  it('the token panel gives each token its painted colour and the parts it lands on', () => {
    renderPhone(EVERY.theme)
    MOBILE_TOKEN_NAMES.forEach((name) => {
      const row = document.querySelector<HTMLElement>(`[data-token="${name}"]`)
      const places = row?.querySelector('[data-places]')?.textContent
      if (DROPPED.includes(name)) expect([name, places]).toEqual([name, DROPPED_TEXT])
      else if (UNDRAWN.includes(name)) expect([name, places]).toEqual([name, UNDRAWN_TEXT])
      else expect([name, row?.querySelector('[data-value]')?.textContent, places === UNDRAWN_TEXT]).toEqual([name, LIGHT[name], false])
    })
  })
})

describe('the scheme on screen', () => {
  it('repaints every part with the dark scheme when Dark is chosen', () => {
    renderPhone(EVERY.theme)
    expect(document.querySelector('[data-go-scheme]')).toHaveAttribute('data-go-scheme', 'light')
    fireEvent.change(schemeSwitch(), { target: { value: 'dark' } })
    expect(document.querySelector('[data-go-scheme]')).toHaveAttribute('data-go-scheme', 'dark')
    expect(slotColour(partsNamed('screen')[0], 'backgroundColor')).toBe(cssColour(String(DARK['--background'])))
    expect(checkRestingParts(coloursOf('dark')).length).toBeGreaterThan(0)
  })

  it("draws a theme that leaves Dark out in Light's colours under Dark too, and the contrast panel says so", () => {
    const { theme } = skinTheme({ tokens: { light: LIGHT } })
    renderPhone(theme, [], { scheme: 'dark' })
    expect(document.querySelector('[data-go-scheme]')).toHaveAttribute('data-go-scheme', 'dark')
    expect(slotColour(partsNamed('headerBar')[0], 'backgroundColor')).toBe(cssColour(String(LIGHT['--secondary'])))
    expect(screen.getByRole('note')).toHaveTextContent(NOTE_TEXT['other-scheme'])
  })

  it("draws a theme with no mobile block in Studio's own colours, saying the phone offers it no painting", () => {
    const theme = servedTheme({ manifest: skinManifest(null), presets: [], prepaint: null })
    renderPhone(theme)
    expect(document.querySelector('[data-phone-mode]')).toHaveAttribute('data-phone-mode', 'studio')
    expect(screen.getByText(STUDIO_REASONS['no-block'])).toBeInTheDocument()
    expect(checkRestingParts(STUDIO_COLOURS.light).length).toBeGreaterThan(0)
  })
})

describe("the theme's fonts", () => {
  const FONT = 'assets/fonts/mobile/Brand.ttf'
  const block = { tokens: { light: LIGHT }, fonts: { sans: FONT } }

  it('are declared under their role and set on the text of that role only', () => {
    renderPhone(skinTheme(block).theme, [FONT])
    const css = Array.from(document.querySelectorAll('style'), (style) => style.textContent ?? '').join('\n')
    expect(css).toContain(`@font-face { font-family: 'go-theme-sans'; src: url("/${FONT}")`)
    expect(screen.getByText('Auto is an AI').style.fontFamily).toMatch(/go-theme-sans/)
    expect(screen.getByText('automatos').style.fontFamily).not.toMatch(/go-theme/)
  })

  it("leave Studio's faces when the file is not in the theme", () => {
    renderPhone(skinTheme(block).theme, [])
    expect(screen.getByText('Auto is an AI').style.fontFamily).not.toMatch(/go-theme/)
  })
})
