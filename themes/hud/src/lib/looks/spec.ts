import { validateLook as validateWithSpec, type LookKnobSpec, type LookSpec } from '@automatos/look-kit/validate'

import { ACCENT_KEYS, FONT_KEYS, GROUND_KEYS } from './catalogue'
import { DEFAULT_LOOK } from './presets'
import {
  GLOW_MAX,
  GLOW_MIN,
  GRID_MAX,
  GRID_MIN,
  LOOK_INTERFACE,
  LOOK_SCHEMA,
  SWITCH_CHOICES,
  type HudLook,
  type KnobName,
} from './types'

/**
 * HUD's look format for the look runtime (@automatos/look-kit's validator): looks/schema.json's header and
 * knobs, the catalogue's keys as the choices. The package's looks/schema.json is the Command design's file
 * copied byte for byte; test/look-data.test.ts holds this spec and these labels to it, knob for knob.
 */

/** Each knob's label, as looks/schema.json writes it (the Looks drawer's words). */
export const KNOB_LABELS: Readonly<Record<KnobName, string>> = {
  accent: 'Accent',
  ground: 'Background',
  font: 'Type',
  grid: 'Grid',
  glow: 'Glow',
  scan: 'Scan',
  auto: 'Auto',
  motion: 'Motion',
}

export const HUD_LOOK_SPEC: LookSpec = {
  lookSchema: LOOK_SCHEMA,
  interface: LOOK_INTERFACE,
  knobs: new Map<string, LookKnobSpec>([
    ['accent', { kind: 'choice', choices: ACCENT_KEYS, listName: "HUD's accents" }],
    ['ground', { kind: 'choice', choices: GROUND_KEYS, listName: "HUD's backgrounds" }],
    ['font', { kind: 'choice', choices: FONT_KEYS, listName: "HUD's type styles" }],
    ['grid', { kind: 'number', min: GRID_MIN, max: GRID_MAX, integer: true }],
    ['glow', { kind: 'number', min: GLOW_MIN, max: GLOW_MAX, integer: true }],
    ['scan', { kind: 'choice', choices: SWITCH_CHOICES }],
    ['auto', { kind: 'choice', choices: SWITCH_CHOICES }],
    ['motion', { kind: 'choice', choices: SWITCH_CHOICES }],
  ]),
}

export type HudLookCheck =
  | { readonly ok: true; readonly look: HudLook }
  | { readonly ok: false; readonly errors: readonly string[] }

/**
 * The one gate for a HUD look from outside the code (the host's active look, an imported file): the look
 * runtime's validator against HUD_LOOK_SPEC. The spec lists exactly HudLook's fields, so a look that passes
 * is a HudLook.
 */
export function validateHudLook(input: unknown): HudLookCheck {
  const result = validateWithSpec(HUD_LOOK_SPEC, input)
  return result.ok ? { ok: true, look: result.look as unknown as HudLook } : result
}

/** The look as HUD reads it: `input` when it is a HUD look, else the default look (ARC). */
export function toHudLook(input: unknown): HudLook {
  const result = validateHudLook(input)
  return result.ok ? result.look : DEFAULT_LOOK
}
