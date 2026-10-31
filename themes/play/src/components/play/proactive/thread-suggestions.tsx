'use client'

import { SuggestionCard, useSuggestions } from '@automatos/theme-sdk'

import { threadSuggestionsOf } from '../../../lib/play/proactive'
import { useKeptStarted } from './pinned-suggestion'
import styles from './proactive.module.css'

/**
 * Play 1.4.0 (PRD-268 §6.5.1, §6.11.2, §6.12.4) — the suggestions Auto posted into the conversation, each as the host's
 * SuggestionCard under the message whose `suggestion@1` part names it: "Auto suggests", the title and detail as Auto's
 * words, what Start does, Start and Hide with its reasons, and the caption. Start and Hide are the card's own, the
 * proactive area's (the same as the line pinned above the message box), so the pinned line never repeats a suggestion
 * a card here shows (lib/play/proactive.ts listedSuggestionIds) and each Start is on screen once.
 *
 * A card draws from the open list (useSuggestions) by the id its part names, so its state is the live one and survives
 * a reload: while the suggestion is open it has Start and Hide; once it is decided (here, on the phone, on the Command
 * Center or by expiry) its card goes and the message's words stay. One just started here stays in its place for
 * "Started. Auto is on it." (KEEP_STARTED_MS), as the pinned line's does. The card marks Auto's words itself and keeps
 * its controls outside the mark; it stands outside the reply's own mark, after it.
 */

export interface ThreadSuggestionsProps {
  /** The suggestions the message's `suggestion@1` parts name, in order. */
  readonly ids: readonly string[]
}

export function ThreadSuggestions({ ids }: ThreadSuggestionsProps) {
  const { data } = useSuggestions()
  const [kept, keep] = useKeptStarted()
  const shown = threadSuggestionsOf(ids, data, kept)
  if (shown.length === 0) return null
  return (
    <div className={styles.thread} data-thread-suggestions="">
      {shown.map((suggestion) => (
        <SuggestionCard key={suggestion.id} suggestion={suggestion} onStarted={() => keep(suggestion)} className={styles.card} />
      ))}
    </div>
  )
}
