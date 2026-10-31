import { useCallback, useRef, useState } from 'react'
import {
  type Brief,
  type BriefRating,
  type ThemeStateOptions,
  type ThemeStateValue,
  useRateBrief,
  useThemeState,
  writeThemeState,
} from '@automatos/theme-sdk'

import { briefKey } from './use-briefing'

/**
 * HUD 1.3.0 (PRD-268, SDK 1.4.0): the brief's thumbs, in BRIEFING's footer. Up or down goes through the SDK's
 * useRateBrief (the host's digest feedback route, which takes the brief's state_hash and 1 for up, -1 for down), once
 * per brief per viewer: once the host has it, the thumb is kept for this person in this workspace in this browser
 * (RATED_KEY, through the SDK's storage area; where the host keeps no theme state, for this page), and both thumbs
 * stay pressed or not as rated, so that brief is never rated twice. A new brief (another day, another state) can be
 * rated again. While the rating is on its way neither thumb takes a press; refused (the route failing, or answering
 * that it didn't take it), it says why and can be tried again.
 */

export const RATED_KEY = 'hud-brief-rated'
export const RATED_STATE: ThemeStateOptions = Object.freeze({ lifetime: 'browser', within: 'workspace' })
/** A refusal with no sentence of the server's own. */
export const RATE_REFUSED = "Couldn't send that. Try again in a moment."
const RATINGS: readonly BriefRating[] = ['up', 'down']

export interface BriefRatingState {
  /** The viewer's thumb on this brief; null until they rate it. */
  readonly rating: BriefRating | null
  readonly busy: boolean
  /** Why the last rating was refused; null otherwise. */
  readonly refused: string | null
  readonly rate: (rating: BriefRating) => void
}

/** What RATED_KEY keeps: the brief's key and its thumb. */
export function ratedValue(brief: Brief, rating: BriefRating): ThemeStateValue {
  return { brief: briefKey(brief), rating }
}

/** The thumb `kept` holds for the brief whose key is `key`, or null (another brief's, none, or not one). Pure. */
export function keptRating(kept: unknown, key: string): BriefRating | null {
  if (kept === null || typeof kept !== 'object' || Array.isArray(kept)) return null
  const { brief, rating } = kept as { readonly brief?: unknown; readonly rating?: unknown }
  return brief === key ? RATINGS.find((known) => known === rating) ?? null : null
}

function refusalOf(failure: unknown): string {
  return failure instanceof Error && failure.message ? failure.message : RATE_REFUSED
}

export function useBriefRating(brief: Brief): BriefRatingState {
  const { runAsync, isRunning } = useRateBrief()
  const kept = useThemeState(RATED_KEY, RATED_STATE).value
  const [ratedHere, setRatedHere] = useState<ThemeStateValue | null>(null)
  const [refused, setRefused] = useState<string | null>(null)
  // A second press before the first is on its way (isRunning answers a tick later) sends nothing.
  const sending = useRef(false)
  const key = briefKey(brief)
  const rating = keptRating(ratedHere, key) ?? keptRating(kept, key)
  const rate = useCallback((thumb: BriefRating) => {
    if (rating !== null || sending.current) return
    sending.current = true
    setRefused(null)
    runAsync({ state_hash: brief.state_hash, rating: thumb }).then((answer) => {
      // The route can answer that it didn't take the rating without failing: that is a refusal too.
      if (answer?.ok === false) {
        setRefused(RATE_REFUSED)
        return
      }
      const value = ratedValue(brief, thumb)
      setRatedHere(value)
      writeThemeState(RATED_KEY, value, RATED_STATE)
    }, (failure: unknown) => setRefused(refusalOf(failure))).finally(() => {
      sending.current = false
    })
  }, [brief, rating, runAsync])
  return { rating, busy: isRunning, refused, rate }
}
