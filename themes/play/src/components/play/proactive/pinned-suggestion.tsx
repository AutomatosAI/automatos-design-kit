'use client'

import { type FocusEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { type Suggestion, SuggestionCard, useSuggestions } from '@automatos/theme-sdk'

import { newestOpenSuggestion } from '../../../lib/play/proactive'
import styles from './proactive.module.css'

/**
 * Play 1.3.0 (PRD-268 §6.5.1, §6.12.3, §6.12.4) — the newest open suggestion, pinned above the message box, between
 * PlayTrialBanner and MessageBox, on a desktop and on the phone alike. It is the host's SuggestionCard: its one-line
 * variant ("Auto suggests", the title as Auto's words, Start and Hide with its reasons), whose title opens the full
 * card in the same place (what Start does, about how many credits once known); the card folds back to the line on
 * Escape or once focus leaves it. The words and every state are the card's own.
 *
 * One suggestion surface: it steps aside while the turn's own Mission suggestion is unanswered (`hidden`), and it never
 * pins a suggestion the brief on screen already lists with its Start (`listed`). Started from here, it stays in its
 * place for "Started. Auto is on it." (KEEP_STARTED_MS) before the next open one takes it; hidden, it goes at once.
 * Nothing shows when no suggestion is open. Suggestions come from useSuggestions, the one list behind every surface.
 */

/** §6.12.3: "Started. Auto is on it." shows for 4 s in the suggestion's place. */
export const KEEP_STARTED_MS = 4_000

const ESCAPE = 'Escape'

export interface PlayPinnedSuggestionProps {
  /** The turn's Mission suggestion waits for an answer: nothing pinned. */
  readonly hidden: boolean
  /** Suggestions already on screen with their Start (the brief's): never pinned twice. */
  readonly listed: readonly string[]
}

/** A suggestion just started here, kept in its place for KEEP_STARTED_MS. */
function useKeptStarted(): readonly [Suggestion | null, (suggestion: Suggestion) => void] {
  const [kept, setKept] = useState<Suggestion | null>(null)
  useEffect(() => {
    if (kept === null) return undefined
    const timer = setTimeout(() => setKept(null), KEEP_STARTED_MS)
    return () => clearTimeout(timer)
  }, [kept])
  return [kept, setKept]
}

export function PlayPinnedSuggestion({ hidden, listed }: PlayPinnedSuggestionProps) {
  const { data } = useSuggestions()
  const [kept, keep] = useKeptStarted()
  const [openedId, setOpenedId] = useState<string | null>(null)
  const holder = useRef<HTMLDivElement>(null)
  const newest = kept ?? newestOpenSuggestion(data, listed)
  if (hidden || newest === null) return null
  const opened = openedId === newest.id

  const open = (): void => {
    setOpenedId(newest.id)
    holder.current?.focus()
  }
  const fold = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!opened || event.key !== ESCAPE || event.defaultPrevented) return
    setOpenedId(null)
    holder.current?.focus()
  }
  const leave = (event: FocusEvent<HTMLDivElement>): void => {
    if (opened && !event.currentTarget.contains(event.relatedTarget as Node | null)) setOpenedId(null)
  }
  return (
    <div ref={holder} tabIndex={-1} className={styles.pinned} data-pinned-suggestion="" onKeyDown={fold} onBlur={leave}>
      <SuggestionCard
        key={newest.id}
        suggestion={newest}
        variant={opened ? 'card' : 'pinned'}
        onOpen={open}
        onStarted={() => keep(newest)}
      />
    </div>
  )
}
