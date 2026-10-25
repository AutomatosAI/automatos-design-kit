/**
 * The made-up data the browser harness's fake host answers the page areas' reads with, so a theme's panels show rows
 * in the shots instead of their loading line. In a theme's tests a read stays loading until the test sets its answer
 * (host.setPageQuery, src/internal/page-views.ts); the harness page sets these once, after its reset (app/main.tsx),
 * as the Deliverables fake answers from its own fixtures. A read answers by its hook, whatever its arguments.
 *
 * - useAgents and useAgentStats: the roster and its counts (fixtures/agents/), which HUD's AGENTS panel lists.
 * - useActivityFeed: one Mission running, on its second of three steps (fixtures/activity/feed.json), which HUD's
 *   MISSION panel shows. The fake answers every filter with that one Mission.
 * - useActivityStats: the day's numbers (fixtures/activity/stats.json: working now, completed today, needs you, in
 *   queue), period '1d'. The fake answers every window with them.
 * - useNeedsYou: six rows across its five kinds, in review, question, approval, stuck and failed
 *   (fixtures/activity/needs-you.json), the total the day's needs-you number.
 * - useActivitySchedule: four runs, each a few hours after the fixtures' made-up morning (14 Oct 2026, 09:05 UTC,
 *   fixtures/agents/stats.json's timestamp), so the shots read the same on every run
 *   (fixtures/activity/schedule.json). The fake answers every range with them.
 */
import type { ActivityFeed, ActivitySchedule, ActivityStats, AgentStatistics, NeedsYou, RosterAgent } from '@automatos/theme-sdk'
import feed from '../../fixtures/activity/feed.json'
import needsYou from '../../fixtures/activity/needs-you.json'
import schedule from '../../fixtures/activity/schedule.json'
import activityStats from '../../fixtures/activity/stats.json'
import roster from '../../fixtures/agents/roster.json'
import stats from '../../fixtures/agents/stats.json'
import { host } from '../host.ts'

/** A fixture as the SDK type it holds (read as JSON, its strings are wider than the type's unions). */
const fixtureOf = <T>(json: unknown): T => json as T

/** The page reads the harness page answers, by hook, with their data. */
export const SAMPLE_PAGE_DATA = Object.freeze({
  agents: fixtureOf<readonly RosterAgent[]>(roster),
  agentStats: fixtureOf<AgentStatistics>(stats),
  activityFeed: fixtureOf<ActivityFeed>(feed),
  activityStats: fixtureOf<ActivityStats>(activityStats),
  needsYou: fixtureOf<NeedsYou>(needsYou),
  activitySchedule: fixtureOf<ActivitySchedule>(schedule),
})

/** Sets the fake host's answers to the reads above. */
export function giveSampleData(): void {
  host.setPageQuery('useAgents', { data: SAMPLE_PAGE_DATA.agents })
  host.setPageQuery('useAgentStats', { data: SAMPLE_PAGE_DATA.agentStats })
  host.setPageQuery('useActivityFeed', { data: SAMPLE_PAGE_DATA.activityFeed })
  host.setPageQuery('useActivityStats', { data: SAMPLE_PAGE_DATA.activityStats })
  host.setPageQuery('useNeedsYou', { data: SAMPLE_PAGE_DATA.needsYou })
  host.setPageQuery('useActivitySchedule', { data: SAMPLE_PAGE_DATA.activitySchedule })
}
