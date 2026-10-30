import { useSyncExternalStore } from 'react'

/**
 * Arcade's one clock (the design's "one clock, 60 ms ticks"): sprite frames step every 3 ticks, the cursor blinks
 * every 8, and the dialogue box types one character a tick on Normal. It runs only while something moving listens,
 * and stops when the last one goes. A component reads the tick divided down to what it draws, so a sprite renders
 * again only when its frame changes, never on every tick.
 */

export const TICK_MS = 60
export const SPRITE_TICKS = 3
export const CURSOR_TICKS = 8

let tick = 0
let timer: ReturnType<typeof setInterval> | undefined
const listeners = new Set<() => void>()

function advance(): void {
  tick += 1
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (timer === undefined) timer = setInterval(advance, TICK_MS)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && timer !== undefined) {
      clearInterval(timer)
      timer = undefined
    }
  }
}

function still(): () => void {
  return () => undefined
}

/** The clock's tick now. */
export function clockNow(): number {
  return tick
}

/** The tick divided by `every`, re-rendering when it moves on; 0 and no clock while `running` is false. */
export function useTicks(every: number, running: boolean): number {
  return useSyncExternalStore(
    running ? subscribe : still,
    () => (running ? Math.floor(tick / every) : 0),
    () => 0,
  )
}
