/**
 * The made-up data the browser harness's fake host answers the page areas' reads with, so a theme's panels show rows
 * in the shots instead of their loading line. In a theme's tests a read stays loading until the test sets its answer
 * (host.setPageQuery, src/internal/page-views.ts); the harness page sets these once, after its reset (app/main.tsx),
 * as the Deliverables fake answers from its own fixtures.
 *
 * - useAgents and useAgentStats: the roster and its counts (fixtures/agents/), which HUD's AGENTS panel lists.
 * - useActivityFeed: one Mission running, on its second of three steps (fixtures/activity/feed.json), which HUD's
 *   MISSION panel shows. The fake answers every filter with that one Mission.
 */
import type { ActivityFeed, AgentStatistics, RosterAgent } from '@automatos/theme-sdk'
import feed from '../../fixtures/activity/feed.json'
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
})

/** Sets the fake host's answers to the reads above. */
export function giveSampleData(): void {
  host.setPageQuery('useAgents', { data: SAMPLE_PAGE_DATA.agents })
  host.setPageQuery('useAgentStats', { data: SAMPLE_PAGE_DATA.agentStats })
  host.setPageQuery('useActivityFeed', { data: SAMPLE_PAGE_DATA.activityFeed })
}
