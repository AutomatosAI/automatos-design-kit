import type { CSSProperties } from 'react'
import { useLook } from '@automatos/theme-sdk'

import { clampKnob, KNOBS, type NumberKnob } from '../looks/spec'

/**
 * The one knob the first paint can't draw: Roundness, a number of px (the prepaint table paints a number knob only
 * as a colour's alpha). The frame sets it on its own root from the active look, so every window and card inside
 * takes it: --candy-r for windows and cards, and --candy-rs, round(r × 0.72), for inner tiles. Until a look is known
 * the stylesheet's default (28 px, the design's) holds.
 */

const ROUNDNESS = KNOBS.find((knob): knob is NumberKnob => knob.kind === 'number' && knob.name === 'roundness')
export const INNER_RATIO = 0.72

/** The corners for a roundness value: [r, rs] in px, the value clamped to the knob's range. */
export function cornersOf(value: unknown): readonly [number, number] {
  const knob = ROUNDNESS as NumberKnob
  const r = clampKnob(knob, typeof value === 'number' ? value : knob.default)
  return [r, Math.round(r * INNER_RATIO)]
}

export function lookStyle(look: { readonly roundness?: unknown } | null): CSSProperties {
  const [r, rs] = cornersOf(look?.roundness)
  return { '--candy-r': `${r}px`, '--candy-rs': `${rs}px` } as CSSProperties
}

export function useLookStyle(): CSSProperties {
  const { look } = useLook()
  return lookStyle(look as { readonly roundness?: unknown } | null)
}
