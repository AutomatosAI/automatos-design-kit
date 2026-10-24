/**
 * The nearest colour that passes a contrast pair: a skin's failing pair fixed by moving its first token's lightness
 * alone, hue and saturation kept, to the closest value whose pair measures at or over its minimum. The skin designer
 * offers it beside each failing pair (the harness's phone view), and `automatos-theme skin` names it for each pair it
 * refuses.
 *
 * Measured as `check` measures the block (check/mobile-contrast.ts `measurePair`): each candidate is written as the
 * value a theme.json would hold (an "H S% L%" triplet, look-kit hsl.ts `formatTriplet`, two decimals; or, for a
 * token given as #rrggbb, that triplet as #rrggbb), read back through mobile-paint.ts `parseColour` and held to
 * look-kit's `contrastRatio`, the unrounded ratio against the minimum. A token's luminance never falls as its
 * lightness rises (each sRGB channel of an HSL colour grows with L, and rounding keeps the order), so a failing pair
 * passes on a run of lightnesses below it, a run above it, or both: each side's edge is found by bisection over
 * hundredths of a percent, and the nearer one wins (the darker on a tie). Pure.
 */
import { contrastRatio } from '@automatos/look-kit/contrast'
import { formatTriplet, hexToHsl, parseTriplet, type Hsl } from '@automatos/look-kit/hsl'
import { parseColour } from '../mobile-paint.ts'

/** Lightness steps per percent: a triplet's numbers keep two decimals. */
const STEPS_PER_PERCENT = 100
const TOP_STEP = 100 * STEPS_PER_PERCENT
const HEX_MARK = '#'

/** One pair to fix: the token whose lightness moves, the token it is read on, and the pair's minimum. */
export interface FixedPair {
  readonly foreground: string
  readonly background: string
  readonly minimum: number
}

type Passes = (step: number) => boolean

/** The value as a theme.json writes it at `step` hundredths of lightness, in the form the token was given in. */
function writtenAt(hsl: Hsl, step: number, asHex: boolean): string {
  const triplet = formatTriplet({ ...hsl, l: step / STEPS_PER_PERCENT })
  return asHex ? String(parseColour(triplet)).toLowerCase() : triplet
}

/** The highest step in [low, high] that passes, when `low` passes and every step above a failing one fails. */
function lastPassing(low: number, high: number, passes: Passes): number {
  if (passes(high)) return high
  let [pass, fail] = [low, high]
  while (fail - pass > 1) {
    const middle = Math.floor((pass + fail) / 2)
    if (passes(middle)) pass = middle
    else fail = middle
  }
  return pass
}

/** The lowest step in [low, high] that passes, when `high` passes and every step below a failing one fails. */
function firstPassing(low: number, high: number, passes: Passes): number {
  if (passes(low)) return low
  let [fail, pass] = [low, high]
  while (pass - fail > 1) {
    const middle = Math.floor((pass + fail) / 2)
    if (passes(middle)) pass = middle
    else fail = middle
  }
  return pass
}

/** The step nearest `from` that passes, below or above it; null when no lightness passes. */
function nearestStep(from: number, passes: Passes): number | null {
  const below = passes(0) ? lastPassing(0, from, passes) : null
  const above = passes(TOP_STEP) ? firstPassing(from, TOP_STEP, passes) : null
  if (below === null || above === null) return below ?? above
  return from - below <= above - from ? below : above
}

/**
 * The value `pair.foreground` takes in `tokens` (a scheme's or a painted look's token values) for the pair to pass,
 * its lightness moved the least; null when the pair passes already, either token is no colour, or no lightness of
 * the foreground's hue and saturation reaches the minimum.
 */
export function nearestPassing(tokens: Readonly<Record<string, unknown>>, pair: FixedPair): string | null {
  const given = tokens[pair.foreground]
  const fore = parseColour(given)
  const back = parseColour(tokens[pair.background])
  if (fore === null || back === null || typeof given !== 'string') return null
  if (contrastRatio(fore, back) >= pair.minimum) return null
  const asHex = given.startsWith(HEX_MARK)
  const hsl = asHex ? hexToHsl(fore) : parseTriplet(given)
  const passes: Passes = (step) => contrastRatio(String(parseColour(writtenAt(hsl, step, asHex))), back) >= pair.minimum
  const step = nearestStep(Math.round(hsl.l * STEPS_PER_PERCENT), passes)
  return step === null ? null : writtenAt(hsl, step, asHex)
}
