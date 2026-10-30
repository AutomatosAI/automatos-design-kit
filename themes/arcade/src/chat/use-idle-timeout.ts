// Copied from themes/hud/src/chat/use-idle-timeout.ts (HUD 1.1.2), itself from Play 1.1.1, as it is but for this line.
import { useEffect, useRef } from 'react'

/** Auto naps after three minutes without input (Play's mascot rule). The timers live here, never in his reducer. */
const IDLE_MINUTES = 3
const MS_PER_MINUTE = 60_000
export const IDLE_MS = IDLE_MINUTES * MS_PER_MINUTE

/** What counts as input: a key, a click or tap, the pointer moving, a scroll wheel. */
const INPUT_EVENTS = ['keydown', 'pointerdown', 'pointermove', 'wheel', 'touchstart'] as const

/**
 * onIdle fires after ms without input, and again every ms while nothing happens (a turn that was running the
 * first time may have ended since). onActive fires on the first input after onIdle.
 */
export function useIdleTimeout(onIdle: () => void, onActive: () => void, ms: number = IDLE_MS): void {
  const handlers = useRef({ onIdle, onActive })

  useEffect(() => {
    handlers.current = { onIdle, onActive }
  }, [onIdle, onActive])

  useEffect(() => {
    let idle = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const arm = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        idle = true
        handlers.current.onIdle()
        arm()
      }, ms)
    }
    const onInput = () => {
      if (idle) {
        idle = false
        handlers.current.onActive()
      }
      arm()
    }
    arm()
    for (const name of INPUT_EVENTS) window.addEventListener(name, onInput, { passive: true })
    return () => {
      clearTimeout(timer)
      for (const name of INPUT_EVENTS) window.removeEventListener(name, onInput)
    }
  }, [ms])
}
