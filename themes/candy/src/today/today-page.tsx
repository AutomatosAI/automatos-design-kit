import {
  openGlobalSearch,
  useActivitySchedule,
  useActivityStats,
  useAgentStats,
  useBoardEventStream,
  useNeedsYou,
} from '@automatos/theme-sdk'

import { THEME_HEADING } from '../theme'
import { useNow } from '../ui/use-now'
import { ComingUp } from './coming-up'
import { Hero } from './hero'
import { NeedsWindow } from './needs-window'
import { StatCards } from './stat-cards'
import { figureOf } from './today-words'
import styles from './today.module.css'
import ui from '../ui/ui.module.css'

/**
 * Candy's own route /x/today (theme.json "routes"), all from the SDK's pages/command-center area: the header row
 * (Today and the host's search), the hero (the greeting, what waits for the person, the orb with what was completed
 * today), the four numbers of the day, and the Needs-you and Coming-up windows. It holds the board's event stream
 * open while it is on screen, as the Command Center does, so Needs you moves the moment the board does. Below
 * 1024 px everything stacks in one column, as on the design's phone.
 */

export const TODAY_TITLE = 'Today'
export const SEARCH_AUTOMATOS = 'Search Automatos'
const STATS_PERIOD = '1d'

export function TodayPage() {
  useBoardEventStream(true)
  const now = useNow()
  const stats = useActivityStats(STATS_PERIOD)
  const needs = useNeedsYou()
  const schedule = useActivitySchedule()
  const agentStats = useAgentStats()
  return (
    <div className={styles.page}>
      <div className={`${ui.pageHead} ${styles.head}`}>
        <h1 className={ui.pageTitle} tabIndex={-1} {...THEME_HEADING}>
          {TODAY_TITLE}
        </h1>
        <button type="button" className={styles.search} onClick={() => openGlobalSearch()}>
          <span className={styles.searchRing} aria-hidden="true" />
          {SEARCH_AUTOMATOS}
        </button>
      </div>
      <Hero now={now} waiting={needs.data?.total ?? null} completed={figureOf(stats.data?.completed_today)} />
      <StatCards stats={stats.data} totalAgents={agentStats.data?.total_agents ?? null} />
      <div className={styles.windows}>
        <NeedsWindow query={needs} now={now} />
        <ComingUp query={schedule} now={now} />
      </div>
    </div>
  )
}
