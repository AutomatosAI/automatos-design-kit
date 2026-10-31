/**
 * PRD-268 §6.4 (SDK 1.4.0): the person's own rating of each brief, by its state_hash, as the fake server remembers it.
 * It mirrors core's hooks/use-digest-api.ts (at 4ff489a460b2316ec9b7427efaa81a16552abddf): one cache entry per
 * state_hash that GET /api/activity/digest/feedback fills and a thumbs post updates once the server has it, read by
 * both the SDK's useRateBrief(stateHash) and the BriefCard stand-in's thumbs, so a press in either shows in both. A test
 * sets what the server already remembers with host.setBriefRating; the reset forgets every rating. Not an SDK name.
 */
import type { BriefRating } from '@automatos/theme-sdk'
import { cell, refuse } from '../cell.ts'

const NOT_A_RATING = 'setBriefRating needs a state_hash of some text and a rating of up, down or null.'

const remembered = cell<ReadonlyMap<string, BriefRating>>(new Map())

/** A copy of the ratings with `stateHash`'s set to `rating`, or left out for null. */
function withRating(stateHash: string, rating: BriefRating | null): ReadonlyMap<string, BriefRating> {
  const next = new Map(remembered.get())
  if (rating === null) next.delete(stateHash)
  else next.set(stateHash, rating)
  return next
}

/** The server has the person's `rating` of the brief `stateHash` names (a thumbs post it answered). */
export function rememberRating(stateHash: string, rating: BriefRating): void {
  remembered.set(withRating(stateHash, rating))
}

/** The person's rating of the brief `stateHash` names, for a component: null for none, or with no brief. */
export function useRememberedRating(stateHash: string | null): BriefRating | null {
  const ratings = remembered.use()
  return stateHash === null ? null : ratings.get(stateHash) ?? null
}

/** The controls of the ratings, gathered by host.ts through the proactive area's. */
export const ratingControls = Object.freeze({
  /** What the server remembers of the person's rating of the brief `stateHash` names; null: none (the default). */
  setBriefRating(stateHash: string, rating: BriefRating | null): void {
    if (typeof stateHash !== 'string' || stateHash.trim() === '') refuse(NOT_A_RATING)
    if (rating !== null && rating !== 'up' && rating !== 'down') refuse(NOT_A_RATING)
    remembered.set(withRating(stateHash, rating))
  },
})

export function resetRatings(): void {
  remembered.set(new Map())
}
