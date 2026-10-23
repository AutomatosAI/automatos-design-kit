/**
 * What a phone paints from a theme's prepaint table: the web's first paint of a look, kept to the
 * Studio tokens a phone draws (the `mobile` block's `fromLooks`, host 1.1.0).
 *
 * A port of core's reader rule, from the commit src/core/README.md names. The phone shows exactly what
 * the web paints first, so a look is painted here the way the web's boot paints it:
 *
 * - `bootTable` is frontend/lib/theme-host/boot-sanitize.ts `sanitizePrepaint` (:217-:234; Python twin
 *   orchestrator/services/themes/mobile_tokens.py `boot_table` :296-:306): the table as every installed
 *   boot gets it, or null when its defaults don't fit what is left (:231), and the web then paints
 *   nothing from it. Its tone rule (:232) is left out: it never changes what is painted, only the tone a
 *   phone is drawn in, which the reader doesn't decide.
 * - `lookFits` is boot-sanitize.ts `lookFitsPrepaint` (:182-:186), the boot script's `fits` (boot.ts :158-:159).
 * - `paintLook` is mobile_tokens.py `paint_look` (:365-:371): the look when it fits, else the defaults
 *   whole (boot.ts :164); every knob table's entry, then every pair table's, a later one overwriting
 *   (:165-:166); a numeric rule's variable left out, since the web paints rgba() there last (:167); kept,
 *   as the table writes them, only the MOBILE_TOKEN_NAMES whose value is an "H S% L%" triplet.
 * - `missingTokens` is mobile_tokens.py `missing_tokens` (:374-:377).
 *
 * Numbers are the doubles JSON.parse gives (contract.py `js_number` :225-:239): the table reaches here
 * through parseJson (json.ts), which is JSON.parse, so a 310-digit literal is already Infinity (not
 * finite) and 2**53 + 1 is already 2**53. Nothing here throws on a table or look of the wrong shape.
 */
import { hasOwn, isFiniteNumber, isRecord, own, type JsonRecord } from './core/css-value.ts'
import { isMobileColour, MOBILE_REQUIRED_TOKENS, MOBILE_TOKEN_NAMES } from './core/mobile-manifest.ts'

// boot-sanitize.ts :42-:64: the boot's own gate (smaller than css-value.ts's grammar), a look field's
// name, the option keys, the colour lists and the caps. A string's length counts UTF-16 units.
const CSS_VAR_NAME_PATTERN = /^--[a-z0-9-]{1,64}$/
const CSS_VALUE_MAX_LENGTH = 200
const CSS_VALUE_CHARS = /^[A-Za-z0-9#%.,()/ +-]+$/
const CSS_FUNCTION_NAME = /([A-Za-z-]+)\(/g
const CSS_VALUE_FUNCTIONS: ReadonlySet<string> = new Set([
  'rgb', 'rgba', 'hsl', 'hsla', 'var', 'calc', 'min', 'max', 'clamp',
  'hue-rotate', 'saturate', 'brightness', 'grayscale', 'contrast', 'sepia', 'invert',
])
const KNOB_NAME = /^[A-Za-z][A-Za-z0-9_]{0,31}$/
const OPTION_KEY_MAX_LENGTH = 64
const RGB_LIST = /^[0-9]{1,3},[0-9]{1,3},[0-9]{1,3}$/
const CAP_MIN = 0
const CAP_MAX = 1
const NUMERIC_TEMPLATE = 'rgba-alpha'
const HEX_MARK = '#'

type Table<V> = Readonly<Record<string, V>>
export type BootVars = Table<string>

export interface BootPair {
  readonly a: string
  readonly b: string
  readonly table: Table<Table<BootVars>>
}

export interface BootRule {
  readonly var: string
  readonly knob: string
  readonly min: number
  readonly max: number
  readonly integer: boolean
  readonly capTable: readonly [string, string] | null
  readonly caps: Table<Table<number>>
  readonly color: { readonly knob: string; readonly rgb: Table<string> }
}

export interface BootTable {
  readonly knobs: Table<Table<BootVars>>
  readonly pairs: readonly BootPair[]
  readonly numeric: readonly BootRule[]
  readonly defaults: Table<string | number>
}

function isKnob(name: unknown): name is string {
  return typeof name === 'string' && KNOB_NAME.test(name)
}

function list(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : []
}

/** boot-sanitize.ts `isCssValue` (:92-:98): allowed characters, balanced parentheses, allowed functions only. */
function isBootValue(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > CSS_VALUE_MAX_LENGTH) return false
  if (!CSS_VALUE_CHARS.test(value)) return false
  if (value.split('(').length !== value.split(')').length) return false
  const names = Array.from(value.matchAll(CSS_FUNCTION_NAME), (match) => match[1].toLowerCase())
  return names.every((name) => CSS_VALUE_FUNCTIONS.has(name))
}

/** `sanitizeVars` (:105-:112): the variables whose name and value the boot passes; never null. */
function bootVars(vars: unknown): BootVars {
  if (!isRecord(vars)) return {}
  return Object.fromEntries(Object.entries(vars).filter(
    (entry): entry is [string, string] => CSS_VAR_NAME_PATTERN.test(entry[0]) && isBootValue(entry[1]),
  ))
}

/** `sanitizeTable` (:115-:123): the keys of 1 to 64 units, each with `clean`'s value; null drops the key. */
function optionTable<V>(table: unknown, clean: (value: unknown) => V | null): Table<V> {
  if (!isRecord(table)) return {}
  return Object.fromEntries(Object.entries(table).flatMap(([key, value]): [string, V][] => {
    const cleaned = key.length > 0 && key.length <= OPTION_KEY_MAX_LENGTH ? clean(value) : null
    return cleaned === null ? [] : [[key, cleaned]]
  }))
}

/** `sanitizePairTable` (:129-:131): rows of cells, each through `optionTable`. */
function pairTable<V>(table: unknown, clean: (value: unknown) => V | null): Table<Table<V>> {
  return optionTable(table, (row) => optionTable(row, clean))
}

/** `sanitizePair` (:133-:137): both knobs look fields; null drops the pair. */
function bootPair(raw: unknown): BootPair | null {
  if (!isRecord(raw)) return null
  const a = own(raw, 'a')
  const b = own(raw, 'b')
  return isKnob(a) && isKnob(b) ? { a, b, table: pairTable(own(raw, 'table'), bootVars) } : null
}

/** `sanitizeCap` (:125-:127): a cap is an alpha. */
function bootCap(value: unknown): number | null {
  return isFiniteNumber(value) && value >= CAP_MIN && value <= CAP_MAX ? value : null
}

/** `sanitizeCapTable` (:139-:146): `capTable` given as null (no caps) or two look fields; absent drops the rule. */
function bootCaps(rule: JsonRecord): Pick<BootRule, 'capTable' | 'caps'> | null {
  const knobs = own(rule, 'capTable')
  if (knobs === null) return { capTable: null, caps: {} }
  if (!Array.isArray(knobs) || knobs.length !== 2) return null
  const [row, column] = knobs as unknown[]
  return isKnob(row) && isKnob(column) ? { capTable: [row, column], caps: pairTable(own(rule, 'caps'), bootCap) } : null
}

/** `sanitizeColor` (:148-:152): a look field and its rgb lists. */
function bootColor(color: unknown): BootRule['color'] | null {
  if (!isRecord(color)) return null
  const knob = own(color, 'knob')
  if (!isKnob(knob)) return null
  return { knob, rgb: optionTable(own(color, 'rgb'), (value) => (typeof value === 'string' && RGB_LIST.test(value) ? value : null)) }
}

/** `sanitizeNumericRule` (:154-:164): a rule with every field the boot script reads; null drops it. */
function bootRule(raw: unknown): BootRule | null {
  if (!isRecord(raw) || own(raw, 'template') !== NUMERIC_TEMPLATE) return null
  const name = own(raw, 'var')
  const knob = own(raw, 'knob')
  const integer = own(raw, 'integer')
  if (typeof integer !== 'boolean' || typeof name !== 'string' || !CSS_VAR_NAME_PATTERN.test(name) || !isKnob(knob)) return null
  const min = own(raw, 'min')
  const max = own(raw, 'max')
  const scale = own(raw, 'scale')
  if (!isFiniteNumber(min) || !isFiniteNumber(max) || !isFiniteNumber(scale) || min > max || scale <= 0) return null
  const caps = bootCaps(raw)
  const color = bootColor(own(raw, 'color'))
  return caps === null || color === null ? null : { var: name, knob, min, max, integer, ...caps, color }
}

/** `sanitizeDefaults` (:188-:195): look fields whose value is text or a finite number. */
function bootDefaults(defaults: unknown): Table<string | number> {
  if (!isRecord(defaults)) return {}
  return Object.fromEntries(Object.entries(defaults).filter(
    (entry): entry is [string, string | number] => KNOB_NAME.test(entry[0]) && (typeof entry[1] === 'string' || isFiniteNumber(entry[1])),
  ))
}

/** The prepaint table as the boot script gets it, or null when the web paints nothing from it (module comment). */
export function bootTable(prepaint: unknown): BootTable | null {
  if (!isRecord(prepaint)) return null
  const knobs = own(prepaint, 'knobs')
  const table: BootTable = {
    knobs: Object.fromEntries(Object.entries(isRecord(knobs) ? knobs : {})
      .filter(([knob]) => KNOB_NAME.test(knob))
      .map(([knob, options]): [string, Table<BootVars>] => [knob, optionTable(options, bootVars)])),
    pairs: list(own(prepaint, 'pairs')).map(bootPair).filter((pair): pair is BootPair => pair !== null),
    numeric: list(own(prepaint, 'numeric')).map(bootRule).filter((rule): rule is BootRule => rule !== null),
    defaults: bootDefaults(own(prepaint, 'defaults')),
  }
  return lookFits(table, table.defaults) ? table : null
}

/** boot.ts `has`, boot-sanitize.ts `hasKey` (:166-:168): `key` is text and an own key of the object `table`. */
function hasKey(table: unknown, key: unknown): key is string {
  return isRecord(table) && typeof key === 'string' && hasOwn(table, key)
}

/** `numericFits` (:170-:179): a finite number in range (whole when `integer`), a colour, and a cap cell when capped. */
function ruleFits(rule: BootRule, look: JsonRecord): boolean {
  const value = own(look, rule.knob)
  if (!isFiniteNumber(value) || value < rule.min || value > rule.max) return false
  if (rule.integer && value % 1 !== 0) return false
  if (!hasKey(rule.color.rgb, own(look, rule.color.knob))) return false
  if (rule.capTable === null) return true
  const [rowKnob, columnKnob] = rule.capTable
  const row = own(look, rowKnob)
  return hasKey(rule.caps, row) && hasKey(rule.caps[row], own(look, columnKnob))
}

/** `lookFitsPrepaint`: the look names an option of every knob table and a cell of every pair table, and fits every numeric rule. */
export function lookFits(table: BootTable, look: unknown): boolean {
  if (!isRecord(look)) return false
  const record: JsonRecord = look
  const knobs = Object.entries(table.knobs).every(([knob, options]) => hasKey(options, own(record, knob)))
  const pairs = table.pairs.every((pair) => {
    const row = own(record, pair.a)
    return hasKey(pair.table, row) && hasKey(pair.table[row], own(record, pair.b))
  })
  return knobs && pairs && table.numeric.every((rule) => ruleFits(rule, record))
}

/**
 * mobile_tokens.py `is_studio_triplet` (:129-:131): an "H S% L%" triplet the phone reads, the one form
 * the web paints a Studio token in (it reads them as hsl(var(--x)), so a #rrggbb paints nothing). A
 * #rrggbb starts with '#' and a triplet with a digit, so isMobileColour without the hex is the triplet test.
 */
export function isStudioTriplet(value: unknown): boolean {
  return typeof value === 'string' && !value.startsWith(HEX_MARK) && isMobileColour(value)
}

/** mobile_tokens.py `_phone_tokens` (:351-:362): boot.ts :165-:167 for a look that fits, phone tokens only. */
function phoneTokens(table: BootTable, look: JsonRecord): BootVars {
  const cells: BootVars[] = [
    ...Object.entries(table.knobs).map(([knob, options]) => options[String(own(look, knob))]),
    ...table.pairs.map((pair) => pair.table[String(own(look, pair.a))][String(own(look, pair.b))]),
  ]
  const painted = Object.fromEntries(cells.flatMap((vars) => Object.entries(vars)))
  const glows = new Set(table.numeric.map((rule) => rule.var))
  return Object.fromEntries(Object.entries(painted).filter(
    ([name, value]) => MOBILE_TOKEN_NAMES.includes(name) && !glows.has(name) && isStudioTriplet(value),
  ))
}

/**
 * What the web paints for `look` through the prepaint table, as `{mobile token: value}`: `look` null (or
 * any look that doesn't fit) paints the table's defaults, and a table the web drops paints nothing.
 */
export function paintLook(prepaint: unknown, look: unknown = null): BootVars {
  const table = bootTable(prepaint)
  if (table === null) return {}
  return phoneTokens(table, lookFits(table, look) ? (look as JsonRecord) : table.defaults)
}

/** The MOBILE_REQUIRED_TOKENS that `tokens` gives no colour: a phone can't draw it without them. */
export function missingTokens(tokens: JsonRecord): string[] {
  return MOBILE_REQUIRED_TOKENS.filter((name) => !isMobileColour(own(tokens, name)))
}
