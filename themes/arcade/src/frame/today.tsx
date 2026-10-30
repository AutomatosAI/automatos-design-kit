import { useActivityStats } from '@automatos/theme-sdk'

import styles from './frame.module.css'

/**
 * Today's numbers as the status bar's game counters (the brief's "today's numbers from the host's activity data"):
 * XP is what was completed today, ! is what needs you, QUEST is what is working now, all from the SDK's
 * useActivityStats('1d'), the Command Center's own stats. XP and levels are display only: a count, never a store.
 * Each counter's game word sits on a window-ground chip, so its colour is always measured on the window.
 */

export const TODAY_LABEL = 'Today'
const UNKNOWN = '–'

interface Counter {
  readonly key: 'completed_today' | 'needs_attention' | 'working_now'
  readonly game: string
  /** The phone's shorter game word. */
  readonly short: string
  readonly words: string
  readonly tone: 'xp' | 'qs' | 'mp'
}

export const COUNTERS: readonly Counter[] = [
  { key: 'completed_today', game: 'XP', short: 'XP', words: 'done today', tone: 'xp' },
  { key: 'needs_attention', game: '!', short: '!', words: 'need you', tone: 'qs' },
  { key: 'working_now', game: 'QUEST', short: 'QST', words: 'in progress', tone: 'mp' },
]

export function Today({ compact = false }: { readonly compact?: boolean }) {
  const { data } = useActivityStats('1d')
  return (
    <ul className={styles.today} aria-label={TODAY_LABEL} data-compact={compact ? 'true' : undefined}>
      {COUNTERS.map((counter) => {
        const value = data === null ? UNKNOWN : String(data[counter.key])
        return (
          <li key={counter.key} className={styles.counter}>
            <span className={styles.counterGame} data-tone={counter.tone} aria-hidden="true">
              {compact ? counter.short : counter.game}
            </span>
            <span className={styles.counterValue}>{value}</span>
            <span className={compact ? styles.hidden : styles.counterWords}>{counter.words}</span>
          </li>
        )
      })}
    </ul>
  )
}
