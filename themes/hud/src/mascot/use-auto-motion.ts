import { useSyncExternalStore } from 'react'

import { useMediaPreferences } from '@automatos/theme-sdk'

import { useHudLook } from '../lib/looks/use-hud-look'
import { mascotPause, setMascotPaused, subscribeMascotPause, type MascotPause } from './pause'

/**
 * Whether Auto may move, after themes/play/src/components/mascot/use-mascot-motion.ts (Play 1.1.1), with HUD's
 * motion knob added: not under the OS reduced-motion setting, not while the look's motion is off (the design:
 * motion off stops every loop), and not while the user has paused him. Until the host can say whether he is
 * paused (the SDK's storage area), he is his still and the toggle does nothing. On the server he is a still.
 */

export interface AutoMotion {
  /** The OS asks for reduced motion (and on the server): stills only, no pause control. */
  readonly reducedMotion: boolean
  /** The look's motion knob is off: stills only, no pause control. */
  readonly lookStill: boolean
  /** False until the host can say whether Auto is paused. */
  readonly ready: boolean
  readonly paused: boolean
  /** Auto stands still for any of these reasons: his still shows. */
  readonly still: boolean
  readonly togglePaused: () => void
}

const unknownOnServer = (): MascotPause => 'unknown'

function togglePause(): void {
  const now = mascotPause()
  if (now === 'unknown') return
  setMascotPaused(now === 'playing')
}

export function useAutoMotion(): AutoMotion {
  const { reducedMotion } = useMediaPreferences()
  const lookStill = useHudLook().motion === 'off'
  const pause = useSyncExternalStore(subscribeMascotPause, mascotPause, unknownOnServer)
  const ready = pause !== 'unknown'
  const paused = pause === 'paused'
  const still = reducedMotion || lookStill || !ready || paused
  return { reducedMotion, lookStill, ready, paused, still, togglePaused: togglePause }
}
