// @vitest-environment node
// HUD's catalogue is the Command design's (its looks.json in the kit's references, look schema v0): every accent's
// hex and ink, every ground's colour, every display face's family, weight and sizes, the fixed colours, and the five
// presets' values, with v0's booleans as v1's on and off. Then the look's colours read at WCAG AA on every one of
// the 24 grounds and accents, by look-kit's own ratio: the texts on the ground and its surface, the accent's ink on
// the accent, and Studio's text tokens on their fills, with --primary and --ring at 3:1 on the background.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { AA_NON_TEXT, AA_TEXT, contrastRatio } from '@automatos/look-kit/contrast'
import { tripletToHex } from '@automatos/look-kit/hsl'
import { describe, expect, it } from 'vitest'
import {
  ACCENTS,
  ACCENT_KEYS,
  FIXED,
  FONTS,
  FONT_KEYS,
  GROUNDS,
  GROUND_KEYS,
  type AccentKey,
  type GroundKey,
} from '../src/lib/looks/catalogue.ts'
import { groundOf, isDarkGround, surfaceOf } from '../src/lib/looks/engine.ts'
import { PRESETS } from '../src/lib/looks/presets.ts'
import { accentVars, groundVars, pairVars } from '../src/lib/looks/vars.ts'
import { DESIGN_LOOKS } from './support/files.ts'

interface V0 {
  readonly default: string
  readonly options: {
    readonly accent: Readonly<Record<string, { readonly hex: string; readonly ink: string }>>
    readonly ground: Readonly<Record<string, { readonly bg: string }>>
    readonly font: Readonly<Record<string, { readonly family: string; readonly weight: number; readonly titlePx: number; readonly labelPx: number }>>
    readonly grid: { readonly min: number; readonly max: number }
    readonly glow: { readonly min: number; readonly max: number }
  }
  readonly fixed: Readonly<Record<string, string>>
  readonly presets: readonly Readonly<Record<string, string | number | boolean>>[]
}

const V0_FILE = join(DESIGN_LOOKS, 'looks.json')
/** The kit's references may be taken out on their own (tests/references.test.ts): the v0 checks run while they are there. */
const HAS_V0 = existsSync(V0_FILE)
const v0 = (HAS_V0 ? JSON.parse(readFileSync(V0_FILE, 'utf8')) : null) as V0

type Pair = readonly [text: string, ground: string, min: number]

const TEXT_PAIRS: readonly Pair[] = [
  ['--hud-text', '--hud-bg', AA_TEXT], ['--hud-text', '--hud-surface', AA_TEXT],
  ['--hud-text-2', '--hud-bg', AA_TEXT], ['--hud-text-2', '--hud-surface', AA_TEXT],
  ['--hud-accent-text', '--hud-bg', AA_TEXT], ['--hud-accent-text', '--hud-surface', AA_TEXT],
  ['--hud-error-text', '--hud-bg', AA_TEXT], ['--hud-error-text', '--hud-surface', AA_TEXT],
  ['--hud-accent-ink', '--hud-accent', AA_TEXT], ['--hud-accent', '--hud-bg', AA_NON_TEXT],
  ['--foreground', '--background', AA_TEXT], ['--card-foreground', '--card', AA_TEXT],
  ['--secondary-foreground', '--secondary', AA_TEXT], ['--muted-foreground', '--muted', AA_TEXT],
  ['--muted-foreground', '--card', AA_TEXT], ['--primary-foreground', '--primary', AA_TEXT],
  ['--accent-foreground', '--accent', AA_TEXT], ['--destructive-foreground', '--destructive', AA_TEXT],
  ['--primary', '--background', AA_NON_TEXT], ['--ring', '--background', AA_NON_TEXT],
]

const HEX = /^#[0-9a-f]{6}$/i

/** A painted colour as #RRGGBB: a hex as it is, a Studio triplet through look-kit's hsl.ts. */
function colourOf(value: string): string {
  return HEX.test(value) ? value : tripletToHex(value)
}

const COMBOS = GROUND_KEYS.flatMap((ground) => ACCENT_KEYS.map((accent): [GroundKey, AccentKey] => [ground, accent]))

describe.runIf(HAS_V0)("the catalogue is looks.json's (look schema v0)", () => {
  it('has its accents, each hex and ink', () => {
    expect(Object.fromEntries(ACCENT_KEYS.map((key) => [key, { hex: ACCENTS[key].hex, ink: ACCENTS[key].ink }]))).toEqual(v0.options.accent)
  })

  it('has its grounds, each colour', () => {
    expect(Object.fromEntries(GROUND_KEYS.map((key) => [key, { bg: GROUNDS[key].bg }]))).toEqual(v0.options.ground)
  })

  it('has its display faces, each family, weight and size', () => {
    const fonts = Object.fromEntries(FONT_KEYS.map((key) => {
      const { face, weight, titlePx, labelPx } = FONTS[key]
      return [key, { family: face, weight, titlePx, labelPx }]
    }))
    expect(fonts).toEqual(v0.options.font)
  })

  it('has its fixed colours', () => {
    const { text, text2, line, track, error } = FIXED
    expect({ text, text2, line, track, error }).toEqual({
      text: v0.fixed.text, text2: v0.fixed.text2, line: v0.fixed.line, track: v0.fixed.track, error: v0.fixed.error,
    })
  })

  it('has its presets, value for value, its booleans as on and off', () => {
    const asV1 = (value: string | number | boolean): string | number => (typeof value === 'boolean' ? (value ? 'on' : 'off') : value)
    const designed = v0.presets.map((preset) => Object.fromEntries(Object.entries(preset).map(([key, value]) => [key, asV1(value)])))
    const ours = PRESETS.map(({ id, name, ground, accent, font, grid, glow, scan, auto, motion }) => ({ id, name, ground, accent, font, grid, glow, scan, auto, motion }))
    expect(ours).toEqual(designed)
    expect(PRESETS[0].id).toBe(v0.default)
  })
})

describe("HUD's grounds as the look runtime reads them", () => {
  it.each(GROUND_KEYS)('%s is dark, its surface the track over its colour, its texts the fixed ones', (key) => {
    expect(isDarkGround(key)).toBe(true)
    expect(groundOf(key)).toEqual({
      bg: GROUNDS[key].bg, surface: surfaceOf(GROUNDS[key].bg), text: FIXED.text, text2: FIXED.text2,
      line: FIXED.line, chip: FIXED.track, panel: FIXED.track,
    })
  })
})

describe('every look reads at WCAG AA', () => {
  it.each(COMBOS)('%s with %s', (ground, accent) => {
    const vars: Readonly<Record<string, string>> = { ...groundVars(ground), ...accentVars(accent), ...pairVars(ground, accent) }
    const under = TEXT_PAIRS.filter(([text, fill, min]) => contrastRatio(colourOf(vars[text]), colourOf(vars[fill])) < min)
    expect(under).toEqual([])
  })
})
