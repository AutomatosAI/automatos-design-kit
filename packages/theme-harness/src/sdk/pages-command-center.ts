/**
 * PRD-261 B-02b: the fake of SDK area `pages/command-center`. It mirrors core's
 * frontend/lib/theme-sdk/pages/command-center.ts (at 101a0bf33f64fb4f89af81b4293415be60b661ac) in the page
 * areas' frozen views (src/internal/page-views.ts): six reads answering what a test set (host.setPageQuery),
 * each kept with the theme's arguments, and the board's event stream, which is counted while open
 * (host.boardStreams()); a board push reaches a theme as core's does, as a host event (host.emitHostEvent).
 */
import type {
  ActivityFeed, ActivityFeedFilters, ActivityPeriod, ActivitySchedule, ActivityStats, NeedsYou, QuestionGrants, ScheduleRange, Watches,
} from '@automatos/theme-sdk'
import { useEffect } from 'react'
import { usePageQuery } from '../internal/page-views.ts'

type Sdk = typeof import('@automatos/theme-sdk')

const NO_ARGS: readonly unknown[] = Object.freeze([])

let openStreams = 0

/** command-center.ts:133. */
export const useActivityFeed = ((filters?: ActivityFeedFilters) =>
  usePageQuery<ActivityFeed>('useActivityFeed', [filters])) satisfies Sdk['useActivityFeed']

/** command-center.ts:138. */
export const useActivityStats = ((period?: ActivityPeriod) =>
  usePageQuery<ActivityStats>('useActivityStats', [period])) satisfies Sdk['useActivityStats']

/** command-center.ts:143. */
export const useActivitySchedule = ((range?: ScheduleRange) =>
  usePageQuery<ActivitySchedule>('useActivitySchedule', [range])) satisfies Sdk['useActivitySchedule']

/** command-center.ts:148. */
export const useQuestions = (() => usePageQuery<QuestionGrants>('useQuestions', NO_ARGS)) satisfies Sdk['useQuestions']

/** command-center.ts:153. */
export const useNeedsYou = (() => usePageQuery<NeedsYou>('useNeedsYou', NO_ARGS)) satisfies Sdk['useNeedsYou']

/** command-center.ts:158. */
export const useWatches = ((includeClosed?: boolean) =>
  usePageQuery<Watches>('useWatches', [includeClosed === true])) satisfies Sdk['useWatches']

/** command-center.ts:163: open while `enabled` (on by default) and mounted. */
export const useBoardEventStream = ((enabled?: boolean): void => {
  const open = enabled !== false
  useEffect(() => {
    if (!open) return undefined
    openStreams += 1
    return () => {
      openStreams -= 1
    }
  }, [open])
}) satisfies Sdk['useBoardEventStream']

/** The controls of this area, gathered by host.ts. */
export const commandCenterControls = Object.freeze({
  /** How many board event streams a theme holds open now. */
  boardStreams(): number {
    return openStreams
  },
})

export function resetCommandCenter(): void {
  openStreams = 0
}
