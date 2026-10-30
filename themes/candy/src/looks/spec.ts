import type { HostLook } from '@automatos/theme-sdk'

import { PALETTES, type Palette } from './catalogue'

/**
 * Candy's look format: the six knobs of the design's looks.json (palette, card colours, gradient, roundness, glow
 * and motion), each choice with the word the look editor shows, and the three presets, one per palette.
 *
 * The host checks every look against looks/schema.json and paints it from boot/prepaint.json; the SDK's useLook()
 * hands back the user's saved looks, never the presets, which ship in the package. test/look-data.test.ts writes
 * those files from this module and the catalogue and holds them equal, so the two never drift.
 */

/** looks/schema.json's look.schema and look.interface: every look of this theme names both. */
export const LOOK_SCHEMA = 'candy-look/v1'
export const LOOK_INTERFACE = 'candy'

export const CHOICE_KNOBS = ['palette', 'cards', 'gradient', 'motion'] as const
export const NUMBER_KNOBS = ['roundness', 'glow'] as const
export type ChoiceKnobName = (typeof CHOICE_KNOBS)[number]
export type NumberKnobName = (typeof NUMBER_KNOBS)[number]
export type KnobName = ChoiceKnobName | NumberKnobName

/** A look of this theme: who it is, and a value for each knob. */
export interface ThemeLook extends HostLook {
  readonly interface?: string
  readonly palette: string
  readonly cards: string
  readonly gradient: string
  readonly roundness: number
  readonly glow: number
  readonly motion: string
}

export interface Choice {
  readonly key: string
  readonly label: string
}

export interface ChoiceKnob {
  readonly kind: 'choice'
  readonly name: ChoiceKnobName
  /** The knob's label in looks/schema.json, and the look editor's row name. */
  readonly label: string
  readonly choices: readonly Choice[]
  readonly default: string
}

export interface NumberKnob {
  readonly kind: 'number'
  readonly name: NumberKnobName
  readonly label: string
  readonly min: number
  readonly max: number
  readonly default: number
  /** The unit the editor shows after the value ("28 px"). */
  readonly unit: string
}

export type Knob = ChoiceKnob | NumberKnob

export const PALETTE_KNOB: ChoiceKnob = {
  kind: 'choice',
  name: 'palette',
  label: 'Palette',
  choices: PALETTES.map((palette) => ({ key: palette.id, label: palette.name })),
  default: 'blush',
}

export const KNOBS: readonly Knob[] = [
  PALETTE_KNOB,
  {
    kind: 'choice', name: 'cards', label: 'Card colours',
    choices: [{ key: 'mix', label: 'Mixed' }, { key: 'single', label: 'One colour' }], default: 'mix',
  },
  {
    kind: 'choice', name: 'gradient', label: 'Gradient',
    choices: [{ key: 'soft', label: 'Soft' }, { key: 'rich', label: 'Rich' }, { key: 'vivid', label: 'Vivid' }],
    default: 'rich',
  },
  { kind: 'number', name: 'roundness', label: 'Roundness', min: 16, max: 40, default: 28, unit: 'px' },
  { kind: 'number', name: 'glow', label: 'Glow', min: 0, max: 10, default: 6, unit: '' },
  {
    kind: 'choice', name: 'motion', label: 'Motion',
    choices: [{ key: 'on', label: 'On' }, { key: 'paused', label: 'Paused' }], default: 'on',
  },
]

/** What the editor says under the Gradient row, per choice (the design's note). */
export const GRADIENT_NOTES: Readonly<Record<string, string>> = {
  soft: 'One hue per card',
  rich: 'Hues blend card to card',
  vivid: 'Blends, glows and aura',
}

/** Each palette's preset knobs, as the design's looks.json gives them. */
const PRESET_KNOBS: Readonly<Record<string, Pick<ThemeLook, 'gradient' | 'roundness' | 'glow'>>> = {
  blush: { gradient: 'rich', roundness: 28, glow: 6 },
  lilac: { gradient: 'vivid', roundness: 32, glow: 5 },
  nightbloom: { gradient: 'vivid', roundness: 28, glow: 8 },
}

function presetOf(palette: Palette): ThemeLook {
  return {
    schema: LOOK_SCHEMA,
    interface: LOOK_INTERFACE,
    id: palette.id,
    name: palette.name,
    sub: palette.sub,
    palette: palette.id,
    cards: 'mix',
    ...PRESET_KNOBS[palette.id],
    motion: 'on',
  }
}

/** The presets, the default first (theme.json's look), then in the design's order. */
export const PRESETS: readonly ThemeLook[] = PALETTES.map(presetOf)
export const DEFAULT_LOOK: ThemeLook = PRESETS[0]

/** The knobs' defaults, as a look's knob values: the first paint's defaults. */
export function knobDefaults(): Readonly<Record<KnobName, string | number>> {
  return Object.fromEntries(KNOBS.map((knob) => [knob.name, knob.default])) as Record<KnobName, string | number>
}

/** A saved look's id: the presets' ids are taken. */
const SAVED_ID_PREFIX = 'mine-'
const SAVED_NAME_PREFIX = 'My look '

export function isPreset(id: string): boolean {
  return PRESETS.some((look) => look.id === id)
}

/** `look` with `knob` set to `value`: still the same look, edited. */
export function withValue(look: ThemeLook, knob: KnobName, value: string | number): ThemeLook {
  return { ...look, [knob]: value }
}

/** The palette's preset: Reset in the look editor. */
export function resetOf(look: ThemeLook): ThemeLook {
  return PRESETS.find((preset) => preset.palette === look.palette) ?? DEFAULT_LOOK
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

/** A number knob's value clamped and rounded to what the schema takes. */
export function clampKnob(knob: NumberKnob, value: number): number {
  if (!Number.isFinite(value)) return knob.default
  return Math.min(knob.max, Math.max(knob.min, Math.round(value)))
}
