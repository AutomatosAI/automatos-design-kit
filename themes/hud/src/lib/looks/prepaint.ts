import { ACCENTS, ACCENT_KEYS, FONT_KEYS, GROUND_KEYS, type GroundKey } from './catalogue'
import { isDarkGround, rgbList, safeGlowAlpha } from './engine'
import { DEFAULT_LOOK } from './presets'
import {
  GLOW_MAX,
  GLOW_MIN,
  GLOW_SCALE,
  GRID_MAX,
  GRID_MIN,
  GRID_SCALE,
  SWITCH_CHOICES,
  SWITCH_KNOBS,
  type KnobName,
  type SwitchKnobName,
} from './types'
import { accentVars, fontVars, GLOW_VAR, GRID_VAR, groundVars, pairVars, switchVars, type CssVars } from './vars'

/**
 * The package's first paint (boot/prepaint.json) as data, built from the catalogue through the same builders
 * as vars.ts, so the two never drift. The host's boot script paints the stored active look from it onto
 * <html> before any of HUD's code runs, and its look runtime repaints from it when the look changes: each
 * choice knob's variables, the ground and accent pair's, then the grid and the glow as numeric rules (the glow
 * capped where the page's text would drop under AA). Its tone rule makes every ground dark (`"tone":
 * "from-look"` in theme.json): HUD is never light.
 *
 * boot/prepaint.json is committed, not built: test/look-data.test.ts holds the file equal to this table. The
 * shapes below are the host's table types (core's frontend/lib/theme-host/boot-types.ts, host 1.1.0), as the
 * kit's scripts/looks/boot-types.ts copies them; HUD's source can't import from outside src/, so they are
 * written out again here.
 */

export type Tone = 'light' | 'dark'

export interface PrepaintPair {
  readonly a: string
  readonly b: string
  readonly table: Readonly<Record<string, Readonly<Record<string, CssVars>>>>
}

export interface PrepaintNumericRule {
  readonly var: string
  readonly knob: string
  readonly min: number
  readonly max: number
  readonly integer: boolean
  readonly scale: number
  readonly capTable: readonly [string, string] | null
  readonly caps: Readonly<Record<string, Readonly<Record<string, number>>>> | null
  readonly color: { readonly knob: string; readonly rgb: Readonly<Record<string, string>> }
  readonly template: 'rgba-alpha'
}

export interface PrepaintTable {
  readonly knobs: Readonly<Record<string, Readonly<Record<string, CssVars>>>>
  readonly pairs: readonly PrepaintPair[]
  readonly numeric: readonly PrepaintNumericRule[]
  readonly defaults: Readonly<Record<string, string | number>>
  readonly tone: { readonly knob: string; readonly values: Readonly<Record<string, Tone>> }
}

const GROUND: KnobName = 'ground'
const ACCENT: KnobName = 'accent'

function table<K extends string, V>(keys: readonly K[], value: (key: K) => V): Readonly<Record<string, V>> {
  return Object.fromEntries(keys.map((key) => [key, value(key)]))
}

function switchTable(knob: SwitchKnobName): Readonly<Record<string, CssVars>> {
  return table(SWITCH_CHOICES, (choice) => switchVars(knob, choice))
}

/** Every choice knob's options, in looks/schema.json's order. */
function knobTables(): PrepaintTable['knobs'] {
  return {
    accent: table(ACCENT_KEYS, accentVars),
    ground: table(GROUND_KEYS, groundVars),
    font: table(FONT_KEYS, fontVars),
    ...Object.fromEntries(SWITCH_KNOBS.map((knob) => [knob, switchTable(knob)])),
  }
}

function accentRgb(): Readonly<Record<string, string>> {
  return table(ACCENT_KEYS, (key) => rgbList(ACCENTS[key].hex))
}

function gridRule(): PrepaintNumericRule {
  return {
    var: GRID_VAR, knob: 'grid', min: GRID_MIN, max: GRID_MAX, integer: true, scale: GRID_SCALE,
    capTable: null, caps: null, color: { knob: ACCENT, rgb: accentRgb() }, template: 'rgba-alpha',
  }
}

function glowRule(): PrepaintNumericRule {
  const caps = table(GROUND_KEYS, (ground) => table(ACCENT_KEYS, (accent) => safeGlowAlpha(ground, accent)))
  return {
    var: GLOW_VAR, knob: 'glow', min: GLOW_MIN, max: GLOW_MAX, integer: true, scale: GLOW_SCALE,
    capTable: [GROUND, ACCENT], caps, color: { knob: ACCENT, rgb: accentRgb() }, template: 'rgba-alpha',
  }
}

function toneOf(key: GroundKey): Tone {
  return isDarkGround(key) ? 'dark' : 'light'
}

/** The default look's value for every knob. */
function defaults(): PrepaintTable['defaults'] {
  const { accent, ground, font, grid, glow, scan, auto, motion } = DEFAULT_LOOK
  return { accent, ground, font, grid, glow, scan, auto, motion }
}

/** boot/prepaint.json. */
export function hudPrepaintTable(): PrepaintTable {
  return {
    knobs: knobTables(),
    pairs: [{ a: GROUND, b: ACCENT, table: table(GROUND_KEYS, (ground) => table(ACCENT_KEYS, (accent) => pairVars(ground, accent))) }],
    numeric: [gridRule(), glowRule()],
    defaults: defaults(),
    tone: { knob: GROUND, values: table(GROUND_KEYS, toneOf) },
  }
}
