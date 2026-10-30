import { useCallback } from 'react'
import { useLook, useMediaPreferences, useThemeState } from '@automatos/theme-sdk'

/**
 * Whether Candy's loops run: Auto's float and blink, the orb's turning ring and the "Auto is writing" dots. Nothing
 * moves under the OS's reduced motion (the host's useMediaPreferences, true on the server so a first paint never
 * animates), nor while the look's Motion knob is Paused, nor while the person has paused it with the Pause control
 * (kept per account through the SDK's storage area), nor before the host can say whether they have: until then
 * everything holds still and the control is disabled, so nothing loops before the choice is read (WCAG 2.2.2).
 */

export const PAUSE_KEY = 'motion-paused'

export interface Motion {
  /** Loops run. */
  readonly moving: boolean
  /** The OS asks for reduced motion: there is no pause control then, since nothing moves. */
  readonly reduced: boolean
  /** The person paused the motion with the control. */
  readonly paused: boolean
  /** The look's Motion knob is Paused. */
  readonly lookPaused: boolean
  /** The host knows the saved choice. */
  readonly ready: boolean
  readonly togglePause: () => void
}

export function useMotion(): Motion {
  const { reducedMotion } = useMediaPreferences()
  const { ready, value, set } = useThemeState(PAUSE_KEY)
  const look = useLook()
  const lookPaused = look.available && (look.look as { readonly motion?: string } | null)?.motion === 'paused'
  const paused = value === true
  const togglePause = useCallback(() => {
    set(!paused)
  }, [set, paused])
  return { moving: !reducedMotion && ready && !paused && !lookPaused, reduced: reducedMotion, paused, lookPaused, ready, togglePause }
}
