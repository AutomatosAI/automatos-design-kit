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
 * - `lookFits` is boot-sanitize.ts `lookFitsPrepaint` (:182-:186), the boot script's `fits` (boot.ts :140-:141).
 * - `paintLook` is mobile_tokens.py `paint_look` (:365-:371): the look when it fits, else the defaults
 *   whole (boot.ts :146); every knob table's entry, then every pair table's, a later one overwriting
 *   (:147-:148); a numeric rule's variable left out, since the web paints rgba() there last (:149); kept,
 *   as the table writes them, only the MOBILE_TOKEN_NAMES whose value is an "H S% L%" triplet.
 * - `missingTokens` is mobile_tokens.py `missing_tokens` (:374-:377).
 * - `parseColour` is mobile_tokens.py `parse_colour` (:114-:126): a token value as the #RRGGBB the phone
 *   reads (look-kit hsl.ts `tripletToHex` for a triplet, upper-cased for a #rrggbb), or null.
 * - `lookTone` is mobile_tokens.py `look_tone` (:389-:398), with `bootTone` (`_boot_tone` :283-:293, the
 *   table's tone rule as boot-sanitize.ts `sanitizeToneRule` keeps it) and `groundTone` (`ground_tone`
 *   :380-:386): the tone the phone answer places a fromLooks painting under (mobile.py `_look_colours`).
 *
 * `bootTable` and `lookFits` are the CLI's one port of boot-sanitize.ts: `check design` keeps and fits a
 * table with them too (src/check/contrast.ts), so each rule keeps its `scale`, which the phone never reads.
 * `bootValueProblem` is its value gate (`isCssValue`), saying why it drops a value: src/first-paint.ts refuses
 * a value it drops, and the browser harness paints only what it keeps (`isBootValue`).
 * `paintLook` is the server's paint, not the browser's: contrast.ts `firstPaint` is THEME_BOOT_SCRIPT's own
 * paint (boot.ts :146-:149), every variable it sets, numeric rules' rgba() included, which a design pair may
 * name; this keeps only the triplet Studio tokens a phone draws.
 *
 * Numbers are the doubles JSON.parse gives (contract.py `js_number` :227-:241): the table reaches here
 * through parseJson (json.ts), which is JSON.parse, so a 310-digit literal is already Infinity (not
 * finite) and 2**53 + 1 is already 2**53. Nothing here throws on a table or look of the wrong shape.
 */
import { relativeLuminance, toHex, type Rgb } from '@automatos/look-kit/contrast'
import { echo, hasOwn, isFiniteNumber, isRecord, own, type JsonRecord } from './core/css-value.ts'
import { isMobileColour, MOBILE_REQUIRED_TOKENS, MOBILE_TOKEN_NAMES } from './core/mobile-manifest.ts'

// boot-sanitize.ts :42-:64: the boot's own gate (smaller than css-value.ts's grammar), a look field's
// name, the option keys, the colour lists and the caps. A string's length counts UTF-16 units.
const CSS_VAR_NAME_PATTERN = /^--[a-z0-9-]{1,64}$/
export const CSS_VALUE_MAX_LENGTH = 200
const CSS_VALUE_CHARS = /^[A-Za-z0-9#%.,()/ +-]+$/
const CSS_FUNCTION_NAME = /([A-Za-z-]+)\(/g
export const CSS_VALUE_FUNCTIONS: ReadonlySet<string> = new Set([
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
const GRADIENT_SUFFIX = '-gradient'

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
  /** The rgba() alpha is look[knob] / scale: check design's first paint reads it (module comment). */
  readonly scale: number
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

/** The first function the gate doesn't run, said as what it is; null when it runs every one. */
function functionProblem(value: string): string | null {
  const names = Array.from(value.matchAll(CSS_FUNCTION_NAME), (match) => match[1])
  const name = names.find((found) => !CSS_VALUE_FUNCTIONS.has(found.toLowerCase()))
  if (name === undefined) return null
  if (name.toLowerCase().endsWith(GRADIENT_SUFFIX)) return `a gradient, ${echo(name)}()`
  return `a call to ${echo(name)}(), a function the first paint never runs`
}

/**
 * boot-sanitize.ts `isCssValue` (:92-:98), its checks in its order: text of 1 to 200 units, allowed characters,
 * balanced parentheses, allowed functions only. What `value` is that the gate drops, or null when it keeps it.
 */
export function bootValueProblem(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return 'not text'
  if (value.length > CSS_VALUE_MAX_LENGTH) return `over ${CSS_VALUE_MAX_LENGTH} characters`
  const refused = Array.from(value).find((char) => !CSS_VALUE_CHARS.test(char))
  if (refused !== undefined) return `text with "${echo(refused)}", a character the first paint refuses`
  if (value.split('(').length !== value.split(')').length) return "text whose brackets don't pair"
  return functionProblem(value)
}

/** True when the browser's first paint keeps `value` (boot-sanitize.ts `isCssValue`). */
export function isBootValue(value: unknown): value is string {
  return bootValueProblem(value) === null
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
  return caps === null || color === null ? null : { var: name, knob, min, max, integer, scale, ...caps, color }
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

/** mobile_tokens.py `_phone_tokens` (:351-:362): boot.ts :147-:149 for a look that fits, phone tokens only. */
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

// ---- a colour as the phone reads it, and the tone a painting is drawn in ----

// hsl.ts: degrees and percents, the channel scale and hslToHex's twelve hue steps.
const FULL_TURN = 360
const PERCENT = 100
const CHANNEL_MAX = 255
const HUE_STEPS = 12
const TONE_LIGHT = 'light'
const TONE_DARK = 'dark'
const TONE_FROM_LOOK = 'from-look'
const TONE_RULE_KEY = 'tone'

export type PhoneTone = typeof TONE_LIGHT | typeof TONE_DARK
/** mobile_tokens.py MOBILE_DEFAULT_TONE: a painting with no ground or no text is drawn light. */
export const MOBILE_DEFAULT_TONE: PhoneTone = TONE_LIGHT

/** hsl.ts `hslToHex` (mobile_tokens.py `_hsl_to_hex` :102-:111), step for step, so both give the same channels. */
function hslToHex(hue: number, saturation: number, lightness: number): string {
  const sat = saturation / PERCENT
  const light = lightness / PERCENT
  const chroma = (1 - Math.abs(2 * light - 1)) * sat
  const channel = (offset: number): number => {
    const k = (offset + hue / (FULL_TURN / HUE_STEPS)) % HUE_STEPS
    return Math.round((light - chroma / 2 * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * CHANNEL_MAX)
  }
  const rgb: Rgb = [channel(0), channel(8), channel(4)]
  return toHex(rgb)
}

/** mobile_tokens.py `parse_colour`: a mobile token value as #RRGGBB when it is a triplet or a #rrggbb, else null. */
export function parseColour(value: unknown): string | null {
  if (!isMobileColour(value)) return null
  if (value.startsWith(HEX_MARK)) return value.toUpperCase()
  const [hue, saturation, lightness] = value.replaceAll('%', '').split(' ').map(Number)
  return hslToHex(hue, saturation, lightness)
}

/** A prepaint table's tone rule as the boot keeps it. */
export interface BootTone {
  readonly knob: string
  readonly values: Readonly<Record<string, PhoneTone>>
}

const isTone = (value: unknown): value is PhoneTone => value === TONE_LIGHT || value === TONE_DARK

/** `_boot_tone`: a choice knob of the kept table (no numeric rule's), every one of its choices given a tone; else null. */
export function bootTone(raw: unknown, table: BootTable): BootTone | null {
  const knob = isRecord(raw) ? own(raw, 'knob') : undefined
  const values = isRecord(raw) ? own(raw, 'values') : undefined
  if (typeof knob !== 'string' || !isRecord(values) || !hasOwn(table.knobs, knob)) return null
  if (table.numeric.some((rule) => rule.knob === knob)) return null
  const choices = Object.keys(table.knobs[knob])
  const mapped = choices.flatMap((choice): [string, PhoneTone][] => {
    const tone = hasOwn(values, choice) ? values[choice] : undefined
    return isTone(tone) ? [[choice, tone]] : []
  })
  return choices.length > 0 && mapped.length === choices.length ? { knob, values: Object.fromEntries(mapped) } : null
}

/** `ground_tone` (look-kit css.ts `isDarkGround`): dark when --background is darker than --foreground, else light. */
export function groundTone(tokens: unknown): PhoneTone {
  const given: JsonRecord = isRecord(tokens) ? tokens : {}
  const ground = parseColour(own(given, '--background'))
  const text = parseColour(own(given, '--foreground'))
  if (ground === null || text === null) return MOBILE_DEFAULT_TONE
  return relativeLuminance(ground) < relativeLuminance(text) ? TONE_DARK : TONE_LIGHT
}

/**
 * `look_tone`: the tone `paintLook(prepaint, look)` is drawn in. theme.json's fixed light or dark wins; under
 * from-look the table's tone rule at the painted look's choice; else (no rule, or the user's tone policy, which a
 * phone has no cookie for) the painted ground's; light for a table the web drops.
 */
export function lookTone(prepaint: unknown, look: unknown, manifestTone: unknown): PhoneTone {
  if (isTone(manifestTone)) return manifestTone
  const table = bootTable(prepaint)
  if (table === null) return MOBILE_DEFAULT_TONE
  const painted: JsonRecord = lookFits(table, look) ? (look as JsonRecord) : table.defaults
  const rule = manifestTone === TONE_FROM_LOOK && isRecord(prepaint) ? bootTone(own(prepaint, TONE_RULE_KEY), table) : null
  if (rule !== null) return rule.values[String(own(painted, rule.knob))]
  return groundTone(phoneTokens(table, painted))
}
