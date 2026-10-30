// After themes/hud/src/lib/phone-layout.ts (HUD 1.1.2), as it is but for the comments.
import { useSyncExternalStore } from 'react'

/**
 * Where Arcade draws its handheld: in a window narrower than DESKTOP_MIN_WIDTH (the brief's "a layout of its own
 * below 1024 px"), from theme.json's minWidth (360) up. The query is the one core's useIsBelowWidth asks, read the way
 * core reads it: useSyncExternalStore over matchMedia, known on the first render in the browser. A browser that can't
 * say (no matchMedia, as in jsdom) is a wide one, and so is the server.
 */

export const DESKTOP_MIN_WIDTH = 1024
export const PHONE_QUERY = `(max-width: ${DESKTOP_MIN_WIDTH - 1}px)`

function hasMatchMedia(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
}

function subscribe(onChange: () => void): () => void {
  if (!hasMatchMedia()) return () => undefined
  const query = window.matchMedia(PHONE_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function phoneNow(): boolean {
  return hasMatchMedia() && window.matchMedia(PHONE_QUERY).matches
}

function onServer(): boolean {
  return false
}

/** True while the window is narrower than DESKTOP_MIN_WIDTH: Arcade draws its handheld. */
export function usePhoneLayout(): boolean {
  return useSyncExternalStore(subscribe, phoneNow, onServer)
}
