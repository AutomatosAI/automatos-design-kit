'use client'

import { useSyncExternalStore } from 'react'

import { useMediaPreferences } from '@automatos/theme-sdk'

import { type MascotPause, mascotPause, setMascotPaused, subscribeMascotPause } from '../../lib/mascot/pause'

/**
 * PRD-261 A-13b (F10, WCAG 2.2.2) — whether Auto may move: not under the OS
 * reduced-motion setting, and not while the user has paused him (the Pause
 * Auto control, lib/mascot/pause.ts). On the server he is a still and nothing
 * is paused, so the first paint never starts a loop and never shows a control
 * the browser may not need.
 *
 * PRD-261 E3g: the pause flag is kept by the host (the SDK's storage area), so
 * until the host can say whose flag it is he stands still and the toggle does
 * nothing: no clip loops before the flag is known.
 */

export interface MascotMotion {
  /** The OS asks for reduced motion (and on the server): stills only, and no Pause control. */
  readonly reducedMotion: boolean
  /** False until the host can say whether Auto is paused: he is a still and togglePaused does nothing. */
  readonly ready: boolean
  /** The user paused Auto. */
  readonly paused: boolean
  /** True when Auto stands still for any of these reasons: his still shows and his ring stops. */
  readonly still: boolean
  /** Pause Auto, or play him again, in every tab of this browser; nothing while the flag is unknown. */
  readonly togglePaused: () => void
}

const unknownOnServer = (): MascotPause => 'unknown'

/** Flips the flag the host holds now; while it is unknown there is nothing to flip. */
function togglePause(): void {
  const now = mascotPause()
  if (now === 'unknown') return
  setMascotPaused(now === 'playing')
}

export function useMascotMotion(): MascotMotion {
  const { reducedMotion } = useMediaPreferences()
  const pause = useSyncExternalStore(subscribeMascotPause, mascotPause, unknownOnServer)
  const ready = pause !== 'unknown'
  const paused = pause === 'paused'
  return { reducedMotion, ready, paused, still: reducedMotion || !ready || paused, togglePaused: togglePause }
}
