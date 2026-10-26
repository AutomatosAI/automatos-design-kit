/**
 * The Command design's waveform as numbers ("Automatos Command HUD.dc.html": 72 bars on the desktop, 44 on the phone).
 * Each bar's height is the design's shape, 0.25 + 0.75 |sin(1.7 i) cos(0.37 i)| of the wave's height, and its opacity
 * follows it. What the bars show is the voice's recent level (readVoiceLevels: the member's while the microphone is
 * open, Auto's while he speaks): the newest level enters at the bar next to the voice button and moves away from it
 * frame by frame, so the wave travels out from the button as the voice goes on. A bar stands at REST_SCALE of its height
 * while nothing is heard and at its full height at the loudest. Pure: waveform.tsx reads the levels in its frames.
 */

export const DESKTOP_BARS = 72
export const PHONE_BARS = 44
/** A bar's height at rest, as a part of its full height: the design's own floor (its hudWave starts at 0.25). */
export const REST_SCALE = 0.25

/** Where the newest level enters: the middle bars (the phone's, over its button), or one end (a desktop half). */
export type WaveEntry = 'middle' | 'start' | 'end'

const SHAPE_FLOOR = 0.25
const SHAPE_SWING = 0.75
const SHAPE_SINE = 1.7
const SHAPE_COSINE = 0.37
const LEVEL_MIN = 0
const LEVEL_MAX = 1
const SCALE_DECIMALS = 3

/** The design's height for bar `index` of its row, a part of the wave's height (0.25 to 1). */
export function shapeAt(index: number): number {
  return SHAPE_FLOOR + SHAPE_SWING * Math.abs(Math.sin(index * SHAPE_SINE) * Math.cos(index * SHAPE_COSINE))
}

/** The heights of `count` bars, the design's from its bar `first` on (a desktop half starts at 0 or at 36). */
export function waveShape(count: number, first = 0): readonly number[] {
  return Array.from({ length: count }, (_, offset) => shapeAt(first + offset))
}

/** How many levels the bars show: one per bar from an end, one per pair of bars from the middle. */
export function historyLength(count: number, entry: WaveEntry): number {
  return entry === 'middle' ? Math.ceil(count / 2) : count
}

/** How many frames ago bar `index` heard its level: 0 for the bar (or the middle pair) the newest enters at. */
export function ageOf(index: number, count: number, entry: WaveEntry): number {
  if (entry === 'start') return index
  if (entry === 'end') return count - 1 - index
  return Math.floor(Math.abs(index - (count - 1) / 2))
}

/** A level as the bars take it: 0 to 1, and 0 for anything that is no number. */
export function clampLevel(level: number): number {
  return Number.isFinite(level) ? Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, level)) : LEVEL_MIN
}

/** The levels with `level` the newest, the oldest dropped past `length`. A new array; `history` is left as it is. */
export function pushLevel(history: readonly number[], level: number, length: number): readonly number[] {
  return [clampLevel(level), ...history].slice(0, length)
}

/** Each bar's scale for `history` (newest first): REST_SCALE with nothing heard, 1 at the loudest, to 3 places. */
export function barScales(history: readonly number[], count: number, entry: WaveEntry): readonly number[] {
  return Array.from({ length: count }, (_, index) => {
    const level = history[ageOf(index, count, entry)] ?? LEVEL_MIN
    return Number((REST_SCALE + (1 - REST_SCALE) * level).toFixed(SCALE_DECIMALS))
  })
}
