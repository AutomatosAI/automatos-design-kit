/**
 * The contrast measure (src/check/mobile-contrast.ts) gives core's answers: the cases of core's
 * orchestrator/tests/test_prd261_mobile_contrast.py at the commit src/core/README.md names.
 *
 * - every `contrast` case of the shared corpus (test/fixtures/core/cases.json) gets the hexes core reads and
 *   its ratio to two decimals, either way round;
 * - `measureMobile` measures the block's ten pairs (eight text pairs at 4.5:1, two UI pairs at 3:1) per scheme
 *   of `mobile.tokens`, or under `fromLooks` for the prepaint table's defaults and each preset, each painted as
 *   the web's first paint paints it (a look that doesn't fit the table is the defaults whole): a pair under its
 *   minimum fails, named by its scheme, the defaults or its preset, both tokens and the ratio; a subject that
 *   gives no --background or --foreground fails, naming what it lacks; any other pair whose two tokens are not
 *   both set is not measured; a manifest without the block is left to the review (null).
 *
 * Core's luminance case (black to white, a non-hex refused) is look-kit's own, which Play's tests hold.
 * The level and the verdict the review gives these outcomes are check-report.test.ts's.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CONTRAST_REASONS, DEFAULTS_ID, describeMeasure, measureMobile, measurePair, outcomeOf, parseColour,
  type ContrastPair, type ContrastSubject, type MobileMeasure,
} from '../src/check/mobile-contrast.ts'
import { MOBILE_AA_TEXT, MOBILE_AA_UI, MOBILE_CONTRAST_PAIRS } from '../src/core/mobile-manifest.ts'
import { HELLO_DIR, MANIFEST } from './check-support.ts'

interface ContrastCase {
  readonly name: string
  readonly foreground: string
  readonly background: string
  readonly foregroundHex: string
  readonly backgroundHex: string
  readonly ratio: number
}

type Json = Readonly<Record<string, unknown>>

const CORPUS = new URL('./fixtures/core/cases.json', import.meta.url)
const CASES = (JSON.parse(readFileSync(CORPUS, 'utf8')) as { contrast: { cases: readonly ContrastCase[] } }).contrast.cases
const TEXT_PAIR = MOBILE_CONTRAST_PAIRS[0]
const WHITE = '0 0% 100%'
const INK_TEXT = '#14181c'
const PASSING_LIGHT = { '--background': WHITE, '--foreground': INK_TEXT }
// The corpus's colours at about 3:1 (3.03), 3.2:1 (3.19) and under 3:1 (2.85) on white.
const ABOUT_THREE = '0 0% 58%'
const ABOUT_THREE_TWO = '0 0% 56.5%'
const UNDER_THREE = '0 0% 60%'
const DARK_GROUND = '220 13% 9%'
const DARK_TEXT = '210 20% 96%'
const DIM_TEXT = '0 0% 30%'
// A prepaint table paints Studio tokens as triplets only (the web reads them as hsl(var(--x))): #14181c and
// #2e9e5b as hexToTriplet writes them, so the ratios are the hexes' own.
const INK_TRIPLET = '210 16.67% 9.41%'
const BLUE = '221.21 83.19% 53.33%'
const GREEN = '144.11 54.9% 40%'
const PREPAINT = 'boot/prepaint.json'
const FROM_LOOKS = { mobile: { fromLooks: true } }
const GROUNDS = {
  paper: { '--background': WHITE, '--foreground': INK_TRIPLET, '--hello-bg': '#f4efe6' },
  ink: { '--background': DARK_GROUND, '--foreground': DARK_TEXT },
}
const TABLE = {
  knobs: {
    ground: GROUNDS,
    // White on this green is 3.41:1: a text pair under AA.
    accent: {
      blue: { '--primary': BLUE, '--primary-foreground': WHITE, '--ring': BLUE },
      green: { '--primary': GREEN, '--primary-foreground': WHITE, '--ring': GREEN },
    },
  },
  defaults: { accent: 'blue', ground: 'paper', radius: 6 },
  tone: { knob: 'ground', values: { paper: 'light', ink: 'dark' } },
}
// 10**309: JSON.parse reads a literal past the double's range as Infinity, which the web's boot drops.
const PAST_DOUBLE = `1${'0'.repeat(309)}`
const PAST_DOUBLE_MARK = '"past-double"'

function bytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value).replaceAll(PAST_DOUBLE_MARK, PAST_DOUBLE))
}

/** A manifest whose block gives `schemes` as `mobile.tokens`. */
function tokens(schemes: Json): Json {
  return { mobile: { tokens: schemes } }
}

/** The package files under fromLooks: each preset (its id added) and the table, unless it is null. */
function lookFiles(presets: Readonly<Record<string, Json>>, table: unknown = TABLE): Map<string, Uint8Array> {
  const files = new Map(Object.entries(presets).map(([id, look]): [string, Uint8Array] => [`looks/presets/${id}.look.json`, bytes({ id, ...look })]))
  return table === null ? files : new Map([...files, [PREPAINT, bytes(table)]])
}

/** The table with the ink ground's tokens replaced. */
function withInk(ink: Json): Json {
  return { ...TABLE, knobs: { ...TABLE.knobs, ground: { ...GROUNDS, ink } } }
}

function measured(manifest: Json, files: ReadonlyMap<string, Uint8Array> = new Map()): MobileMeasure {
  const result = measureMobile(manifest, files)
  if (result === null) throw new Error('the manifest has a mobile block, so it is measured')
  return result
}

function subjectsOf(result: MobileMeasure): readonly ContrastSubject[] {
  return result.presets ?? result.schemes ?? []
}

function pairOf(subject: ContrastSubject, foreground: string, background: string): ContrastPair | undefined {
  return subject.pairs.find((pair) => pair.foreground === foreground && pair.background === background)
}

describe("the ratio: look-kit's, case for case", () => {
  it.each([...CASES])('$name: the hexes core reads, and the ratio to two decimals either way round', (item) => {
    expect([parseColour(item.foreground), parseColour(item.background)]).toEqual([item.foregroundHex, item.backgroundHex])
    expect(measurePair({ '--foreground': item.foreground, '--background': item.background }, TEXT_PAIR).ratio).toBe(item.ratio)
    expect(measurePair({ '--foreground': item.background, '--background': item.foreground }, TEXT_PAIR).ratio).toBe(item.ratio)
  })

  it('a value that is neither a triplet nor a #rrggbb has no colour', () => {
    expect(['#fff', '#2f6fed80', '360 0% 0%', '0 0% 101%', 'hsl(0 0% 0%)', '', null].map(parseColour)).toEqual(Array(7).fill(null))
  })

  it('the ten pairs are measured against their own minimum', () => {
    const pairs = MOBILE_CONTRAST_PAIRS.map((pair) => measurePair({}, pair))
    expect(pairs.map((pair) => pair.minimum)).toEqual([...Array(8).fill(MOBILE_AA_TEXT), MOBILE_AA_UI, MOBILE_AA_UI])
    expect(pairs.map((pair) => pair.kind)).toEqual([...Array(8).fill('text'), 'ui', 'ui'])
    expect([new Set(pairs.map((pair) => pair.status)), new Set(pairs.map((pair) => pair.ratio))]).toEqual([new Set(['not_measured']), new Set([null])])
  })

  it('the outcome is fail on any failure, pass on any pass, else not_measured', () => {
    expect(outcomeOf(['pass', 'fail', 'not_measured'])).toBe('fail')
    expect(outcomeOf(['pass', 'not_measured'])).toBe('pass')
    expect([outcomeOf(['not_measured']), outcomeOf([])]).toEqual(['not_measured', 'not_measured'])
  })
})

describe('mobile.tokens: per scheme', () => {
  it('text at about 3:1 on the light ground fails, naming light, both tokens and the ratio', () => {
    const result = measured(tokens({ light: { '--background': WHITE, '--foreground': ABOUT_THREE } }))
    const [light] = subjectsOf(result)
    expect([result.source, result.status, light.id, light.status]).toEqual(['tokens', 'fail', 'light', 'fail'])
    expect(pairOf(light, '--foreground', '--background')?.ratio).toBe(3.03)
    expect(result.problems).toEqual(['mobile.tokens.light: --foreground on --background is 3.03:1, under the AA minimum of 4.5:1 for text.'])
    expect(result.reason.startsWith('1 measured colour pair(s) of the mobile block are under WCAG AA')).toBe(true)
  })

  it('a failing dark scheme is named and the passing light one is not', () => {
    const result = measured(tokens({ light: PASSING_LIGHT, dark: { '--background': DARK_GROUND, '--foreground': DIM_TEXT } }))
    expect(subjectsOf(result).map(({ id, kind, status }) => [id, kind, status])).toEqual([['light', 'scheme', 'pass'], ['dark', 'scheme', 'fail']])
    expect([result.status, result.problems.length]).toEqual(['fail', 1])
    expect(result.problems[0].startsWith('mobile.tokens.dark: --foreground on --background is 2.14:1')).toBe(true)
    expect(result.problems[0]).not.toContain('light')
  })

  it('a ring at about 3.2:1 passes as a UI mark where text at the same ratio fails', () => {
    const ring = measured(tokens({ light: { ...PASSING_LIGHT, '--ring': ABOUT_THREE_TWO } }))
    expect([ring.status, ring.problems]).toEqual(['pass', []])
    expect(pairOf(subjectsOf(ring)[0], '--ring', '--background')).toEqual({
      foreground: '--ring', background: '--background', kind: 'ui', minimum: 3, status: 'pass', ratio: 3.19,
    })
    const text = measured(tokens({ light: { '--background': WHITE, '--foreground': ABOUT_THREE_TWO } }))
    expect([text.status, text.problems[0]]).toEqual(['fail', expect.stringContaining('3.19:1')])
  })

  it('a UI mark under 3:1 fails, naming its minimum', () => {
    const result = measured(tokens({ light: { ...PASSING_LIGHT, '--primary': UNDER_THREE } }))
    expect(result.problems).toEqual(['mobile.tokens.light: --primary on --background is 2.85:1, under the AA minimum of 3:1 for UI marks.'])
  })

  it('a pair with one token unset is not measured and never fails the block', () => {
    const result = measured(tokens({ light: { ...PASSING_LIGHT, '--card': WHITE } }))
    const [light] = subjectsOf(result)
    expect([result.status, result.problems]).toEqual(['pass', []])
    expect(pairOf(light, '--card-foreground', '--card')).toEqual({
      foreground: '--card-foreground', background: '--card', kind: 'text', minimum: 4.5, status: 'not_measured', ratio: null,
    })
    expect(light.pairs.filter((pair) => pair.status === 'not_measured')).toHaveLength(9)
    expect(result.reason.endsWith('9 pair(s) are not measured: their two tokens are not both set.')).toBe(true)
  })

  it('a scheme that gives no text colour fails rather than going unmeasured', () => {
    const result = measured(tokens({ light: { '--background': WHITE }, dark: PASSING_LIGHT }))
    expect(subjectsOf(result).map(({ id, status, missing }) => [id, status, missing])).toEqual([
      ['light', 'fail', ['--foreground']], ['dark', 'pass', []],
    ])
    expect(result.problems).toEqual(["mobile.tokens.light: gives no --foreground, so a phone can't draw it."])
  })

  it('a hex ground is kept: mobile.tokens is read only by the phone', () => {
    expect(measured(tokens({ light: { '--background': '#ffffff', '--foreground': INK_TEXT } })).status).toBe('pass')
  })
})

describe('fromLooks: per preset, painted through the prepaint table', () => {
  it('measures every preset and names the failing one', () => {
    const result = measured(FROM_LOOKS, lookFiles({ default: { accent: 'blue', ground: 'paper' }, night: { accent: 'green', ground: 'ink' } }))
    const subjects = subjectsOf(result)
    expect([result.source, result.status]).toEqual(['fromLooks', 'fail'])
    expect(subjects.map(({ id, kind, status }) => [id, kind, status])).toEqual([
      [DEFAULTS_ID, 'defaults', 'pass'], ['default', 'preset', 'pass'], ['night', 'preset', 'fail'],
    ])
    expect(pairOf(subjects[2], '--foreground', '--background')?.ratio).toBe(16.57) // ink's own text
    expect(result.problems).toEqual(['Preset "night": --primary-foreground on --primary is 3.41:1, under the AA minimum of 4.5:1 for text.'])
    expect(result).not.toHaveProperty('schemes')
  })

  it('measures the defaults as their own subject and fails on them alone', () => {
    const greenDefaults = { ...TABLE, defaults: { accent: 'green', ground: 'paper', radius: 6 } }
    const result = measured(FROM_LOOKS, lookFiles({ default: { accent: 'blue', ground: 'paper' }, night: { accent: 'blue', ground: 'ink' } }, greenDefaults))
    expect(subjectsOf(result).map(({ id, status }) => [id, status])).toEqual([[DEFAULTS_ID, 'fail'], ['default', 'pass'], ['night', 'pass']])
    expect([result.status, result.problems]).toEqual(['fail', [
      `${DEFAULTS_ID}: --primary-foreground on --primary is 3.41:1, under the AA minimum of 4.5:1 for text.`,
    ]])
  })

  it("a preset named defaults keeps its own entry beside the table's defaults", () => {
    const result = measured(FROM_LOOKS, lookFiles({ defaults: { accent: 'green', ground: 'ink' }, night: { accent: 'blue', ground: 'ink' } }))
    expect(subjectsOf(result).map(({ id, kind, status }) => [id, kind, status])).toEqual([
      [DEFAULTS_ID, 'defaults', 'pass'], ['defaults', 'preset', 'fail'], ['night', 'preset', 'pass'],
    ])
    expect(result.problems).toEqual(['Preset "defaults": --primary-foreground on --primary is 3.41:1, under the AA minimum of 4.5:1 for text.'])
  })

  it('a preset that does not fit the table is painted as the defaults whole', () => {
    // boot.ts :173: the web paints the whole default look (paper and blue), never ink with the default accent.
    const [defaults, odd] = subjectsOf(measured(FROM_LOOKS, lookFiles({ odd: { accent: 'violet', ground: 'ink' } })))
    expect([odd.status, odd.pairs]).toEqual(['pass', defaults.pairs])
    expect(pairOf(odd, '--primary', '--background')?.ratio).toBe(5.17) // blue on paper's white
  })

  it('a preset that paints no ground fails, naming what it lacks', () => {
    const files = lookFiles({ default: { accent: 'blue', ground: 'paper' }, night: { accent: 'blue', ground: 'ink' } }, withInk({ '--foreground': DARK_TEXT }))
    const result = measured(FROM_LOOKS, files)
    const night = subjectsOf(result)[2]
    expect([result.status, night.id, night.status, night.missing]).toEqual(['fail', 'night', 'fail', ['--background']])
    expect(result.problems).toEqual(['Preset "night": gives no --background, so a phone can\'t draw it.'])
    expect(result.reason.startsWith("1 of the mobile block's colour sets give no --background or --foreground")).toBe(true)
    expect(subjectsOf(result).slice(0, 2).map((subject) => subject.missing)).toEqual([[], []])
  })

  it('a hex ground paints nothing on the web, so the preset fails as unpainted', () => {
    const hexed = withInk({ '--background': '#14161a', '--foreground': DARK_TEXT })
    const result = measured(FROM_LOOKS, lookFiles({ default: { accent: 'blue', ground: 'paper' }, night: { accent: 'blue', ground: 'ink' } }, hexed))
    expect(subjectsOf(result).map(({ status, missing }) => [status, missing])).toEqual([['pass', []], ['pass', []], ['fail', ['--background']]])
    expect(result.problems).toEqual(['Preset "night": gives no --background, so a phone can\'t draw it.'])
  })

  it('with no table nothing is painted, so every subject fails, and nothing throws', () => {
    const result = measured(FROM_LOOKS, lookFiles({ default: { ground: 'paper' } }, null))
    const both = ['--background', '--foreground']
    expect(result.status).toBe('fail')
    expect(subjectsOf(result).map(({ id, status, missing }) => [id, status, missing])).toEqual([[DEFAULTS_ID, 'fail', both], ['default', 'fail', both]])
    expect(result.reason.startsWith("2 of the mobile block's colour sets give no --background or --foreground")).toBe(true)
    const broken = new Map([...lookFiles({ default: { ground: 'paper' } }), [PREPAINT, new TextEncoder().encode('{not json')]])
    expect(measured(FROM_LOOKS, broken).status).toBe('fail')
  })

  it("a number past the double's range is dropped as the web drops it, and nothing throws", () => {
    expect(JSON.parse(PAST_DOUBLE)).toBe(Infinity)
    const table = { ...TABLE, defaults: { ...TABLE.defaults, radius: 'past-double' } }
    const result = measured(FROM_LOOKS, lookFiles({ default: { accent: 'blue', ground: 'paper', radius: 'past-double' } }, table))
    expect([subjectsOf(result).map((subject) => subject.status), result.status]).toEqual([['pass', 'pass'], 'pass'])
  })
})

describe('the block, the review and the line', () => {
  it('a manifest without the block is left to the review', () => {
    const hello = JSON.parse(readFileSync(join(HELLO_DIR, MANIFEST), 'utf8')) as Json
    expect([measureMobile(hello, new Map()), measureMobile({ mobile: null }, new Map())]).toEqual([null, null])
  })

  it('the line gives the reason, each problem, then each subject with its pairs measured', () => {
    const result = measured(tokens({ light: { '--background': WHITE, '--foreground': ABOUT_THREE }, dark: PASSING_LIGHT }))
    expect(describeMeasure(result)).toEqual({
      text: `${CONTRAST_REASONS.fail.replace('{failed}', '1')} 18 pair(s) are not measured: their two tokens are not both set.`,
      items: [
        'mobile.tokens.light: --foreground on --background is 3.03:1, under the AA minimum of 4.5:1 for text.',
        'mobile.tokens.light: fail, 1 of 10 pair(s) measured',
        'mobile.tokens.dark: pass, 1 of 10 pair(s) measured',
      ],
    })
  })
})
