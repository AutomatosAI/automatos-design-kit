/**
 * PRD-260 D6 — hello plays on the first open of Play in a browser session,
 * ported from Automatos Play's lib/mascot/session.ts.
 *
 * PRD-261 E3g (PB-9): the session remembers it through the host, in the SDK's
 * storage area: key `hello-played`, for the signed-in account, for this tab's
 * session. Until the host can say whose session it is (the user not known
 * yet), nothing is claimed: claimFirstOpen says false and helloReady false, and
 * a caller that asks again once helloReady turns true gets the one hello
 * (use-auto-mascot.ts). Where the browser blocks its storage the host keeps it
 * for this page, so hello plays once per page load; a write the host refuses is
 * logged, and hello then plays once per page load too.
 */
import { readThemeState, subscribeThemeState, type ThemeStateOptions, writeThemeState } from '@automatos/theme-sdk'

export const HELLO_KEY = 'hello-played'

/** For the signed-in account, for this tab's session. */
export const HELLO_STATE: ThemeStateOptions = Object.freeze({ lifetime: 'session', within: 'account' })

/** Hello's first open, when the host refused to keep it: once per page load. */
let claimedWithoutState = false

/** True once the host can say whether hello has played in this session. */
export function helloReady(): boolean {
  return readThemeState(HELLO_KEY, HELLO_STATE).ready
}

/** Calls `onChange` when hello's state may have changed (the host learned whose it is, or it was claimed). */
export function subscribeHello(onChange: () => void): () => void {
  return subscribeThemeState(HELLO_KEY, onChange, HELLO_STATE)
}

/** True once per browser session, once the host is ready: the caller dispatches app-open. Otherwise false. */
export function claimFirstOpen(): boolean {
  const { ready, value } = readThemeState(HELLO_KEY, HELLO_STATE)
  if (!ready || value !== null) return false
  const result = writeThemeState(HELLO_KEY, true, HELLO_STATE)
  if (result.ok) return true
  console.warn(`[mascot] the host didn't keep hello's first open (${result.reason}), so hello plays once per page load:`, result.message)
  if (claimedWithoutState) return false
  claimedWithoutState = true
  return true
}
