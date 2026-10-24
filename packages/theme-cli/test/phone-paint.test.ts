/**
 * What Automatos Go paints for a theme's answer (src/phone/): Studio's colours as the app normalises them, and an
 * installed theme's painting laid over them as the app's src/styles/themes/paint.ts lays it, on made-up answers:
 *
 * - each of the 21 MOBILE_TOKEN_NAMES the Studio layout has a colour for lands under its Studio name as the
 *   #RRGGBB `parseColour` gives; the three it has none for are dropped; a value that is no colour is dropped and a
 *   token the theme leaves out keeps Studio's;
 * - a scheme without a ground and its text is not painted, and holds the other's; neither painted is no painting;
 * - the tone: null under tokens (the user's Light / Dark), the answer's under fromLooks;
 * - the thread's boxes mixed over the page, a token at an alpha, and Auto only for a state with a file.
 */
import { describe, expect, it } from 'vitest'
import { MOBILE_TOKEN_NAMES } from '../src/core/mobile-manifest.ts'
import type { MobileAnswer } from '../src/mobile-answer.ts'
import { parseColour } from '../src/mobile-paint.ts'
import {
  alphaHex, paintScheme, phonePaint, shownColours, sourceToHex, STUDIO_COLOURS, threadPaint, tint, tokenName,
  type StudioColourName,
} from '../src/phone/index.ts'

const DROPPED = ['--background-gradient-from', '--background-gradient-to', '--glass-border-hover']
const PAINTED = MOBILE_TOKEN_NAMES.filter((name) => !DROPPED.includes(name))

/** A distinct made-up grey per token (#010101 for the first, #020202 for the next), so no two tokens share one. */
function distinct(index: number): string {
  const byte = (index + 1).toString(16).padStart(2, '0')
  return `#${byte}${byte}${byte}`.toUpperCase()
}

const EVERY_TOKEN = Object.fromEntries(MOBILE_TOKEN_NAMES.map((name, index) => [name, distinct(index)]))
const PAPER = { '--background': '0 0% 100%', '--foreground': '210 16.67% 9.41%' }

function answer(changes: Partial<MobileAnswer> = {}): MobileAnswer {
  return {
    source: 'tokens', tone: null, tokens: { light: EVERY_TOKEN, dark: null }, fonts: {}, mascot: { mode: 'none', states: [] },
    ...changes,
  }
}

function painted(given: MobileAnswer) {
  const paint = phonePaint(given)
  if (paint === null) throw new Error('the answer paints')
  return paint
}

describe("Studio's colours", () => {
  it('are the source triplets as #RRGGBB, Dark cascading from Light, a wrapped alpha as #RRGGBBAA', () => {
    expect([STUDIO_COLOURS.light.background, STUDIO_COLOURS.dark.background]).toEqual([parseColour('38 50% 92%'), parseColour('30 12% 9%')])
    expect(STUDIO_COLOURS.dark.running).toBe(STUDIO_COLOURS.light.running)
    expect([STUDIO_COLOURS.light.accent2, sourceToHex('hsl(0 0% 100%)'), alphaHex(0.1)]).toEqual([`${parseColour('15 76% 44%')}1A`, '#FFFFFF', '1A'])
    expect([tokenName('--cc-hover-border'), tokenName('--chart-1')]).toEqual(['ccHoverBorder', 'chart1'])
  })
})

describe("a theme's painting over them", () => {
  it('puts every token the Studio layout has a colour for under its Studio name, and drops the other three', () => {
    const { colours } = painted(answer())
    PAINTED.forEach((name) => expect([name, colours.light[tokenName(name) as StudioColourName]]).toEqual([name, EVERY_TOKEN[name]]))
    DROPPED.forEach((name) => expect(Object.keys(colours.light)).not.toContain(tokenName(name)))
    expect([colours.light.olive, colours.light.chart1]).toEqual([STUDIO_COLOURS.light.olive, STUDIO_COLOURS.light.chart1])
  })

  it("keeps Studio's colour for a token left out or one that is no colour", () => {
    const { colours, themed } = painted(answer({ tokens: { light: { ...PAPER, '--card': 'red', '--primary': '#ABCDEF' }, dark: null } }))
    expect([colours.light.card, colours.light.primary, colours.light.border]).toEqual([STUDIO_COLOURS.light.card, '#ABCDEF', STUDIO_COLOURS.light.border])
    expect(themed.light).toEqual(['--background', '--foreground', '--primary'])
  })

  it("paints a scheme it leaves out with the other's, and nothing without a ground and its text", () => {
    const light = painted(answer({ tokens: { light: PAPER, dark: { '--background': '#000000' } } }))
    expect([light.colours.dark, light.themed.dark]).toEqual([light.colours.light, null])
    const dark = painted(answer({ tokens: { light: null, dark: PAPER } }))
    expect(dark.colours.light).toBe(dark.colours.dark)
    expect([phonePaint(answer({ tokens: { light: { '--background': '#000000' }, dark: null } })), phonePaint(null)]).toEqual([null, null])
  })

  it("follows the user's Light / Dark under tokens and holds the answer's tone under fromLooks", () => {
    const tokens = painted(answer({ tokens: { light: PAPER, dark: EVERY_TOKEN } }))
    expect([tokens.tone, paintScheme(tokens, 'dark'), shownColours(tokens, 'dark').background]).toEqual([null, 'dark', EVERY_TOKEN['--background']])
    const looks = painted(answer({ source: 'fromLooks', tone: 'dark', tokens: { light: null, dark: PAPER } }))
    expect([looks.tone, paintScheme(looks, 'light'), shownColours(null, 'dark')]).toEqual(['dark', 'dark', STUDIO_COLOURS.dark])
  })

  it('brings Auto only for clips or stills with a state that has a file', () => {
    const states = [{ name: 'hello', clip: null, still: '/assets/mascot/hello.png' }, { name: 'idle', clip: null, still: null }]
    expect(painted(answer({ mascot: { mode: 'stills', states } })).mascot).toEqual({ mode: 'stills', states: [states[0]] })
    expect(painted(answer({ mascot: { mode: 'clips', states: [states[1]] } })).mascot).toBeNull()
    expect(painted(answer()).mascot).toBeNull()
  })
})

describe("the thread's boxes and a token at an alpha", () => {
  it("mix the user's box from the page toward primary at 10 %, twice for its edge", () => {
    const colours = { ...STUDIO_COLOURS.light, background: '#FFFFFF', primary: '#000000' }
    expect(threadPaint(colours)).toEqual({
      autoFill: colours.card, autoBorder: colours.border, userFill: '#E6E6E6', userBorder: '#CFCFCF', avatar: colours.accent,
      sail: STUDIO_COLOURS.light.onStrong,
    })
  })

  it('write the alpha after the colour, multiplying one it has', () => {
    expect([tint('#C5461B', 0.1), tint('#C5461B80', 0.5)]).toEqual(['#C5461B1A', '#C5461B40'])
    expect(() => tint('red', 0.1)).toThrow(RangeError)
  })
})
