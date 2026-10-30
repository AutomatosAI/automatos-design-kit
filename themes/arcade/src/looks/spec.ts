import type { HostLook } from '@automatos/theme-sdk'

import { PALETTES, type Palette } from './catalogue'

/**
 * Arcade's look format: the five knobs of the design's looks.json (palette, scanlines, pixel scale, window style and
 * text speed), each choice with the word the Options screen shows, and the five presets, one per palette.
 *
 * The host checks every look against looks/schema.json and paints it from boot/prepaint.json; the SDK's useLook()
 * hands back the user's saved looks, never the presets, which ship in the package. test/look-data.test.ts writes
 * those files from this module and the catalogue and holds them equal, so the two never drift.
 */

/** looks/schema.json's look.schema and look.interface: every look of this theme names both. */
export const LOOK_SCHEMA = 'arcade-look/v1'
export const LOOK_INTERFACE = 'arcade'

export const KNOB_NAMES = ['palette', 'scanlines', 'pixelScale', 'windowStyle', 'textSpeed'] as const
export type KnobName = (typeof KNOB_NAMES)[number]

/** A look of this theme: who it is, and one choice for each knob. */
export interface ThemeLook extends HostLook {
  readonly interface?: string
  readonly palette: string
  readonly scanlines: string
  readonly pixelScale: string
  readonly windowStyle: string
  readonly textSpeed: string
}

export interface Choice {
  readonly key: string
  readonly label: string
}

export interface Knob {
  readonly name: KnobName
  /** The knob's label in looks/schema.json, and the Options screen's row name. */
  readonly label: string
  readonly choices: readonly Choice[]
  readonly default: string
}

export const KNOBS: readonly Knob[] = [
  {
    name: 'palette',
    label: 'Palette',
    choices: PALETTES.map((palette) => ({ key: palette.id, label: palette.name })),
    default: 'overworld',
  },
  {
    name: 'scanlines',
    label: 'Scanlines',
    choices: [{ key: 'off', label: 'Off' }, { key: 'soft', label: 'Soft' }, { key: 'strong', label: 'Strong' }],
    default: 'soft',
  },
  {
    name: 'pixelScale',
    label: 'Pixel scale',
    choices: [{ key: '2', label: '2×' }, { key: '3', label: '3×' }],
    default: '3',
  },
  {
    name: 'windowStyle',
    label: 'Window',
    choices: [{ key: 'classic', label: 'Classic double' }, { key: 'thin', label: 'Thin' }],
    default: 'classic',
  },
  {
    name: 'textSpeed',
    label: 'Text speed',
    choices: [{ key: 'instant', label: 'Instant' }, { key: 'normal', label: 'Normal' }, { key: 'slow', label: 'Slow' }],
    default: 'normal',
  },
]

/** A palette's preset: its colours, its own scanlines, and the design's defaults for the rest. */
function presetOf(palette: Palette): ThemeLook {
  return {
    schema: LOOK_SCHEMA,
    interface: LOOK_INTERFACE,
    id: palette.id,
    name: palette.name,
    sub: palette.sub,
    palette: palette.id,
    scanlines: palette.scanlines,
    pixelScale: '3',
    windowStyle: 'classic',
    textSpeed: 'normal',
  }
}

/** The presets, the default first (theme.json's look), then in the design's order. */
export const PRESETS: readonly ThemeLook[] = PALETTES.map(presetOf)
export const DEFAULT_LOOK: ThemeLook = PRESETS[0]

/** The knobs' defaults, as a look's knob values: the first paint's defaults. */
export function knobDefaults(): Readonly<Record<KnobName, string>> {
  return Object.fromEntries(KNOBS.map((knob) => [knob.name, knob.default])) as Record<KnobName, string>
}

/** A saved look's id: the presets' ids are taken. */
const SAVED_ID_PREFIX = 'mine-'
const SAVED_NAME_PREFIX = 'Save slot '

export function isPreset(id: string): boolean {
  return PRESETS.some((look) => look.id === id)
}

/** `look` with `knob` set to `key`: still the same look, edited. */
export function withChoice(look: ThemeLook, knob: KnobName, key: string): ThemeLook {
  return { ...look, [knob]: key }
}

/** The palette's preset with every knob back at its default: Reset on the Options screen. */
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
