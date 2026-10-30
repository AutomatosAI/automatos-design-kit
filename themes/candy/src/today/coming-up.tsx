import { useMemo } from 'react'
import type { ActivitySchedule, CommandCenterQuery } from '@automatos/theme-sdk'

import { comingRows } from './schedule-rows'
import { Panel, panelState } from './panel'
import styles from './today.module.css'

/**
 * Today's Coming-up window: the next three things on the schedule (useActivitySchedule), each with a gradient dot
 * on a chip circle, its name, its kind in the product's words (Playbook, Routine, Mission, Task, Post) and when it
 * runs next at the right.
 */

export const COMING_TITLE = 'Coming up'
export const COMING_EMPTY = 'Nothing scheduled.'
export const COMING_FAILED = "Couldn't load the schedule."
export const COMING_ROWS = 3

export function ComingUp({ query, now }: { readonly query: CommandCenterQuery<ActivitySchedule>; readonly now: number }) {
  const { data, error, refetch } = query
  const rows = useMemo(() => (data ? comingRows(data, now, COMING_ROWS) : []), [data, now])
  return (
    <Panel title={COMING_TITLE} state={panelState(data, error, rows.length)} failed={COMING_FAILED} empty={COMING_EMPTY} onRetry={refetch}>
      <ul className={styles.rows}>
        {rows.map((row) => (
          <li key={row.key} className={styles.row}>
            <span className={styles.dotCircle} aria-hidden="true">
              <span className={styles.scheduleDot} data-set={row.set} />
            </span>
            <span className={styles.rowText}>
              <span className={styles.rowTitle} title={row.name}>
                {row.name}
              </span>
              <span className={styles.rowMeta}>{row.kind}</span>
            </span>
            {row.when !== null && <span className={styles.when}>{row.when}</span>}
          </li>
        ))}
      </ul>
    </Panel>
  )
}
