import type { AccentKey, FontKey, GroundKey } from './catalogue'

/**
 * A HUD look: catalogue keys, two numbers and three switches, never a raw colour, CSS or URL. Its format is
 * looks/schema.json's (the Command design's looks/schema.json, copied byte for byte), the one the
 * phone's HUD layout reads too: {schema: automatos-interface-look/v1, interface: command}, then the knobs.
 */

export const LOOK_SCHEMA = 'automatos-interface-look/v1'
export const LOOK_INTERFACE = 'command'

/** A switch knob's two choices, on first. */
export const SWITCH_CHOICES = ['on', 'off'] as const
export type Switch = (typeof SWITCH_CHOICES)[number]

/** Grid: the accent at grid / GRID_SCALE alpha, in 40 px squares. */
export const GRID_MIN = 0
export const GRID_MAX = 30
export const GRID_SCALE = 300

/** Glow: the accent at glow / GLOW_SCALE alpha behind the core, never past the pair's AA cap. */
export const GLOW_MIN = 0
export const GLOW_MAX = 40
export const GLOW_SCALE = 100

export interface HudLook {
  readonly schema: typeof LOOK_SCHEMA
  readonly interface: typeof LOOK_INTERFACE
  readonly id: string
  readonly name: string
  readonly sub: string
  readonly accent: AccentKey
  readonly ground: GroundKey
  readonly font: FontKey
  /** Whole number, GRID_MIN to GRID_MAX. */
  readonly grid: number
  /** Whole number, GLOW_MIN to GLOW_MAX. */
  readonly glow: number
  /** The scan-line overlay. */
  readonly scan: Switch
  /** Auto, the mascot. */
  readonly auto: Switch
  /** Every loop; off under the OS reduced-motion setting whatever the look says. */
  readonly motion: Switch
}

/** The knobs, in looks/schema.json's order. */
export const KNOB_NAMES = ['accent', 'ground', 'font', 'grid', 'glow', 'scan', 'auto', 'motion'] as const
export type KnobName = (typeof KNOB_NAMES)[number]

export type ChoiceKnobName = Exclude<KnobName, 'grid' | 'glow'>
export type SwitchKnobName = Extract<KnobName, 'scan' | 'auto' | 'motion'>
export const SWITCH_KNOBS: readonly SwitchKnobName[] = ['scan', 'auto', 'motion']
