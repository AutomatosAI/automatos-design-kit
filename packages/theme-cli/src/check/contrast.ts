/**
 * The kit's contrast measure (PRD-261 B-03d): a look painted from its theme's first-paint table, and
 * a text colour on a ground colour of that painting, by the WCAG 2.x ratio.
 *
 * - The table and the fit are src/mobile-paint.ts `bootTable` and `lookFits`, the CLI's one port of
 *   boot-sanitize.ts `sanitizePrepaint` and `lookFitsPrepaint` (the boot script's `fits`), at the core
 *   commit src/core/README.md names: the host keeps only the names and values its own grammar accepts,
 *   and drops the whole table when its defaults no longer fit what is left.
 * - `firstPaint` is THEME_BOOT_SCRIPT's paint in frontend/lib/theme-host/boot.ts at that commit
 *   (:145-:148), on the kept table: every knob table's entry, then every pair table's, a later one
 *   overwriting, then each numeric rule's `rgba()`; the table's defaults for a look that doesn't fit.
 *   Core's frontend/lib/theme-host/looks/paint.ts `paint` is the same walk as a pure function, which
 *   core holds to the script. It is not mobile-paint.ts `paintLook`, the server's mobile_tokens.py
 *   `paint_look`, which keeps only the triplet Studio tokens a phone draws and leaves numeric rules
 *   out: a pair of design/contrast.json may name any variable the browser paints. The browser harness
 *   ports the same paint for the page it draws (theme-harness src/host/prepaint.ts), in a module typed
 *   against the DOM, which this package's typecheck leaves out.
 * - The tone rule paints no variable, so bootTable leaves it out. At that commit boot.ts reads the kept
 *   rule only to decide whether an installed theme's first paint takes its tone from the look runtime's
 *   tone cookie (`keepsLookTone`, `withLookTone`): a class on <html>, not a variable the table paints.
 * - The ratio is the look runtime's own math, never a copy: `contrastRatio` of @automatos/look-kit's
 *   contrast.ts (packages/look-kit, which starts from Play's copy of core's frontend/lib/look-kit). A
 *   painted value is read as the browser draws it: `#rrggbb` as it is, and a Studio triplet `H S% L%`
 *   (or the triplet wrapped as `hsl(...)`, as Studio's aliases are) back to #RRGGBB with look-kit hsl.ts
 *   `tripletToHex`, as look-kit's own contrast.test.ts measures them. Anything else (`rgba()`, `var()`, a
 *   word) is not a colour this reads. check/mobile-contrast.ts reads a phone token instead, as the
 *   server's `parse_colour` does, with hsl.ts's `hslToHex` ported; the corpus's contrast cases hold both.
 *
 * look-kit's modules import each other with the `.ts` extension, so Node, which runs this command, loads
 * them as they are. hsl.ts is loaded the first time a meter is made, so `check` loads contrast.ts alone.
 *
 * `check design` measures a theme's declared pairs (design/contrast.json) on each preset with these.
 */
import { AA_TEXT, contrastRatio } from '@automatos/look-kit/contrast'
import { own, type JsonRecord } from '../core/css-value.ts'
import { lookFits, type BootRule, type BootTable } from '../mobile-paint.ts'

type LookKitHsl = typeof import('@automatos/look-kit/hsl')

/** A pair's minimum when it names none: WCAG AA for body text (look-kit contrast.ts AA_TEXT). */
export const DEFAULT_PAIR_MIN = AA_TEXT

/** The custom properties a look paints, by name. */
export type PaintedVars = Readonly<Record<string, string>>

/** A text colour drawn on a ground colour, each a custom property, and the ratio it must reach. */
export interface ContrastPair {
  readonly text: string
  readonly ground: string
  readonly min: number
}

/** A painted value the meter couldn't read as a colour: its name and value (undefined when not painted). */
export interface UnreadValue {
  readonly name: string
  readonly value: string | undefined
}

export interface PairMeasure {
  readonly pair: ContrastPair
  readonly status: 'pass' | 'fail' | 'not_measured'
  /** The unrounded ratio, as WCAG reads it; null when not measured. */
  readonly ratio: number | null
  readonly unread: readonly UnreadValue[]
}

export interface ContrastMeter {
  /** `value` as #RRGGBB when the browser draws it as an opaque colour this reads, else null. */
  readonly colourOf: (value: string | undefined) => string | null
}

const HEX_COLOUR = /^#[0-9a-f]{6}$/i
const WRAPPED_TRIPLET = /^hsl\((.+)\)$/

let hslModule: Promise<LookKitHsl> | null = null

/** look-kit hsl.ts, loaded once, when the first meter is made. */
function lookKitHsl(): Promise<LookKitHsl> {
  if (hslModule === null) hslModule = import('@automatos/look-kit/hsl')
  return hslModule
}

/** The meter: look-kit's colour reading, ready to measure. */
export async function contrastMeter(): Promise<ContrastMeter> {
  const { tripletToHex } = await lookKitHsl()
  const fromTriplet = (triplet: string): string | null => {
    // tripletToHex throws for anything but an in-range 'H S% L%': that value is not a colour this reads.
    try {
      return tripletToHex(triplet)
    } catch {
      return null
    }
  }
  return {
    colourOf: (value) => {
      if (value === undefined) return null
      if (HEX_COLOUR.test(value)) return value
      return fromTriplet(WRAPPED_TRIPLET.exec(value)?.[1] ?? value)
    },
  }
}

/** `pair` measured on `vars`: its ratio against its minimum, or the values that aren't colours. */
export function measurePair(meter: ContrastMeter, vars: PaintedVars, pair: ContrastPair): PairMeasure {
  const read = [pair.text, pair.ground].map((name) => {
    const value = own(vars, name)
    const shown = typeof value === 'string' ? value : undefined
    return { name, value: shown, colour: meter.colourOf(shown) }
  })
  const [text, ground] = read.map((item) => item.colour)
  if (text === null || ground === null) {
    const unread = read.filter((item) => item.colour === null).map(({ name, value }) => ({ name, value }))
    return { pair, status: 'not_measured', ratio: null, unread }
  }
  const ratio = contrastRatio(text, ground)
  return { pair, status: ratio >= pair.min ? 'pass' : 'fail', ratio, unread: [] }
}

// ---------------------------------------------------------------------------
// A look painted from the kept table, as THEME_BOOT_SCRIPT paints it
// ---------------------------------------------------------------------------

/** The script's `l[knob]` as a table key: the option a look that fits names for `knob`. */
function choiceOf(look: JsonRecord, knob: string): string {
  return String(own(look, knob))
}

/** One numeric rule's variable (boot.ts :148): the colour knob's rgb at look[knob] / scale, capped by its cap cell. */
function ruleEntry(rule: BootRule, look: JsonRecord): [string, string] {
  const alpha = Number(own(look, rule.knob)) / rule.scale
  const cap = rule.capTable === null ? alpha : rule.caps[choiceOf(look, rule.capTable[0])][choiceOf(look, rule.capTable[1])]
  return [rule.var, `rgba(${rule.color.rgb[choiceOf(look, rule.color.knob)]},${Math.min(alpha, cap)})`]
}

/**
 * What THEME_BOOT_SCRIPT sets for `look` from a table bootTable kept (boot.ts :145-:148): `look` when it
 * fits, else the defaults, and nothing when those don't fit either, as core's looks/paint.ts `paint`. The
 * script checks each name and value again as it sets it; a kept table's all pass, and every numeric rule it
 * keeps is `rgba-alpha`, the one template the script paints.
 */
export function firstPaint(table: BootTable, look: unknown): PaintedVars {
  const painted: JsonRecord = lookFits(table, look) ? (look as JsonRecord) : table.defaults
  if (!lookFits(table, painted)) return {}
  const cells = [
    ...Object.entries(table.knobs).map(([knob, options]) => options[choiceOf(painted, knob)]),
    ...table.pairs.map((pair) => pair.table[choiceOf(painted, pair.a)][choiceOf(painted, pair.b)]),
  ]
  const numeric = table.numeric.map((rule) => ruleEntry(rule, painted))
  return Object.fromEntries([...cells.flatMap((vars) => Object.entries(vars)), ...numeric])
}
