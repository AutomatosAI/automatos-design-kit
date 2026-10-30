import { useCallback } from 'react'
import { useMediaPreferences, useThemeState } from '@automatos/theme-sdk'

/**
 * Whether Arcade's sprites, cursors and typing move. Nothing moves under the OS's reduced motion (the host's
 * useMediaPreferences, true on the server so a first paint never animates), nor while the person has paused the
 * animation (kept per account through the SDK's storage area), nor before the host can say whether they have: until
 * then the sprites hold their first frame and the pause control is disabled, so nothing loops before the choice is
 * read (WCAG 2.2.2, the kit's pitfalls "Motion that can't stop").
 */

export const PAUSE_KEY = 'motion-paused'

export interface Motion {
  /** Sprites step, cursors blink and the dialogue box types. */
  readonly moving: boolean
  /** The OS asks for reduced motion: there is no pause control then, since nothing moves. */
  readonly reduced: boolean
  /** The person paused the animation. */
  readonly paused: boolean
  /** The host knows the saved choice. */
  readonly ready: boolean
  readonly togglePause: () => void
}

export function useMotion(): Motion {
  const { reducedMotion } = useMediaPreferences()
  const { ready, value, set } = useThemeState(PAUSE_KEY)
  const paused = value === true
  const togglePause = useCallback(() => {
    set(!paused)
  }, [set, paused])
  return { moving: !reducedMotion && ready && !paused, reduced: reducedMotion, paused, ready, togglePause }
}
