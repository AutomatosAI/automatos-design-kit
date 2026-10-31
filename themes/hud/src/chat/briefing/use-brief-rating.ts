import { useCallback, useRef, useState } from 'react'
import { type Brief, type BriefRating, useRateBrief } from '@automatos/theme-sdk'

/**
 * HUD 1.3.0 (PRD-268, SDK 1.4.0): the brief's thumbs, in BRIEFING's footer. Up or down goes through the SDK's
 * useRateBrief (the host's digest feedback route, which takes the brief's state_hash and 1 for up, -1 for down). The
 * thumb shown is the person's own rating of this brief as the server keeps it (useRateBrief(state_hash).rating, the
 * one the host's BriefCard thumbs show too), so it is the same in every browser they sign in from. Once there is one,
 * both thumbs stay pressed or not as rated and neither takes a press, as the host's card does; a new brief (another
 * day, another state) can be rated again. While the rating is on its way neither thumb takes a press; refused (the
 * route failing), it says why and can be tried again.
 */

/** A refusal with no sentence of the server's own. */
export const RATE_REFUSED = "Couldn't send that. Try again in a moment."

export interface BriefRatingState {
  /** The viewer's thumb on this brief; null until they rate it. */
  readonly rating: BriefRating | null
  readonly busy: boolean
  /** Why the last rating was refused; null otherwise. */
  readonly refused: string | null
  readonly rate: (rating: BriefRating) => void
}

function refusalOf(failure: unknown): string {
  return failure instanceof Error && failure.message ? failure.message : RATE_REFUSED
}

export function useBriefRating(brief: Brief): BriefRatingState {
  const { runAsync, isRunning, rating } = useRateBrief(brief.state_hash)
  const [refused, setRefused] = useState<string | null>(null)
  // A second press before the first is on its way (isRunning answers a tick later) sends nothing.
  const sending = useRef(false)
  const rate = useCallback((thumb: BriefRating) => {
    if (rating !== null || sending.current) return
    sending.current = true
    setRefused(null)
    runAsync({ state_hash: brief.state_hash, rating: thumb }).then(
      () => undefined,
      (failure: unknown) => setRefused(refusalOf(failure)),
    ).finally(() => {
      sending.current = false
    })
  }, [brief.state_hash, rating, runAsync])
  return { rating, busy: isRunning, refused, rate }
}
