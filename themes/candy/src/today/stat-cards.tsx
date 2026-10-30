import type { ActivityStats } from '@automatos/theme-sdk'

import { cardSetOf, type CardSet } from '../ui/sets'
import { figureOf } from './today-words'
import styles from './today.module.css'
import ui from '../ui/ui.module.css'

/**
 * Today's four numbers (useActivityStats('1d'), the Command Center's own stats strip): working now, needs you and in
 * queue on the three gradient cards (the middle one stands 16 px taller), then agents active on a window card, "of"
 * the roster's total when the agent counts have answered. Each card has a white badge with a dot of its gradient's
 * first colour; a count still unknown shows "—". Cards lift 2 px on hover.
 */

export const STATS_LABEL = "Today's numbers"

interface StatCard {
  readonly key: 'working_now' | 'needs_attention' | 'tasks_in_queue' | 'agents_active'
  readonly label: string
  readonly sub: string | null
  readonly set: CardSet
  /** A gradient card; else a window card. */
  readonly gradient: boolean
}

function cardsOf(totalAgents: number | null): readonly StatCard[] {
  return [
    { key: 'working_now', label: 'Working now', sub: 'agents busy', set: cardSetOf(0), gradient: true },
    { key: 'needs_attention', label: 'Needs you', sub: 'waiting', set: cardSetOf(1), gradient: true },
    { key: 'tasks_in_queue', label: 'In queue', sub: 'tasks lined up', set: cardSetOf(2), gradient: true },
    { key: 'agents_active', label: 'Agents active', sub: totalAgents === null ? null : `of ${totalAgents}`, set: cardSetOf(3), gradient: false },
  ]
}

export interface StatCardsProps {
  readonly stats: ActivityStats | null
  /** The roster's total, from useAgentStats; null until it answers. */
  readonly totalAgents: number | null
}

export function StatCards({ stats, totalAgents }: StatCardsProps) {
  return (
    <ul className={styles.stats} aria-label={STATS_LABEL} aria-busy={stats === null ? true : undefined}>
      {cardsOf(totalAgents).map((card, index) => (
        <li
          key={card.key}
          className={[card.gradient ? ui.card : ui.window, ui.lift, styles.stat].join(' ')}
          data-set={card.gradient ? card.set : undefined}
          data-tall={index === 1 ? 'true' : undefined}
        >
          <span className={styles.badge} aria-hidden="true">
            <span className={styles.badgeDot} data-set={card.set} />
          </span>
          <span className={styles.statLabel}>{card.label}</span>
          <span className={styles.statLine}>
            <span className={styles.statFigure}>{figureOf(stats?.[card.key])}</span>
            {card.sub !== null && <span className={styles.statSub}>{card.sub}</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}
