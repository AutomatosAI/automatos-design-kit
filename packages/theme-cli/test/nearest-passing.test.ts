/**
 * The nearest passing colour for a failing contrast pair (src/phone/nearest-passing.ts), on Studio's own colours and
 * made-up greys: the value it gives keeps the token's hue and saturation, is a colour the validator takes, passes the
 * pair as `check` measures it (measurePair, at or over the minimum), and is the nearest such lightness: every
 * lightness from 0% to 100% in hundredths is measured, and none that passes is nearer. It goes darker or lighter,
 * whichever is nearer, keeps a #rrggbb token a #rrggbb, and gives nothing for a pair that passes or can't be measured.
 */
import { formatNumber, hexToHsl } from '@automatos/look-kit/hsl'
import { describe, expect, it } from 'vitest'
import { measurePair } from '../src/check/mobile-contrast.ts'
import { isMobileColour, MOBILE_AA_TEXT, MOBILE_AA_UI, type MobileContrastPair } from '../src/core/mobile-manifest.ts'
import { nearestPassing, STUDIO_LIGHT_SOURCE } from '../src/phone/index.ts'

type Tokens = Readonly<Record<string, string>>

const STEPS = 100
const TOP = 100 * STEPS
const MUTED: MobileContrastPair = ['--muted-foreground', '--muted', 'text']
const TEXT: MobileContrastPair = ['--foreground', '--background', 'text']
const RING: MobileContrastPair = ['--ring', '--background', 'ui']

const fixedPair = ([foreground, background, kind]: MobileContrastPair) => (
  { foreground, background, minimum: kind === 'text' ? MOBILE_AA_TEXT : MOBILE_AA_UI }
)

/** A triplet's hue, saturation and lightness as numbers. */
function partsOf(triplet: string): [number, number, number] {
  const [hue, saturation, lightness] = triplet.replaceAll('%', '').split(' ').map(Number)
  return [hue, saturation, lightness]
}

/** The triplet at `step` hundredths of lightness, hue and saturation kept. */
function atStep(triplet: string, step: number): string {
  const [hue, saturation] = partsOf(triplet)
  return `${formatNumber(hue)} ${formatNumber(saturation)}% ${formatNumber(step / STEPS)}%`
}

/** The passing step nearest the token's own, found by measuring every step (the darker one on a tie). */
function nearestByEveryStep(tokens: Tokens, pair: MobileContrastPair): number | null {
  const [foreground] = pair
  const from = Math.round(partsOf(tokens[foreground])[2] * STEPS)
  const passing = Array.from({ length: TOP + 1 }, (_, step) => step).filter((step) => (
    measurePair({ ...tokens, [foreground]: atStep(tokens[foreground], step) }, pair).status === 'pass'
  ))
  if (passing.length === 0) return null
  return passing.reduce((best, step) => (Math.abs(step - from) < Math.abs(best - from) ? step : best))
}

/** The fix, checked: a colour the validator takes, at the token's hue and saturation, passing as check measures it. */
function checkedFix(tokens: Tokens, pair: MobileContrastPair): string {
  const fixed = nearestPassing(tokens, fixedPair(pair))
  if (fixed === null) throw new Error(`no fix for ${pair.join(' ')}`)
  const measured = measurePair({ ...tokens, [pair[0]]: fixed }, pair)
  expect([isMobileColour(fixed), measured.status]).toEqual([true, 'pass'])
  expect(measured.ratio).toBeGreaterThanOrEqual(measured.minimum)
  return fixed
}

const STUDIO_LIGHT: Tokens = STUDIO_LIGHT_SOURCE

describe('the nearest passing value of a failing pair', () => {
  it("fixes Studio Light's own muted text, which is under 4.5:1, by darkening it the least", () => {
    expect(measurePair(STUDIO_LIGHT, MUTED).status).toBe('fail')
    const fixed = checkedFix(STUDIO_LIGHT, MUTED)
    const [hue, saturation, lightness] = partsOf(fixed)
    const [ownHue, ownSaturation, ownLightness] = partsOf(STUDIO_LIGHT['--muted-foreground'])
    expect([hue, saturation, lightness < ownLightness]).toEqual([ownHue, ownSaturation, true])
    expect(Math.round(lightness * STEPS)).toBe(nearestByEveryStep(STUDIO_LIGHT, MUTED))
  })

  it.each<[string, Tokens, MobileContrastPair]>([
    ['grey text too dark on a dark ground goes lighter', { '--foreground': '0 0% 30%', '--background': '0 0% 10%' }, TEXT],
    ['a ring just darker than a mid grey goes darker', { '--ring': '0 0% 45%', '--background': '0 0% 50%' }, RING],
    ['a ring just lighter than a mid grey goes lighter', { '--ring': '0 0% 55%', '--background': '0 0% 50%' }, RING],
    ['a coloured mark on paper', { '--ring': '200 80% 70%', '--background': '40 30% 96%' }, RING],
  ])('%s, to the nearest lightness that passes', (_name, tokens, pair) => {
    const fixed = checkedFix(tokens, pair)
    expect(Math.round(partsOf(fixed)[2] * STEPS)).toBe(nearestByEveryStep(tokens, pair))
  })

  it('keeps a #rrggbb token a #rrggbb, at about the same hue (its channels are whole numbers)', () => {
    const tokens = { '--foreground': '#2e86de', '--background': '#ffffff' }
    expect(measurePair(tokens, TEXT).status).toBe('fail')
    const fixed = checkedFix(tokens, TEXT)
    expect(fixed).toMatch(/^#[0-9a-f]{6}$/)
    expect(Math.abs(hexToHsl(fixed).h - hexToHsl(tokens['--foreground']).h)).toBeLessThan(1)
  })

  it('gives nothing for a pair that passes, or one whose tokens are not both colours', () => {
    expect(nearestPassing(STUDIO_LIGHT, fixedPair(TEXT))).toBeNull()
    expect(nearestPassing({ '--ring': 'blue', '--background': '0 0% 100%' }, fixedPair(RING))).toBeNull()
    expect(nearestPassing({ '--ring': '0 0% 50%' }, fixedPair(RING))).toBeNull()
  })
})
