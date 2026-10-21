/**
 * Play's look data as package files (PRD-261 A-16c), built from Play's own modules:
 *
 * - `looks/schema.json`: the look format and its knobs. The knobs are PLAY_LOOK_SPEC's (lib/looks/engine.ts:
 *   the catalogue's keys as each choice knob's choices, the glow's range from lib/looks/types.ts), each
 *   with the default look's value. It is core's `orchestrator/services/themes/data/play-look-schema.json`,
 *   which core keeps for builtin Play until this file ships (tests/compile-looks.test.ts holds the two equal).
 * - `looks/presets/<id>.look.json`: each of Play's presets (lib/looks/presets.ts), as Play stores a look.
 * - `boot/prepaint.json`: the first-paint table, from core's builder (play-prepaint.ts here): every
 *   catalogue entry's variables, the accent-on-ground pairs, and the glow as a numeric-knob rule; plus
 *   the tone rule (host 1.1.0, PRD-261 A-19c): each ground's tone, as lib/looks/tone.ts toneOfGround gives
 *   it, so the host's generic look runtime sets the tone from the look alone, as builtin Play does.
 *
 * Pure functions plus one writer; scripts/compile-looks.mjs runs the writer from Play's build.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { GROUND_KEYS } from '../../themes/play/src/lib/looks/catalogue.ts'
import { PLAY_LOOK_SPEC } from '../../themes/play/src/lib/looks/engine.ts'
import { DEFAULT_LOOK, PRESETS } from '../../themes/play/src/lib/looks/presets.ts'
import { toneOfGround } from '../../themes/play/src/lib/looks/tone.ts'
import type { Look } from '../../themes/play/src/lib/looks/types.ts'
import type { LookKnobSpec } from '../../themes/play/src/lib/look-kit/validate.ts'
import type { PrepaintTable, PrepaintToneRule, ThemeTone } from './boot-types.ts'
import { lookPrepaintTable } from './play-prepaint.ts'

/** core's look-schema format (frontend/lib/theme-host/look-schema.ts LOOK_SCHEMA_SCHEMA). */
export const LOOK_SCHEMA_FORMAT = 'automatos-look-schema/v1'
export const SCHEMA_FILE = 'looks/schema.json'
export const PRESETS_FOLDER = 'looks/presets'
export const PRESET_SUFFIX = '.look.json'
export const PREPAINT_FILE = 'boot/prepaint.json'
/** The look field whose choice sets the tone (PRD-260 K4: the ground). */
export const TONE_KNOB: keyof Pick<Look, 'ground'> = 'ground'

export type KnobDocument =
  | { readonly kind: 'choice'; readonly choices: readonly string[]; readonly default: string }
  | { readonly kind: 'number'; readonly min: number; readonly max: number; readonly integer: boolean; readonly default: number }

export interface LookSchemaDocument {
  readonly schema: typeof LOOK_SCHEMA_FORMAT
  readonly look: { readonly schema: string; readonly interface?: string }
  readonly knobs: Readonly<Record<string, KnobDocument>>
}

/** The default look's value for a knob; every knob is a field of Look. */
function defaultOf(name: string): string | number {
  const value = (DEFAULT_LOOK as unknown as Readonly<Record<string, unknown>>)[name]
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error(`the default look has no value for the knob "${name}"`)
  }
  return value
}

/** One knob of the spec as the schema writes it: no listName (an error message, not data). */
function knobDocument(name: string, spec: LookKnobSpec): KnobDocument {
  const fallback = defaultOf(name)
  if (spec.kind === 'choice') {
    if (typeof fallback !== 'string') throw new Error(`the default look's "${name}" must be one of its choices`)
    return { kind: 'choice', choices: [...spec.choices], default: fallback }
  }
  if (typeof fallback !== 'number') throw new Error(`the default look's "${name}" must be a number`)
  return { kind: 'number', min: spec.min, max: spec.max, integer: spec.integer === true, default: fallback }
}

/** looks/schema.json: Play's look header and every knob of PLAY_LOOK_SPEC, in the spec's order. */
export function lookSchemaDocument(): LookSchemaDocument {
  const header = PLAY_LOOK_SPEC.interface === null
    ? { schema: PLAY_LOOK_SPEC.lookSchema }
    : { schema: PLAY_LOOK_SPEC.lookSchema, interface: PLAY_LOOK_SPEC.interface }
  const knobs = Object.fromEntries(Array.from(PLAY_LOOK_SPEC.knobs, ([name, spec]) => [name, knobDocument(name, spec)]))
  return { schema: LOOK_SCHEMA_FORMAT, look: header, knobs }
}

/** Play's presets, in presets.ts's order. */
export function presetDocuments(): readonly Look[] {
  return PRESETS
}

/** The table's tone rule: every ground, in the catalogue's order, with the tone toneOfGround gives it. */
export function toneRule(): PrepaintToneRule {
  const values = GROUND_KEYS.map((key): [string, ThemeTone] => [key, toneOfGround(key)])
  return { knob: TONE_KNOB, values: Object.fromEntries(values) }
}

/** boot/prepaint.json: core's builder's table, unchanged, with the tone rule after it. */
export function prepaintDocument(): PrepaintTable {
  return { ...lookPrepaintTable(), tone: toneRule() }
}

/** JSON as the package holds it: two-space indent and a closing newline (core's data files' form). */
export function jsonText(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

/** Every file compile-looks writes, by package path, in path order. */
export function lookFiles(): ReadonlyMap<string, string> {
  const files: [string, string][] = [
    [SCHEMA_FILE, jsonText(lookSchemaDocument())],
    ...presetDocuments().map((look): [string, string] => [`${PRESETS_FOLDER}/${look.id}${PRESET_SUFFIX}`, jsonText(look)]),
    [PREPAINT_FILE, jsonText(prepaintDocument())],
  ]
  return new Map(files.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
}

/**
 * Writes the files into `themeDir`. The presets folder is emptied first, so a preset removed from
 * presets.ts leaves no file behind; the folders hold only generated files (themes/play/.gitignore).
 */
export function writeLookFiles(themeDir: string): readonly string[] {
  const files = lookFiles()
  rmSync(join(themeDir, PRESETS_FOLDER), { recursive: true, force: true })
  files.forEach((text, path) => {
    mkdirSync(dirname(join(themeDir, path)), { recursive: true })
    writeFileSync(join(themeDir, path), text)
  })
  return Array.from(files.keys())
}
