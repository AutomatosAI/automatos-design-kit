// @vitest-environment node
// The style sheet's data, held to what a look paints: the colour list is every colour of HUD's own the look paints
// (no more, no fewer), Studio's tokens are painted as HSL triplets, the contrast pairs are design/contrast.json's
// pairs of HUD's own colours, in its order, and every ground with every accent passes them; each knob names the
// variable it drives with the value painted, the glow's cap included.
import { describe, expect, it } from 'vitest'
import { ACCENTS, ACCENT_KEYS, FONTS, GROUNDS, GROUND_KEYS } from '../../src/lib/looks/catalogue.ts'
import { ARC, GHOST, NOVA, PRESETS } from '../../src/lib/looks/presets.ts'
import { KNOB_NAMES } from '../../src/lib/looks/types.ts'
import { lookToCssVars } from '../../src/lib/looks/vars.ts'
import { glowCap } from '../../src/looks/editing.ts'
import { CONTRAST_PAIRS, contrastChecks, formatRatio, glowWords, HUD_COLOURS, knobRows, STUDIO_TOKENS, swatches } from '../../src/style/tokens.ts'
import { readThemeJson } from '../support/files.ts'

interface ContrastFile {
  readonly pairs: readonly { readonly text: string; readonly ground: string; readonly min?: number }[]
}

const AA = 4.5
const COLOUR_VALUE = /^(?:#[0-9A-F]{6}|rgba\(\d{1,3},\d{1,3},\d{1,3},[\d.]+\))$/i
const TRIPLET = /^\d+(?:\.\d+)? \d+(?:\.\d+)?% \d+(?:\.\d+)?%$/

describe("the style sheet's colours", () => {
  it.each(PRESETS)("list every colour of HUD's own $name paints, and nothing else", (look) => {
    const vars = lookToCssVars(look)
    const painted = Object.keys(vars).filter((name) => name.startsWith('--hud-') && COLOUR_VALUE.test(vars[name] ?? ''))
    expect(HUD_COLOURS.map((token) => token.name).sort()).toEqual(painted.sort())
  })

  it("show Studio's tokens as the triplets the look paints", () => {
    const vars = lookToCssVars(ARC)
    for (const swatch of swatches(ARC, STUDIO_TOKENS)) {
      expect(swatch.value).toBe(vars[swatch.name])
      expect(swatch.value).toMatch(TRIPLET)
    }
  })

  it('carry the value the look paints, and change with it', () => {
    const accent = (look: typeof ARC) => swatches(look, HUD_COLOURS).find((swatch) => swatch.name === '--hud-accent')?.value
    expect(accent(ARC)).toBe(ACCENTS.arc.hex)
    expect(accent(NOVA)).toBe(ACCENTS.nova.hex)
  })
})

describe("the style sheet's contrast", () => {
  it("measures design/contrast.json's pairs of HUD's own colours, in its order", () => {
    const file = readThemeJson<ContrastFile>('design/contrast.json')
    const own = file.pairs.filter((pair) => pair.text.startsWith('--hud-'))
    expect(CONTRAST_PAIRS.map(({ text, ground, min }) => ({ text, ground, min }))).toEqual(
      own.map((pair) => ({ text: pair.text, ground: pair.ground, min: pair.min ?? AA })),
    )
  })

  it('passes every pair on every background with every accent', () => {
    const failing = GROUND_KEYS.flatMap((ground) =>
      ACCENT_KEYS.flatMap((accent) =>
        contrastChecks({ ...ARC, ground, accent }).filter((check) => !check.passes).map((check) => `${ground}/${accent}: ${check.label}`),
      ),
    )
    expect(failing).toEqual([])
  })

  it('writes a ratio to two places', () => {
    expect(formatRatio(4.5)).toBe('4.50:1')
    expect(formatRatio(12.3456)).toBe('12.35:1')
  })
})

describe("the style sheet's knobs", () => {
  it("name each knob in looks/schema.json's order, with its choice and the variable it paints", () => {
    const rows = knobRows(NOVA)
    const vars = lookToCssVars(NOVA)
    expect(rows.map((row) => row.knob)).toEqual([...KNOB_NAMES])
    expect(rows.filter((row) => row.value !== vars[row.variable])).toEqual([])
    expect(rows.map((row) => row.choice)).toEqual([
      ACCENTS.nova.name, GROUNDS.navy.name, FONTS.chakra.face, String(NOVA.grid), glowWords(NOVA), 'On', 'On', 'On',
    ])
  })

  it('say when the glow is painted below its own number, and not otherwise', () => {
    expect(glowWords(NOVA)).toBe(`${NOVA.glow}, painted at ${glowCap(NOVA)}`)
    expect(glowWords(GHOST)).toBe(String(GHOST.glow))
  })
})
