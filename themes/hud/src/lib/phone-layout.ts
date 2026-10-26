import { useSyncExternalStore } from 'react'

/**
 * Where HUD draws its phone layout: in a window narrower than DESKTOP_MIN_WIDTH. The Command design draws two
 * screens, the desktop at 1440 by 900 and the phone at 390 by 844; HUD's desktop frame (the 232 px rail, the top bar
 * with the host's utilities) is built and shot from 1024 px up, the width core's own shell calls a desktop
 * (hooks/use-mobile.ts, TABLET_BREAKPOINT), so every width under it, from theme.json's minWidth up, is the phone's.
 * The query is the one core's useIsBelowWidth asks (hooks/use-below-width.ts), so HUD and the host agree on each side
 * of the width, and it is read the way core reads it: useSyncExternalStore over matchMedia, known on the first render
 * in the browser, never a guess an effect corrects. A browser that can't say (no matchMedia, as in jsdom) is a wide
 * one, and so is the server.
 */

/** The narrowest window HUD's desktop layout is drawn in; below it, the phone layout. */
export const DESKTOP_MIN_WIDTH = 1024

/** Narrower than DESKTOP_MIN_WIDTH, as core's useIsBelowWidth asks it. */
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

/** True while the window is narrower than DESKTOP_MIN_WIDTH: HUD draws its phone layout. */
export function usePhoneLayout(): boolean {
  return useSyncExternalStore(subscribe, phoneNow, onServer)
}
