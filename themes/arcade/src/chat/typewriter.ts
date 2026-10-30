import { useCallback, useRef, useState } from 'react'

import { clockNow, useTicks } from '../motion/clock'

/**
 * The dialogue box's typing (the design's text speed: one character a tick on Normal, one every three ticks on Slow,
 * the whole line at once on Instant, under reduced motion and while the animation is paused). The design's lines are
 * a sentence; Auto's replies can run to pages, so a long reply types faster, finishing within TYPE_CAP_TICKS on
 * Normal (about 15 s) and twice that on Slow. A reply that was already there when the chat opened shows whole, and
 * Skip shows the rest at once. Typing follows the reply as it streams in and never goes back.
 */

export type TextSpeed = 'instant' | 'normal' | 'slow'

export const TICKS_PER_CHAR: Readonly<Record<TextSpeed, number>> = { instant: 0, normal: 1, slow: 3 }
export const TYPE_CAP_TICKS: Readonly<Record<TextSpeed, number>> = { instant: 0, normal: 250, slow: 500 }

export interface Typing {
  /** How many characters show. */
  readonly shown: number
  /** Every character shows and no more is coming. */
  readonly done: boolean
  /** Characters are still to come on screen. */
  readonly typing: boolean
  readonly skip: () => void
}

export interface TypewriterOptions {
  readonly speed: TextSpeed
  /** Motion is on (no reduced motion, not paused). */
  readonly moving: boolean
  /** The reply is still being written. */
  readonly streaming: boolean
  /** Show it whole from the start (it was there when the chat opened). */
  readonly whole: boolean
}

export function speedOf(value: string | undefined): TextSpeed {
  return value === 'instant' || value === 'slow' ? value : 'normal'
}

/** Characters shown after `ticks` ticks of typing a text of `length` at `speed`. */
export function typedAfter(ticks: number, length: number, speed: TextSpeed): number {
  if (speed === 'instant') return length
  const perTick = Math.max(1 / TICKS_PER_CHAR[speed], length / TYPE_CAP_TICKS[speed])
  return Math.min(length, Math.floor(ticks * perTick))
}

/**
 * What a new reply keeps of the one before: everything shown, when it goes on from the same words (a voice session's
 * live reply replaced by its saved copy), so the same words never type twice; else nothing.
 */
function carriedOver(previous: { readonly shown: number; readonly text: string }, text: string): number {
  const said = previous.text.slice(0, previous.shown)
  return said.length > 0 && text.startsWith(said) ? said.length : 0
}

/** Typing for one reply (`id`); a new id starts again, but for what it carries over. */
export function useTypewriter(id: string | null, text: string, options: TypewriterOptions): Typing {
  const { speed, moving, streaming, whole } = options
  const start = useRef<{ id: string | null; tick: number; shown: number; text: string }>({ id: null, tick: 0, shown: 0, text: '' })
  const [skipped, setSkipped] = useState<string | null>(null)
  if (start.current.id !== id) {
    const kept = carriedOver(start.current, text)
    start.current = { id, tick: clockNow() - kept * TICKS_PER_CHAR[speed], shown: kept, text }
  }
  const instant = !moving || speed === 'instant' || whole || skipped === id
  const behind = !instant && start.current.shown < text.length
  useTicks(1, behind)
  const typed = instant ? text.length : typedAfter(clockNow() - start.current.tick, text.length, speed)
  const shown = Math.max(start.current.shown, typed)
  start.current = { ...start.current, shown, text }
  const skip = useCallback(() => setSkipped(id), [id])
  return { shown, done: !streaming && shown >= text.length, typing: shown < text.length, skip }
}
