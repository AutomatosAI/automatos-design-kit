import type { HostLook } from '@automatos/theme-sdk'

/**
 * {{name}}'s look format, as its look editor reads it: the three knobs looks/schema.json declares, each choice with
 * the word the editor shows, and the presets looks/presets/*.look.json hold.
 *
 * The host checks every look against looks/schema.json and paints it from boot/prepaint.json; the SDK's useLook()
 * hands back the user's saved looks, never the presets, which ship in the package. So the editor keeps this copy of
 * the same data, and test/look-data.test.ts holds it equal to the files: change both together.
 */

/** looks/schema.json's look.schema: every look of this theme names it. */
export const LOOK_SCHEMA = '{{htmlClass}}-look/v1'

export const KNOB_NAMES = ['ground', 'accent', 'corners'] as const
export type KnobName = (typeof KNOB_NAMES)[number]

/** A look of this theme: who it is, and one choice for each knob. */
export interface ThemeLook extends HostLook {
  readonly ground: string
  readonly accent: string
  readonly corners: string
}

export interface Choice {
  readonly key: string
  readonly label: string
}

export interface Knob {
  readonly name: KnobName
  /** The knob's label in looks/schema.json. */
  readonly label: string
  /** Its choices, in the schema's order. */
  readonly choices: readonly Choice[]
}

export const KNOBS: readonly Knob[] = [
  { name: 'ground', label: 'Ground', choices: [{ key: 'paper', label: 'Paper' }, { key: 'ink', label: 'Ink' }] },
  {
    name: 'accent',
    label: 'Accent',
    choices: [{ key: 'blue', label: 'Blue' }, { key: 'green', label: 'Green' }, { key: 'amber', label: 'Amber' }],
  },
  {
    name: 'corners',
    label: 'Corners',
    choices: [{ key: 'square', label: 'Square' }, { key: 'soft', label: 'Soft' }, { key: 'round', label: 'Round' }],
  },
]

export const DAY: ThemeLook = {
  schema: LOOK_SCHEMA, id: 'day', name: 'Day', sub: 'Blue on paper', ground: 'paper', accent: 'blue', corners: 'soft',
}
export const NIGHT: ThemeLook = {
  schema: LOOK_SCHEMA, id: 'night', name: 'Night', sub: 'Green on ink', ground: 'ink', accent: 'green', corners: 'soft',
}

/** The presets, the default first (theme.json's look). */
export const PRESETS: readonly ThemeLook[] = [DAY, NIGHT]
export const DEFAULT_LOOK: ThemeLook = DAY

/** A saved look's id: the presets' ids are taken. */
const SAVED_ID_PREFIX = 'mine-'
const SAVED_NAME_PREFIX = 'My look '

export function isPreset(id: string): boolean {
  return PRESETS.some((look) => look.id === id)
}

/** `look` with `knob` set to `key`: still the same look, edited. */
export function withChoice(look: ThemeLook, knob: KnobName, key: string): ThemeLook {
  return { ...look, [knob]: key }
}

/** The first `mine-<n>` no saved look has. */
function freshNumber(saved: readonly HostLook[]): number {
  const taken = new Set(saved.map((look) => look.id))
  let number = saved.length + 1
  while (taken.has(`${SAVED_ID_PREFIX}${number}`)) number += 1
  return number
}

/** `look` as a new saved look: a fresh id, and a name that says it is the user's. */
export function asNewLook(look: ThemeLook, saved: readonly HostLook[]): ThemeLook {
  const number = freshNumber(saved)
  return { ...look, id: `${SAVED_ID_PREFIX}${number}`, name: `${SAVED_NAME_PREFIX}${number}`, sub: `From ${look.name}` }
}
