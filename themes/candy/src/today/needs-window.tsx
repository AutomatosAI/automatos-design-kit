import { useMemo } from 'react'
import { HostLink, type CommandCenterQuery, type NeedsYou } from '@automatos/theme-sdk'

import { cardSetOf, initialOf } from '../ui/sets'
import { agoWords } from '../ui/when'
import { needRows, NEEDS_YOU_HREF, SOME_AGENT, type NeedRow } from './needs-rows'
import { Panel, panelState } from './panel'
import styles from './today.module.css'
import ui from '../ui/ui.module.css'

/**
 * Today's Needs-you window: the newest three things waiting for the person (useNeedsYou, every kind in one list),
 * each with its agent's initial on a gradient circle, its title on one line, who and how long ago, and Open, which
 * goes to the thing itself; "See all" goes to the Command Center with the whole list.
 */

export const NEEDS_TITLE = 'Needs you'
export const NEEDS_EMPTY = 'Nothing needs you right now.'
export const NEEDS_FAILED = "Couldn't load what needs you."
export const OPEN = 'Open'
export const NEEDS_ROWS = 3

function NeedLine({ row, index, now }: { readonly row: NeedRow; readonly index: number; readonly now: number }) {
  const when = agoWords(row.at, now)
  return (
    <li className={styles.row}>
      <span className={`${ui.avatar} ${styles.rowAvatar}`} data-set={cardSetOf(index)} aria-hidden="true">
        {initialOf(row.agent)}
      </span>
      <span className={styles.rowText}>
        <span className={styles.rowTitle} title={row.title}>
          {row.title}
        </span>
        <span className={styles.rowMeta}>{[row.agent ?? SOME_AGENT, when].filter(Boolean).join(' · ')}</span>
      </span>
      <HostLink href={row.href} className={`${ui.quiet} ${ui.small}`}>
        {OPEN} <span className={ui.srOnly}>{row.title}</span>
      </HostLink>
    </li>
  )
}

export function NeedsWindow({ query, now }: { readonly query: CommandCenterQuery<NeedsYou>; readonly now: number }) {
  const { data, error, refetch } = query
  const rows = useMemo(() => (data ? needRows(data).slice(0, NEEDS_ROWS) : []), [data])
  const total = data?.total ?? 0
  const seeAll =
    total > 0 ? (
      <HostLink href={NEEDS_YOU_HREF} className={ui.link}>
        See all {total}
      </HostLink>
    ) : null
  return (
    <Panel
      title={NEEDS_TITLE}
      state={panelState(data, error, rows.length)}
      failed={NEEDS_FAILED}
      empty={NEEDS_EMPTY}
      onRetry={refetch}
      action={seeAll}
    >
      <ul className={styles.rows}>
        {rows.map((row, index) => (
          <NeedLine key={row.key} row={row} index={index} now={now} />
        ))}
      </ul>
    </Panel>
  )
}
