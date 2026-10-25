import { type ActivityStats, useActivityStats } from '@automatos/theme-sdk'

import { Panel } from '../../components/panel'
import styles from './panels.module.css'

/**
 * TODAY, at the top of the right column where the design's SPEND stood (the SDK gives a theme no spend): the
 * Command Center's numbers for the day (the SDK's useActivityStats('1d')), each a mono label over a number in the
 * look's display face: who is working now, what was completed today, what needs you (in the accent while anything
 * does) and what waits in the queue.
 */

export const TODAY_TITLE = 'Today'
export const TODAY_LOADING = "Loading today's numbers…"
export const TODAY_FAILED = "Couldn't load today's numbers."

type StatKey = 'working_now' | 'completed_today' | 'needs_attention' | 'tasks_in_queue'

export const TODAY_STATS: readonly { readonly key: StatKey; readonly label: string }[] = [
  { key: 'working_now', label: 'Working now' },
  { key: 'completed_today', label: 'Completed today' },
  { key: 'needs_attention', label: 'Needs you' },
  { key: 'tasks_in_queue', label: 'In queue' },
]

/** Needs you is in the accent while anything needs you; every other number in the text. */
function toneOf(key: StatKey, value: number): 'live' | undefined {
  return key === 'needs_attention' && value > 0 ? 'live' : undefined
}

function TodayStats({ stats }: { readonly stats: ActivityStats }) {
  return (
    <dl className={styles.stats}>
      {TODAY_STATS.map(({ key, label }) => (
        <div key={key} className={styles.stat} data-tone={toneOf(key, stats[key])}>
          <dt className={styles.statLabel}>{label}</dt>
          <dd className={styles.statValue}>{stats[key]}</dd>
        </div>
      ))}
    </dl>
  )
}

export function TodayPanel() {
  const { data, error } = useActivityStats('1d')
  return (
    <Panel title={TODAY_TITLE}>
      {data === null ? (
        <p className={styles.note}>{error === null ? TODAY_LOADING : TODAY_FAILED}</p>
      ) : (
        <TodayStats stats={data} />
      )}
    </Panel>
  )
}
