// @vitest-environment node
// PRD-261 M-07: Play's `mobile` block (theme.json: the look's colours, `fromLooks`, and Auto as `clips`) holds
// on a phone. Core's reader wants each declared state's clip and still (assets/mascot/<state>.mp4 and .png; a
// .webm never counts) and, under fromLooks, a first paint whose Studio tokens are "H S% L%" triplets, the web's
// one form for them, --background and --foreground at least. Core's review (mobile_contrast.py) measures the
// vendored MOBILE_CONTRAST_PAIRS on the table's defaults and then on every preset, each pair at or over its AA
// minimum by look-kit's contrastRatio. The same measure runs here on Play's own look-kit: the defaults painted
// from the boot/prepaint.json the build writes (scripts/looks/compile.ts), each preset through
// lookToStudioTokens, and the corpus's `contrast` cases hold Play's contrastRatio to the review's ratios.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  isMobileColour,
  MOBILE_AA_TEXT,
  MOBILE_AA_UI,
  MOBILE_CONTRAST_PAIRS,
  MOBILE_MASCOT_MODES,
  MOBILE_REQUIRED_TOKENS,
  MOBILE_TOKEN_NAMES,
  type MobileContrastKind,
} from '@automatos/theme-cli/mobile'
import { describe, expect, it } from 'vitest'
import type { PrepaintTable, PrepaintVars } from '../../../scripts/looks/boot-types.ts'
import { lookFiles, PREPAINT_FILE } from '../../../scripts/looks/compile.ts'
import { contrastRatio, parseHex, toHex } from '../src/lib/look-kit/contrast.ts'
import { tripletToHex } from '../src/lib/look-kit/hsl.ts'
import { lookToStudioTokens } from '../src/lib/looks/engine.ts'
import { PRESETS } from '../src/lib/looks/presets.ts'
import { readThemeFile, THEME_ROOT } from './source-files.ts'

const MASCOT_FOLDER = join(THEME_ROOT, 'assets', 'mascot')
const CLIPS = 'clips'
/** core's MOBILE_MASCOT_FILES for clips (package.py): each state's clip, then its still. */
const CLIP_FILES: readonly string[] = ['mp4', 'png']
/** The vendored corpus; its `contrast` cases are the ratios core's review gives. */
const CORPUS = join(THEME_ROOT, '..', '..', 'packages', 'theme-cli', 'test', 'fixtures', 'core', 'cases.json')
/** The corpus writes each ratio to two decimals. */
const RATIO_DIGITS = 2
/** #rrggbb, the reader's other colour form: the web never paints a Studio token from it (mobile-manifest.ts). */
const HEX = /^#[0-9a-f]{6}$/i
/** The review's id for the table's defaults (mobile_contrast.py DEFAULTS_ID). */
const DEFAULTS_ID = `${PREPAINT_FILE}#defaults`
/** Play's presets (lib/looks/presets.ts), each one a subject of the review. */
const PRESET_COUNT = 5
const MINIMUM: Readonly<Record<MobileContrastKind, number>> = { text: MOBILE_AA_TEXT, ui: MOBILE_AA_UI }

type Tokens = Readonly<Record<string, string>>

interface PlayManifest {
  readonly mascot: { readonly states: readonly string[] }
  readonly mobile: { readonly fromLooks?: boolean; readonly mascot?: string }
}

interface ContrastCase {
  readonly name: string
  /** A mobile token value: an 'H S% L%' triplet or #rrggbb. */
  readonly foreground: string
  readonly background: string
  readonly foregroundHex: string
  readonly backgroundHex: string
  readonly ratio: number
}

interface Measured {
  readonly pair: string
  readonly minimum: number
  /** The unrounded WCAG ratio, as the review compares it; null when either token is not a triplet. */
  readonly ratio: number | null
}

interface Corpus {
  readonly contrast: { readonly cases: readonly ContrastCase[] }
}

const manifest = JSON.parse(readThemeFile('theme.json')) as PlayManifest
const CASES = (JSON.parse(readFileSync(CORPUS, 'utf8')) as Corpus).contrast.cases

/** A Studio token value the reader keeps under fromLooks: an "H S% L%" triplet it can read. */
function isTriplet(value: string | undefined): value is string {
  return isMobileColour(value) && !HEX.test(value)
}

/** What a phone gets from painted variables: the Studio tokens it draws, each given as a triplet. */
function phoneTokens(vars: PrepaintVars): Tokens {
  const drawn = Object.entries(vars).filter(([name, value]) => MOBILE_TOKEN_NAMES.includes(name) && isTriplet(value))
  return Object.fromEntries(drawn)
}

/** boot/prepaint.json as the build writes it, read back from its text. */
function compiledTable(): PrepaintTable {
  const text = lookFiles().get(PREPAINT_FILE)
  if (text === undefined) throw new Error(`compile-looks writes no ${PREPAINT_FILE}`)
  return JSON.parse(text) as PrepaintTable
}

/** The option the defaults pick; a table that has none for them can't paint the block, and says where. */
function picked(vars: PrepaintVars | undefined, where: string): PrepaintVars {
  if (vars === undefined) throw new Error(`${DEFAULTS_ID} picks no option of ${where}`)
  return vars
}

/**
 * The table's defaults painted as core's reader paints them (mobile_tokens.paint_look, in the web boot's
 * order): each knob table's option, then each pair table's cell, a later variable overwriting an earlier one.
 * The numeric rules paint only Play's glow, never a Studio token, so they are left out.
 */
function paintDefaults(prepaint: PrepaintTable): PrepaintVars {
  const look = prepaint.defaults
  const knobs = Object.entries(prepaint.knobs).map(([knob, options]) => (
    picked(options[String(look[knob])], `knobs.${knob}`)
  ))
  const pairs = prepaint.pairs.map((pair, index) => (
    picked(pair.table[String(look[pair.a])]?.[String(look[pair.b])], `pairs[${index}]`)
  ))
  return Object.fromEntries([...knobs, ...pairs].flatMap((vars) => Object.entries(vars)))
}

/** Every mobile pair of `tokens`, measured as the review measures it. */
function measure(tokens: Tokens): Measured[] {
  return MOBILE_CONTRAST_PAIRS.map(([foreground, background, kind]) => {
    const fill = tokens[background]
    const text = tokens[foreground]
    const ratio = isTriplet(text) && isTriplet(fill) ? contrastRatio(tripletToHex(text), tripletToHex(fill)) : null
    return { pair: `${foreground} on ${background}`, minimum: MINIMUM[kind], ratio }
  })
}

/** A token value as #RRGGBB, as look-kit reads it: a hex through contrast.ts, a triplet through hsl.ts. */
function hexOf(value: string): string {
  return HEX.test(value) ? toHex(parseHex(value)) : tripletToHex(value)
}

const table = compiledTable()
/** What the review measures under fromLooks, in its order: the table's defaults, then each preset. */
const SUBJECTS: [string, Tokens][] = [
  [DEFAULTS_ID, phoneTokens(paintDefaults(table))],
  ...PRESETS.map((look): [string, Tokens] => [look.id, phoneTokens(lookToStudioTokens(look))]),
]

describe("Auto on the phone: mobile.mascot 'clips'", () => {
  const states = [...manifest.mascot.states]

  it('is a mode the vendored validator knows, with states to play', () => {
    expect(manifest.mobile.mascot).toBe(CLIPS)
    expect(MOBILE_MASCOT_MODES).toContain(manifest.mobile.mascot)
    expect(states.length).toBeGreaterThan(0)
  })

  it.each(states)('%s has its clip and its still in assets/mascot/ (.mp4 and .png; a .webm never counts)', (state) => {
    const names = CLIP_FILES.map((extension) => `${state}.${extension}`)
    expect(names.filter((name) => !existsSync(join(MASCOT_FOLDER, name)))).toEqual([])
  })
})

describe("the phone's colours: Play's looks, as core's reader and review read them", () => {
  it('paints the defaults of boot/prepaint.json with --background and --foreground as triplets', () => {
    expect(manifest.mobile.fromLooks).toBe(true)
    const defaults = phoneTokens(paintDefaults(table))
    expect(MOBILE_REQUIRED_TOKENS.filter((name) => !isTriplet(defaults[name]))).toEqual([])
  })

  it('measures the defaults first, then the five presets', () => {
    expect(PRESETS).toHaveLength(PRESET_COUNT)
    expect(SUBJECTS.map(([id]) => id)).toEqual([DEFAULTS_ID, ...PRESETS.map((look) => look.id)])
  })

  it.each(SUBJECTS)('%s gives the phone every Studio token it draws, each a triplet', (_id, tokens) => {
    expect(MOBILE_TOKEN_NAMES.filter((name) => !isTriplet(tokens[name]))).toEqual([])
  })

  it.each(SUBJECTS)('%s has every mobile pair measured and at or over its AA minimum', (_id, tokens) => {
    const measured = measure(tokens)
    expect(measured).toHaveLength(MOBILE_CONTRAST_PAIRS.length)
    expect(measured.filter(({ ratio, minimum }) => ratio === null || ratio < minimum)).toEqual([])
  })
})

describe("Play's look-kit measures as core's review does (the corpus's contrast cases)", () => {
  it('has cases to measure', () => {
    expect(CASES.length).toBeGreaterThan(0)
  })

  it.each([...CASES])('$name: the case hexes and its ratio to two decimals', (item) => {
    const foreground = hexOf(item.foreground)
    const background = hexOf(item.background)
    expect([foreground, background]).toEqual([item.foregroundHex, item.backgroundHex])
    expect(contrastRatio(foreground, background)).toBeCloseTo(item.ratio, RATIO_DIGITS)
  })
})
