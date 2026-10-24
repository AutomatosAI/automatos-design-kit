/**
 * The answer a phone gets for a theme (src/mobile-answer.ts, core's mobile.py `_mobile_block` with no database)
 * and the tone it paints a look in (src/mobile-paint.ts `lookTone`, mobile_tokens.py `look_tone`), on made-up
 * themes:
 *
 * - the tone: theme.json's fixed light or dark first; under from-look the table's tone rule at the painted look's
 *   choice (a rule that misses a choice, or names a numeric rule's knob, is no rule); else the painted ground's,
 *   and light with no table;
 * - `tokens`: the block's schemes as written and tone null; `fromLooks`: the look painted under its tone, the
 *   other scheme null, the defaults for no look or a look that paints no ground, and no answer for no table;
 * - fonts and Auto's files: a URL only for a file the theme holds, never for code; stills give no clip, none
 *   gives no states.
 */
import { describe, expect, it } from 'vitest'
import { mobileAnswer, type AnswerFiles, type MobileAnswer } from '../src/mobile-answer.ts'
import {
  bootTable, bootTone, groundTone, lookTone, paintLook, parseColour, type BootRule, type BootTable,
} from '../src/mobile-paint.ts'

type Json = Readonly<Record<string, unknown>>

const WHITE = '0 0% 100%'
const INK = '210 16.67% 9.41%'
const DARK_GROUND = '220 13% 9%'
const DARK_TEXT = '210 20% 96%'
const BLUE = '221.21 83.19% 53.33%'
const PAPER = { '--background': WHITE, '--foreground': INK }
const NIGHT = { '--background': DARK_GROUND, '--foreground': DARK_TEXT }
const RULE = { knob: 'ground', values: { paper: 'light', ink: 'dark' } }
/** A ground with no --background: a look on it paints no ground for a phone. */
const BARE = { '--foreground': INK }
const TABLE = {
  knobs: { ground: { paper: PAPER, ink: NIGHT, bare: BARE }, accent: { blue: { '--primary': BLUE, '--primary-foreground': WHITE } } },
  defaults: { ground: 'paper', accent: 'blue' },
  tone: { ...RULE, values: { ...RULE.values, bare: 'light' } },
}
const INK_LOOK = { id: 'night', ground: 'ink', accent: 'blue' }
const PAPER_LOOK = { id: 'day', ground: 'paper', accent: 'blue' }
const FILES_ROUTE = '/files/'

function files(held: readonly string[] = [], prepaint: unknown = TABLE): AnswerFiles {
  return { prepaint, has: (path) => held.includes(path), url: (path) => `${FILES_ROUTE}${path}` }
}

function answered(manifest: Json, given: AnswerFiles = files(), look: unknown = null): MobileAnswer {
  const answer = mobileAnswer(manifest, given, look)
  if (answer === null) throw new Error('the theme paints, so it has an answer')
  return answer
}

const FROM_LOOKS = { tone: 'from-look', mobile: { fromLooks: true } }

describe('the tone a look is painted in', () => {
  it("is theme.json's own light or dark first, whatever the look", () => {
    expect([lookTone(TABLE, INK_LOOK, 'light'), lookTone(TABLE, PAPER_LOOK, 'dark')]).toEqual(['light', 'dark'])
  })

  it("is the tone rule's choice under from-look, and the defaults' for a look that does not fit", () => {
    expect([lookTone(TABLE, INK_LOOK, 'from-look'), lookTone(TABLE, PAPER_LOOK, 'from-look')]).toEqual(['dark', 'light'])
    expect(lookTone(TABLE, { ground: 'dusk', accent: 'blue' }, 'from-look')).toBe('light')
  })

  it('is the painted ground under the user policy, or with no whole rule', () => {
    const inverted = { ...TABLE, tone: { knob: 'ground', values: { paper: 'dark', ink: 'light', bare: 'dark' } } }
    expect([lookTone(inverted, INK_LOOK, 'user'), lookTone(inverted, INK_LOOK, 'from-look')]).toEqual(['dark', 'light'])
    const partial = { ...TABLE, tone: RULE }
    expect([bootTone(RULE, kept(partial)), lookTone(partial, INK_LOOK, 'from-look')]).toEqual([null, 'dark'])
  })

  it("keeps no rule for a knob the table lacks or a numeric rule's knob", () => {
    const glow: BootRule = {
      var: '--glow', knob: 'ground', min: 0, max: 1, integer: false, scale: 1, capTable: null, caps: {},
      color: { knob: 'accent', rgb: { blue: '0,0,255' } },
    }
    expect(bootTone({ knob: 'shape', values: {} }, kept(TABLE))).toBeNull()
    expect(bootTone(TABLE.tone, { ...kept(TABLE), numeric: [glow] })).toBeNull()
    expect(bootTone(TABLE.tone, kept(TABLE))).toEqual({ knob: 'ground', values: { paper: 'light', ink: 'dark', bare: 'light' } })
  })

  it('is light with no table, and for a ground or text that is missing', () => {
    expect([lookTone(null, null, 'from-look'), groundTone({ '--background': DARK_GROUND }), groundTone(null)]).toEqual(['light', 'light', 'light'])
    expect([groundTone(NIGHT), groundTone(PAPER)]).toEqual(['dark', 'light'])
  })
})

describe("a tokens block's answer", () => {
  it('is its schemes as written, tone null, a scheme it leaves out null', () => {
    const light = { ...PAPER, '--card': '#FAFAFA' }
    const answer = answered({ mobile: { tokens: { light } } })
    expect(answer).toEqual({
      source: 'tokens', tone: null, tokens: { light, dark: null }, fonts: {}, mascot: { mode: 'none', states: [] },
    })
  })

  it('is none for a theme.json without the block, or a block with no source', () => {
    expect([mobileAnswer({}, files()), mobileAnswer({ mobile: { mascot: 'none' } }, files())]).toEqual([null, null])
  })
})

describe("a fromLooks block's answer", () => {
  it('paints the look under its tone, the other scheme null', () => {
    const answer = answered(FROM_LOOKS, files(), INK_LOOK)
    expect([answer.source, answer.tone, answer.tokens.light]).toEqual(['fromLooks', 'dark', null])
    expect(answer.tokens.dark).toEqual(paintLook(TABLE, INK_LOOK))
    expect(parseColour(answer.tokens.dark?.['--background'])).toBe(parseColour(DARK_GROUND))
  })

  it('paints the defaults for no look, and for a look that paints no ground', () => {
    const defaults = paintLook(TABLE, null)
    expect(answered(FROM_LOOKS).tokens).toEqual({ light: defaults, dark: null })
    expect(answered(FROM_LOOKS, files(), { ground: 'bare', accent: 'blue' }).tokens).toEqual({ light: defaults, dark: null })
  })

  it("takes theme.json's fixed tone over the rule", () => {
    expect(answered({ ...FROM_LOOKS, tone: 'light' }, files(), INK_LOOK).tokens.light).toEqual(paintLook(TABLE, INK_LOOK))
  })

  it('is none with no table, or defaults that paint no ground', () => {
    const bareDefaults = { ...TABLE, defaults: { ground: 'bare', accent: 'blue' } }
    expect([mobileAnswer(FROM_LOOKS, files([], null)), mobileAnswer(FROM_LOOKS, files([], bareDefaults))]).toEqual([null, null])
  })
})

describe("the answer's files", () => {
  const STATES = ['hello', 'idle']
  const held = ['assets/fonts/mobile/Brand.ttf', 'assets/mascot/hello.mp4', 'assets/mascot/hello.png', 'assets/mascot/idle.png']
  const block = (mascot: string): Json => ({
    mascot: { states: STATES },
    mobile: { tokens: { light: PAPER }, mascot, fonts: { sans: 'assets/fonts/mobile/Brand.ttf', mono: 'assets/fonts/mobile/Gone.ttf' } },
  })

  it('give a font for each role whose file the theme holds', () => {
    expect(answered(block('none'), files(held)).fonts).toEqual({ sans: `${FILES_ROUTE}assets/fonts/mobile/Brand.ttf` })
  })

  it("give each state's clip and still under clips, a still alone under stills, nothing under none", () => {
    const url = (name: string): string => `${FILES_ROUTE}assets/mascot/${name}`
    expect(answered(block('clips'), files(held)).mascot).toEqual({
      mode: 'clips', states: [{ name: 'hello', clip: url('hello.mp4'), still: url('hello.png') }, { name: 'idle', clip: null, still: url('idle.png') }],
    })
    expect(answered(block('stills'), files(held)).mascot.states.map((state) => state.clip)).toEqual([null, null])
    expect(answered(block('none'), files(held)).mascot).toEqual({ mode: 'none', states: [] })
  })

  it('never give a URL for code', () => {
    const code = { mobile: { tokens: { light: PAPER }, fonts: { sans: 'assets/fonts/mobile/x.js' } } }
    expect(answered(code, files(['assets/fonts/mobile/x.js'])).fonts).toEqual({})
  })
})

function kept(table: unknown): BootTable {
  const found = bootTable(table)
  if (found === null) throw new Error('bootTable dropped the table')
  return found
}
