// Copied from themes/play/src/lib/mascot/pause.ts (Play 1.1.1) as it is: Auto's pause flag, kept through the SDK's
// storage area. HUD keeps its own copy (a theme never imports another theme's source); the host scopes the flag
// to the active theme, so HUD's pause is HUD's own.
/**
 * PRD-261 A-13b (PRD-260 review F10, M24; WCAG 2.2.2 Pause, Stop, Hide) —
 * whether the user has paused Auto. Auto's clips loop, and his ring pulses, for
 * longer than five seconds; without this the only way to stop them was the OS
 * reduced-motion setting.
 *
 * PRD-261 E3g: the flag is kept through the host, in the SDK's storage area:
 * key `mascot-paused`, for the signed-in account, in this browser, holding
 * `true` while paused and no value otherwise. It survives a state change, a
 * remount and a reload, and every Auto on the page (and in other tabs) follows
 * one switch, since the SDK tells every subscriber. Until the host can say whose
 * flag it is (the user not known yet), it is unknown: Auto stands still and the
 * switch does nothing (use-mascot-motion.ts). Where the browser blocks its
 * storage the host keeps the flag for this page; a write the host refuses is
 * logged once.
 */
import {
  readThemeState,
  removeThemeState,
  subscribeThemeState,
  type ThemeStateOptions,
  type ThemeStateResult,
  writeThemeState,
} from '@automatos/theme-sdk'

export const PAUSE_KEY = 'mascot-paused'

/** For the signed-in account, in this browser until it is removed. */
export const PAUSE_STATE: ThemeStateOptions = Object.freeze({ lifetime: 'browser', within: 'account' })

/** The flag as one string, so useSyncExternalStore gets a stable snapshot: 'unknown' until the host is ready. */
export type MascotPause = 'unknown' | 'paused' | 'playing'

let warnedRefused = false

function warnRefusedOnce(result: ThemeStateResult): void {
  if (result.ok || warnedRefused) return
  warnedRefused = true
  console.warn(`[mascot] the host didn't keep Auto's pause (${result.reason}): ${result.message}`)
}

/** Whether Auto is paused, or 'unknown' while the host can't say whose flag it is. */
export function mascotPause(): MascotPause {
  const { ready, value } = readThemeState(PAUSE_KEY, PAUSE_STATE)
  if (!ready) return 'unknown'
  return value === true ? 'paused' : 'playing'
}

/** True while the user has paused Auto (false while it is unknown). */
export function isMascotPaused(): boolean {
  return mascotPause() === 'paused'
}

/** Pause (true) or play (false) every Auto of this account in this browser; the SDK tells the ones on screen. */
export function setMascotPaused(paused: boolean): ThemeStateResult {
  const result = paused ? writeThemeState(PAUSE_KEY, true, PAUSE_STATE) : removeThemeState(PAUSE_KEY, PAUSE_STATE)
  warnRefusedOnce(result)
  return result
}

/**
 * Calls `onChange` when the flag may have changed: here, in another tab, or
 * when the host learns or changes whose flag it is. For useSyncExternalStore.
 */
export function subscribeMascotPause(onChange: () => void): () => void {
  return subscribeThemeState(PAUSE_KEY, onChange, PAUSE_STATE)
}
