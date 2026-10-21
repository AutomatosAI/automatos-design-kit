/**
 * The shape of a theme's first-paint table (`boot/prepaint.json`), its tone rule, and the presets the
 * running boot carries, as core's boot reads them (host 1.1.0).
 *
 * Copied from core (AutomatosAI/automatos-ai) `frontend/lib/theme-host/boot-types.ts` at commit
 * 0dd8b846e41772c8dd7ef159e4373bcb9419b06a: the tone and prepaint types (lines 8-69) and the boot's
 * presets (lines 86-101), unchanged but for ThemeBootLooks's comment, which drops a planning document's
 * section number. The rest of that file types the host's boot resolver, which the kit never builds.
 */

/** The tone next-themes is forced to from the first paint, when the theme sets one. */
export type ThemeTone = 'light' | 'dark'

/** Custom property name → value, applied with style.setProperty only. */
export type PrepaintVars = Readonly<Record<string, string>>

/** One knob's options (a look's field value → the variables it paints). */
export type PrepaintKnobTable = Readonly<Record<string, PrepaintVars>>

/** Two knobs' values → a value, read as table[look[a]][look[b]]. */
export type PrepaintPairTable<V> = Readonly<Record<string, Readonly<Record<string, V>>>>

/** Variables that depend on two knobs at once (Play: the accent's text on each ground). */
export interface PrepaintPair {
  readonly a: string
  readonly b: string
  readonly table: PrepaintPairTable<PrepaintVars>
}

/**
 * A numeric knob painted as data, not script. With the 'rgba-alpha' template the variable is
 * `rgba(<color.rgb[look[color.knob]]>,<alpha>)`, where alpha = look[knob] / scale, capped at
 * caps[look[capTable[0]]][look[capTable[1]]] when capTable is set (Play's glow: never past the
 * ground and accent's safe glow, M50).
 */
export interface PrepaintNumericRule {
  readonly var: string
  readonly knob: string
  readonly min: number
  readonly max: number
  readonly integer: boolean
  readonly scale: number
  readonly capTable: readonly [string, string] | null
  readonly caps: PrepaintPairTable<number> | null
  readonly color: { readonly knob: string; readonly rgb: Readonly<Record<string, string>> }
  readonly template: 'rgba-alpha'
}

/**
 * PRD-261 A-19c (host 1.1.0) — the tone each choice of one choice knob gives a look
 * (boot/prepaint.json `tone`), so a look runtime sets the tone from the look alone (A-19d2).
 * The server refuses a rule whose knob is not a choice knob of the table or that leaves a
 * choice without 'light' or 'dark' (css_value.py tone_rule_errors; css-value.ts toneRuleErrors).
 */
export interface PrepaintToneRule {
  readonly knob: string
  readonly values: Readonly<Record<string, ThemeTone>>
}

/**
 * Everything the boot script may paint for a look, keyed the way it reads a stored look: each
 * knob's table, the pair tables, the numeric rules, and the default look painted when nothing
 * valid is stored. `tone` (A-19c) is absent when the table sets no tone; the boot script never
 * reads it.
 */
export interface PrepaintTable {
  readonly knobs: Readonly<Record<string, PrepaintKnobTable>>
  readonly pairs: readonly PrepaintPair[]
  readonly numeric: readonly PrepaintNumericRule[]
  readonly defaults: Readonly<Record<string, string | number>>
  readonly tone?: PrepaintToneRule
}

/**
 * PRD-261 A-19c — one preset as the boot carries it: a look document of the theme's format
 * (`{schema, interface?, id, name, sub, <every knob>}`), checked by the server against the
 * theme's looks/schema.json.
 */
export type ThemeBootPreset = Readonly<Record<string, string | number>>

/**
 * PRD-261 A-19c (host 1.1.0) — a theme's presets, from its looks/presets/*.look.json:
 * the default look first (`defaultLook` is its id), the rest in file-name order, at most
 * BOOT_PRESETS_MAX of at most BOOT_PRESET_MAX_BYTES each (boot-sanitize.ts).
 */
export interface ThemeBootLooks {
  readonly defaultLook: string
  readonly presets: readonly ThemeBootPreset[]
}
