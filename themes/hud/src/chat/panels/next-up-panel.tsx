import { type ScheduleItem, useActivitySchedule } from '@automatos/theme-sdk'

import { Panel } from '../../components/panel'
import styles from './panels.module.css'
import { runsWhen, upcomingRuns } from './work-rows'

/**
 * NEXT UP, under NEEDS YOU, as the design's SCHEDULED card draws it: what runs next this week (the SDK's
 * useActivitySchedule('7d')), soonest first, each its time, its agent and its name in mono, and the design's ◇
 * mark; the header's value is how many runs are scheduled.
 */

export const NEXT_UP_TITLE = 'Next up'
export const NEXT_UP_LOADING = 'Loading the schedule…'
export const NEXT_UP_FAILED = "Couldn't load the schedule."
export const NOTHING_NEXT = 'Nothing scheduled this week.'
/** How many runs the panel lists. */
export const NEXT_UP_SHOWN = 3

function runLine(item: ScheduleItem): string {
  return item.agent_name ? `${item.agent_name} · ${item.name}` : item.name
}

function NextUpRows({ scheduled }: { readonly scheduled: readonly ScheduleItem[] }) {
  const runs = upcomingRuns(scheduled).slice(0, NEXT_UP_SHOWN)
  if (runs.length === 0) return <p className={styles.note}>{NOTHING_NEXT}</p>
  const now = new Date()
  return (
    <ul className={styles.rows}>
      {runs.map(({ item, at }) => (
        <li key={item.id} className={styles.run}>
          <time className={styles.runTime} dateTime={at.toISOString()}>
            {runsWhen(at, now)}
          </time>
          <span className={styles.runName}>{runLine(item)}</span>
          <span className={styles.runMark} aria-hidden="true">
            ◇
          </span>
        </li>
      ))}
    </ul>
  )
}

export function NextUpPanel() {
  const { data, error } = useActivitySchedule('7d')
  const count = data === null ? undefined : String(upcomingRuns(data.scheduled).length)
  return (
    <Panel title={NEXT_UP_TITLE} value={count}>
      {data === null ? (
        <p className={styles.note}>{error === null ? NEXT_UP_LOADING : NEXT_UP_FAILED}</p>
      ) : (
        <NextUpRows scheduled={data.scheduled} />
      )}
    </Panel>
  )
}
