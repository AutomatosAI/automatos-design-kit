import { useCallback, useEffect, useState } from 'react'
import {
  type HideReason,
  type Suggestion,
  useHideSuggestion,
  useStartSuggestion,
  useSuggestions,
} from '@automatos/theme-sdk'

/**
 * HUD 1.2.0 (PRD-268): what the `▸ NEXT` line shows and does. It is the newest open suggestion (the SDK's
 * useSuggestions, newest first), one at a time, that the screen doesn't already show with its own Start (`listed`:
 * BRIEFING's, and from 1.3.0 the conversation's, its suggestion cards and its brief's rows), so one suggestion never
 * shows twice. START starts it and HIDE hides it, with the reason the person picked or none, through the SDK's own
 * routes (useStartSuggestion, useHideSuggestion). Started, the line says so for STARTED_MS in its place before the next
 * open one takes it; hidden, the next takes it at once; refused (the spend ceiling, the server unreachable), it says why
 * in one line and stays put. A suggestion decided here leaves the line at once, whatever the list still says until the
 * host reads it again. HUD 1.3.0: the same choice drives a suggestion card in the conversation (useSuggestionChoice,
 * picking the one suggestion its suggestion@1 part names).
 */

/** How long "Started. Auto is on it." stands in the line's place. */
export const STARTED_MS = 4_000
/** A refusal with no sentence of the server's own. */
export const NEXT_REFUSED = "Couldn't reach Automatos. Try again in a moment."

export interface NextSuggestion {
  /** The newest open suggestion not decided here; null for none. */
  readonly suggestion: Suggestion | null
  /** A Start went through just now: the line says so. */
  readonly started: boolean
  /** Start or Hide is on its way. */
  readonly busy: boolean
  /** Why the last Start or Hide was refused, in one line; null otherwise. */
  readonly refused: string | null
  readonly start: () => void
  readonly hide: (reason?: HideReason) => void
}

const NONE: readonly Suggestion[] = []
const NO_IDS: readonly string[] = []

/** Picks the suggestion to show from the open list, less the ones decided here; null for none. */
export type SuggestionPick = (list: readonly Suggestion[], decided: readonly string[]) => Suggestion | null

/** The newest open suggestion neither decided here nor `listed` on screen, or null. */
export function nextOf(list: readonly Suggestion[], decided: readonly string[], listed: readonly string[]): Suggestion | null {
  return list.find((open) => open.status === 'open' && !decided.includes(open.id) && !listed.includes(open.id)) ?? null
}

/** The open suggestion `id` names, unless it was decided here; null for none (not open, or not the viewer's). */
export function openSuggestion(list: readonly Suggestion[], decided: readonly string[], id: string): Suggestion | null {
  return list.find((open) => open.id === id && open.status === 'open' && !decided.includes(id)) ?? null
}

function refusalOf(failure: unknown): string {
  return failure instanceof Error && failure.message ? failure.message : NEXT_REFUSED
}

/** The started line's few seconds: on from `markStarted` until STARTED_MS later. */
function useJustStarted(): readonly [boolean, () => void] {
  const [startedAt, setStartedAt] = useState<number | null>(null)
  useEffect(() => {
    if (startedAt === null) return undefined
    const timer = setTimeout(() => setStartedAt(null), STARTED_MS)
    return () => clearTimeout(timer)
  }, [startedAt])
  const markStarted = useCallback(() => setStartedAt(Date.now()), [])
  return [startedAt !== null, markStarted]
}

/** The suggestion `pick` chooses, with Start and Hide on it, its started line and its refusal. */
export function useSuggestionChoice(pick: SuggestionPick): NextSuggestion {
  const { data } = useSuggestions()
  const starter = useStartSuggestion()
  const hider = useHideSuggestion()
  const [decided, setDecided] = useState<readonly string[]>([])
  const [refused, setRefused] = useState<string | null>(null)
  const [started, markStarted] = useJustStarted()
  const suggestion = pick(data ?? NONE, decided)
  const id = suggestion?.id ?? null
  const decide = useCallback((done: string) => setDecided((known) => [...known, done]), [])
  const refuse = useCallback((failure: unknown) => setRefused(refusalOf(failure)), [])
  const { runAsync: runStart } = starter
  const { runAsync: runHide } = hider
  const start = useCallback(() => {
    if (id === null) return
    setRefused(null)
    runStart({ id }).then(() => {
      decide(id)
      markStarted()
    }, refuse)
  }, [id, runStart, decide, markStarted, refuse])
  const hide = useCallback((reason?: HideReason) => {
    if (id === null) return
    setRefused(null)
    runHide(reason === undefined ? { id } : { id, reason }).then(() => decide(id), refuse)
  }, [id, runHide, decide, refuse])
  return { suggestion, started, busy: starter.isRunning || hider.isRunning, refused, start, hide }
}

/** The `▸ NEXT` line's suggestion: the newest open one not `listed` on screen. */
export function useNextSuggestion(listed: readonly string[] = NO_IDS): NextSuggestion {
  return useSuggestionChoice((list, decided) => nextOf(list, decided, listed))
}
