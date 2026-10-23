/**
 * The kit's contrast measure (PRD-261 B-03d): a look painted from its theme's first-paint table, and
 * a text colour on a ground colour of that painting, by the WCAG 2.x ratio.
 *
 * - `lookFits` and `paintLook` port what the host's first paint does with `boot/prepaint.json`, at
 *   the core commit src/core/README.md names: `THEME_BOOT_SCRIPT` in frontend/lib/theme-host/boot.ts
 *   (`fits`, then every knob table's entry, then every pair table's, a later one overwriting, then
 *   each numeric rule's `rgba()`), with `lookFitsPrepaint` of boot-sanitize.ts for the fit. A look
 *   that does not fit is never painted: the host paints the table's defaults instead.
 * - The ratio is the look runtime's own math, never a copy: `contrastRatio` of look-kit contrast.ts,
 *   in Play's copy of core's frontend/lib/look-kit. A painted value is read as the browser draws it:
 *   `#rrggbb` as it is, and a Studio triplet `H S% L%` (or the triplet wrapped as `hsl(...)`, as
 *   Studio's aliases are) back to #RRGGBB with look-kit hsl.ts `tripletToHex`, as Play's own
 *   contrast.test.ts measures them. Anything else (`rgba()`, `var()`, a word) is not a colour this reads.
 *
 * Play's look-kit modules import each other without a file extension, as a bundler allows. Node, which
 * runs this command, needs the extension, so hsl.ts is loaded once through a resolve hook that adds
 * `.ts` to an extensionless `./name` import made from inside the look-kit folder, and nowhere else
 * (scripts/compile-looks.mjs does the same for Play's build). contrast.ts imports nothing, so it is
 * imported directly.
 *
 * `check design` measures a theme's declared pairs (design/contrast.json) on each preset with these;
 * the `mobile` block's pairs (core's M-03) can be measured through the same functions.
 */
import { registerHooks, type ResolveHookSync } from 'node:module'
import { AA_TEXT, contrastRatio } from '../../../../themes/play/src/lib/look-kit/contrast.ts'
import { own, type JsonRecord } from '../core/css-value.ts'

type LookKitHsl = typeof import('../../../../themes/play/src/lib/look-kit/hsl.ts')

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

const LOOK_KIT = new URL('../../../../themes/play/src/lib/look-kit/', import.meta.url)
const TS_EXTENSION = '.ts'
const SIBLING_PREFIX = './'
const HAS_EXTENSION = /\.[A-Za-z0-9]+$/
const HEX_COLOUR = /^#[0-9a-f]{6}$/i
const WRAPPED_TRIPLET = /^hsl\((.+)\)$/
/** The boot script's custom property gate (boot.ts `V`). */
const BOOT_VAR_NAME = /^--[a-z0-9-]{1,64}$/
const NUMERIC_TEMPLATE = 'rgba-alpha'

/** True for `./name` with no extension, from a module inside the look-kit folder. */
function isLookKitSibling(specifier: string, parentURL: string | undefined): boolean {
  if (parentURL === undefined || !parentURL.startsWith(LOOK_KIT.href) || !specifier.startsWith(SIBLING_PREFIX)) return false
  return !HAS_EXTENSION.test(specifier.slice(specifier.lastIndexOf('/') + 1))
}

const resolveLookKit: ResolveHookSync = (specifier, context, nextResolve) => (
  nextResolve(isLookKitSibling(specifier, context.parentURL) ? `${specifier}${TS_EXTENSION}` : specifier, context)
)

let hslModule: Promise<LookKitHsl> | null = null

/** look-kit hsl.ts, loaded once, the resolve hook registered first (Node 22.15 and later; the CLI needs 22.18). */
function lookKitHsl(): Promise<LookKitHsl> {
  if (hslModule === null) {
    registerHooks({ resolve: resolveLookKit })
    hslModule = import('../../../../themes/play/src/lib/look-kit/hsl.ts')
  }
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
// A look painted from boot/prepaint.json, as the host's first paint paints it
// ---------------------------------------------------------------------------

/** The boot script's `obj`: any object, arrays included. */
function isObject(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null
}

/** `record[key]` when `record` is an object with `key` (a string) as its own key, else undefined. */
function at(record: unknown, key: unknown): unknown {
  if (!isObject(record) || typeof key !== 'string') return undefined
  return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined
}

function has(record: unknown, key: unknown): boolean {
  return isObject(record) && typeof key === 'string' && Object.prototype.hasOwnProperty.call(record, key)
}

function list(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : []
}

function knobNames(table: unknown): readonly string[] {
  const knobs = at(table, 'knobs')
  return isObject(knobs) ? Object.keys(knobs) : []
}

/** The cell of a two-knob table the look names: `table[look[a]][look[b]]`. */
function cellOf(table: unknown, look: JsonRecord, a: unknown, b: unknown): unknown {
  return at(at(table, at(look, a)), at(look, b))
}

/** boot.ts `num` (boot-sanitize.ts `numericFits`): the knob in range, its colour known, its cap found. */
function numericFits(rule: unknown, look: JsonRecord): boolean {
  if (!isObject(rule)) return false
  const value = at(look, at(rule, 'knob'))
  if (typeof value !== 'number' || !(value >= Number(at(rule, 'min')) && value <= Number(at(rule, 'max')))) return false
  if (Boolean(at(rule, 'integer')) && value % 1 !== 0) return false
  const color = at(rule, 'color')
  if (!has(at(color, 'rgb'), at(look, at(color, 'knob')))) return false
  const capTable = at(rule, 'capTable')
  if (!capTable) return true
  const [row, column] = list(capTable)
  return has(at(rule, 'caps'), at(look, row)) && has(at(at(rule, 'caps'), at(look, row)), at(look, column))
}

/** boot.ts `fits`: the look names an option of every knob table and a cell of every pair table, and fits every numeric rule. */
export function lookFits(table: unknown, look: unknown): boolean {
  if (!isObject(look)) return false
  const knobs = at(table, 'knobs')
  const knobsFit = knobNames(table).every((knob) => has(at(knobs, knob), at(look, knob)))
  const pairsFit = list(at(table, 'pairs')).every((pair) => (
    isObject(pair) && has(at(pair, 'table'), at(look, at(pair, 'a')))
    && has(at(at(pair, 'table'), at(look, at(pair, 'a'))), at(look, at(pair, 'b')))
  ))
  return knobsFit && pairsFit && list(at(table, 'numeric')).every((rule) => numericFits(rule, look))
}

/** boot.ts `put`: the custom properties of one table entry the boot sets. */
function varEntries(vars: unknown): Array<[string, string]> {
  if (!isObject(vars)) return []
  return Object.keys(vars).flatMap((name): Array<[string, string]> => {
    const value = vars[name]
    return BOOT_VAR_NAME.test(name) && typeof value === 'string' ? [[name, value]] : []
  })
}

/** One numeric rule's variable: the colour knob's rgb at look[knob] / scale, capped by the cap table. */
function numericEntry(rule: unknown, look: JsonRecord): Array<[string, string]> {
  const name = at(rule, 'var')
  if (at(rule, 'template') !== NUMERIC_TEMPLATE || typeof name !== 'string' || !BOOT_VAR_NAME.test(name)) return []
  const alpha = Number(at(look, at(rule, 'knob'))) / Number(at(rule, 'scale'))
  const [row, column] = list(at(rule, 'capTable'))
  const capped = at(rule, 'capTable') ? Math.min(alpha, Number(cellOf(at(rule, 'caps'), look, row, column))) : alpha
  const color = at(rule, 'color')
  return [[name, `rgba(${String(at(at(color, 'rgb'), at(look, at(color, 'knob'))))},${capped}`]]
}

/** What the first paint sets for a look that fits the table (lookFits): knob entries, pair entries, numeric rules. */
export function paintLook(table: unknown, look: JsonRecord): PaintedVars {
  const knobs = at(table, 'knobs')
  const fromKnobs = knobNames(table).map((knob) => at(at(knobs, knob), at(look, knob)))
  const fromPairs = list(at(table, 'pairs')).map((pair) => cellOf(at(pair, 'table'), look, at(pair, 'a'), at(pair, 'b')))
  const numeric = list(at(table, 'numeric')).flatMap((rule) => numericEntry(rule, look))
  return Object.fromEntries([...[...fromKnobs, ...fromPairs].flatMap(varEntries), ...numeric])
}
