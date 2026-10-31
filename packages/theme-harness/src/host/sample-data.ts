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
 * - useMissions: seven Missions, two running (the feed's laptop shortlist among them), two waiting on you, two done
 *   and one failed (fixtures/missions/list.json), which a theme's own Missions page lists. The fake answers every
 *   filter with them.
 * - The Deliverables list (useDeliverables): the six Deliverables of fixtures/deliverables/list.json, the laptop
 *   shortlist the conversation made among them, filtered and paged as the backend does.
 * - SDK 1.3.0's proactive area: the day's brief (useBrief, fixtures/proactive/brief.json: the fixtures' morning, what
 *   needs you as needs-you.json has it, two suggestions, the day's four runs, two things since the last brief and one
 *   the brief couldn't check), what Auto depends on (useReadiness, readiness.json: ready, not checked and needs setup)
 *   and the open suggestions (useSuggestions, suggestions.json: a ticket to file and a chat to open). The brief exists
 *   only while the workspace's proactive mode is shadow or live; with it off, core's open answers 404 `brief_off` and
 *   the host stays quiet, so useBrief answers no brief, not loading (`showBrief(false)`, the address's `brief=off`).
 *   A theme treats a day with no brief as normal. No calibration is offered, as core's server offers none yet
 *   (calibration.json is a test's, host.setCalibration).
 */
import type {
  ActivityFeed, ActivitySchedule, ActivityStats, AgentStatistics, Brief, Calibration, DeliverableListResponse, MissionList, NeedsYou, Readiness,
  RosterAgent, Suggestion,
} from '@automatos/theme-sdk'
import feed from '../../fixtures/activity/feed.json'
import needsYou from '../../fixtures/activity/needs-you.json'
import schedule from '../../fixtures/activity/schedule.json'
import activityStats from '../../fixtures/activity/stats.json'
import roster from '../../fixtures/agents/roster.json'
import stats from '../../fixtures/agents/stats.json'
import deliverables from '../../fixtures/deliverables/list.json'
import missions from '../../fixtures/missions/list.json'
import brief from '../../fixtures/proactive/brief.json'
import calibration from '../../fixtures/proactive/calibration.json'
import readiness from '../../fixtures/proactive/readiness.json'
import suggestions from '../../fixtures/proactive/suggestions.json'
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
  missions: fixtureOf<MissionList>(missions),
  deliverables: fixtureOf<DeliverableListResponse>(deliverables),
  brief: fixtureOf<Brief>(brief),
  readiness: fixtureOf<Readiness>(readiness),
  suggestions: fixtureOf<readonly Suggestion[]>(suggestions.suggestions),
  calibration: fixtureOf<Calibration>(calibration),
})

/** The day's brief (true), or no brief today (false): useBrief answers no data and is not loading, as with it off. */
export function showBrief(on: boolean): void {
  host.setPageQuery('useBrief', on ? { data: SAMPLE_PAGE_DATA.brief } : 'idle')
}

/** Sets the fake host's answers to the reads above. */
export function giveSampleData(): void {
  host.setPageQuery('useAgents', { data: SAMPLE_PAGE_DATA.agents })
  host.setPageQuery('useAgentStats', { data: SAMPLE_PAGE_DATA.agentStats })
  host.setPageQuery('useActivityFeed', { data: SAMPLE_PAGE_DATA.activityFeed })
  host.setPageQuery('useActivityStats', { data: SAMPLE_PAGE_DATA.activityStats })
  host.setPageQuery('useNeedsYou', { data: SAMPLE_PAGE_DATA.needsYou })
  host.setPageQuery('useActivitySchedule', { data: SAMPLE_PAGE_DATA.activitySchedule })
  host.setPageQuery('useMissions', { data: SAMPLE_PAGE_DATA.missions })
  host.setDeliverables(SAMPLE_PAGE_DATA.deliverables)
  showBrief(true)
  host.setPageQuery('useReadiness', { data: SAMPLE_PAGE_DATA.readiness })
  host.setPageQuery('useSuggestions', { data: SAMPLE_PAGE_DATA.suggestions })
}
