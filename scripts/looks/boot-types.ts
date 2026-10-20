/**
 * The shape of a theme's first-paint table (`boot/prepaint.json`), as core's boot script reads it.
 *
 * Copied from core (AutomatosAI/automatos-ai) `frontend/lib/theme-host/boot-types.ts` at commit
 * ebedc7eb8d7f7f9d032706728a7f420a9e833392: the prepaint types only (lines 11-56), unchanged. The rest of
 * that file types the host's boot resolver, which the kit never builds.
 */

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
 * Everything the boot script may paint for a look, keyed the way it reads a stored look: each
 * knob's table, the pair tables, the numeric rules, and the default look painted when nothing
 * valid is stored.
 */
export interface PrepaintTable {
  readonly knobs: Readonly<Record<string, PrepaintKnobTable>>
  readonly pairs: readonly PrepaintPair[]
  readonly numeric: readonly PrepaintNumericRule[]
  readonly defaults: Readonly<Record<string, string | number>>
}
