// The made-up answers the harness page gives the page areas' reads (src/host/sample-data.ts), so a theme's panels show
// rows in the shots, not their loading line: HUD's AGENTS and MISSION panels, and panels on the Command Center's day
// (the reads HUD's TODAY, NEEDS YOU and NEXT UP panels make). Until they are given every read is loading, as in a
// theme's tests; once given, the roster, its counts, one running Mission, the day's numbers (in any window asked),
// what needs you across its five kinds, the runs coming up, the workspace's Missions and its Deliverables answer; and
// the harness page gives them before it draws the mock host (app/main.tsx). SDK 1.3.0's proactive area: the day's
// brief, made from the same rows, what Auto depends on and the open suggestions; and no brief today (the workspace's
// brief off: core's open answers brief_off and the host stays quiet), which a theme draws as a normal day.
import {
  DELIVERABLE_FEED_FILTERS, type ActivitySchedule, type ActivityStats, type NeedsYou, type NeedsYouAskRow, type NeedsYouTicketRow,
  useActivityFeed, useActivitySchedule, useActivityStats, useAgents, useAgentStats, useBrief, useCalibration, useDeliverables, useMissions,
  useNeedsYou, useReadiness, useSuggestions,
} from '@automatos/theme-sdk'
import { act, render, renderHook, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it } from 'vitest'
import { host } from '../src/host.ts'
import { giveSampleData, SAMPLE_PAGE_DATA, showBrief } from '../src/host/sample-data.ts'

const LOADING = 'loading'
/** HUD's MISSION panel's read (themes/hud/src/chat/panels/mission-panel.tsx RUNNING_MISSION). */
const RUNNING_MISSION = Object.freeze({ types: ['mission'] as const, status: 'working' as const, limit: 1 })
/** Needs-you's kinds, in the order core lists them. */
const NEEDS_KINDS = ['review', 'question', 'approval', 'stuck', 'failed'] as const
const HOUR_MS = 3_600_000
/** How far after the fixtures' made-up morning the runs may be: the same day. */
const SAME_DAY_HOURS = 12
// From the string import.meta.url: under jsdom, `new URL()` is jsdom's class, which fileURLToPath refuses.
const MAIN = resolve(dirname(fileURLToPath(import.meta.url)), '../app/main.tsx')

/** The three reads as a theme's agent and Mission panels make them, each as a line. */
function Panels() {
  const agents = useAgents().data
  const stats = useAgentStats().data
  const mission = useActivityFeed(RUNNING_MISSION).data?.items[0]
  const progress = mission?.step_progress
  return (
    <ul>
      <li data-testid="agents">{agents === null ? LOADING : agents.map((agent) => agent.name).join(', ')}</li>
      <li data-testid="stats">{stats === null ? LOADING : `${stats.active_agents} of ${stats.total_agents} active`}</li>
      <li data-testid="mission">
        {mission === undefined ? LOADING : `${mission.type} ${mission.status}: ${mission.name}, step ${progress?.current} of ${progress?.total}`}
      </li>
    </ul>
  )
}

const dayLine = (day: ActivityStats): string =>
  `${day.working_now} working now, ${day.completed_today} completed today, ${day.needs_attention} need you, ${day.tasks_in_queue} in queue (${day.period})`

const countsLine = (needs: NeedsYou): string =>
  `${needs.total} need you: ${NEEDS_KINDS.map((kind) => `${needs.counts[kind]} ${kind}`).join(', ')}`

/** Every row behind the needs-you number, in core's order, as its kind, its ticket's number and its agent. */
function rowsLine(needs: NeedsYou): string {
  return NEEDS_KINDS.flatMap((kind) => {
    const rows: readonly (NeedsYouTicketRow | NeedsYouAskRow)[] = needs.rows[kind]
    return rows.map((row) => `${kind} ${row.number ?? '-'} by ${row.agent_name ?? '-'}`)
  }).join(', ')
}

/** Each run as its time (read off the text, not the clock) and its name. */
const runsLine = (schedule: ActivitySchedule): string =>
  schedule.scheduled.map((item) => `${item.next_run_at?.slice(11, 16)} ${item.name}`).join(', ')

/** The Command Center's day as a theme's panels read it: the day's numbers (and a month's), what needs you, the week's runs. */
function DayPanels() {
  const day = useActivityStats('1d').data
  const month = useActivityStats('30d').data
  const needs = useNeedsYou().data
  const schedule = useActivitySchedule('7d').data
  return (
    <ul>
      <li data-testid="day">{day === null ? LOADING : dayLine(day)}</li>
      <li data-testid="month">{month === null ? LOADING : dayLine(month)}</li>
      <li data-testid="needs">{needs === null ? LOADING : countsLine(needs)}</li>
      <li data-testid="needs-rows">{needs === null ? LOADING : rowsLine(needs)}</li>
      <li data-testid="runs">{schedule === null ? LOADING : runsLine(schedule)}</li>
    </ul>
  )
}

/** The Deliverables list's filters with nothing filtered out, as an Inventory's All tab asks. */
const EVERY_DELIVERABLE = Object.freeze({ ...DELIVERABLE_FEED_FILTERS, source_type_exclude: null })

/** A theme's own Missions and Deliverables pages, each as a line: the Missions by state and goal, the list's count. */
function WorkPanels() {
  const missions = useMissions().data
  const list = useDeliverables(EVERY_DELIVERABLE)
  const rows = list.data?.pages.flatMap((page) => page.deliverables) ?? null
  return (
    <ul>
      <li data-testid="missions">{missions === null ? LOADING : missions.missions.map((mission) => `${mission.state} ${mission.goal}`).join(', ')}</li>
      <li data-testid="deliverables">{rows === null ? LOADING : `${rows.length} Deliverables: ${rows.map((row) => row.title).join(', ')}`}</li>
    </ul>
  )
}

const line = (id: string): string => screen.getByTestId(id).textContent ?? ''

beforeEach(() => {
  host.reset()
})

describe("the harness page's sample data", () => {
  it('is not there in a test until it is given: every read is loading', () => {
    render(<><Panels /><DayPanels /></>)
    const lines = ['agents', 'stats', 'mission', 'day', 'month', 'needs', 'needs-rows', 'runs'].map(line)
    expect(lines).toEqual(Array.from(lines, () => LOADING))
  })

  it('answers the roster, its counts and one running Mission with its steps', () => {
    giveSampleData()
    render(<Panels />)
    expect(line('agents').split(', ')).toEqual(expect.arrayContaining(['Scout', 'Quill']))
    expect(line('stats')).toBe('2 of 4 active')
    expect(line('mission')).toBe('mission running: Compare three laptops and write a shortlist, step 2 of 3')
    expect(host.pageAsks().map((ask) => ask.hook)).toEqual(['useAgents', 'useAgentStats', 'useActivityFeed'])
  })

  it("answers the day's numbers in any window, what needs you across its five kinds, and the runs coming up", () => {
    giveSampleData()
    render(<DayPanels />)
    expect(line('day')).toBe('2 working now, 5 completed today, 6 need you, 3 in queue (1d)')
    expect(line('month')).toBe(line('day'))
    expect(line('needs')).toBe('6 need you: 2 review, 1 question, 1 approval, 1 stuck, 1 failed')
    expect(line('needs-rows').split(', ')).toEqual([
      'review #0101 by Scout', 'review #0098 by Quill', 'question #0102 by Scout', 'approval - by Quill',
      'stuck #0095 by Ledger', 'failed #0097 by Patch',
    ])
    expect(line('runs').split(', ')).toEqual([
      '11:00 Post the bake sale reminder', '13:30 Check the laptop prices', '16:00 Send the laptop shortlist',
      '18:00 Share the newsletter teaser',
    ])
    expect(host.pageAsks()).toEqual([
      { hook: 'useActivityStats', args: ['1d'] }, { hook: 'useActivityStats', args: ['30d'] },
      { hook: 'useNeedsYou', args: [] }, { hook: 'useActivitySchedule', args: ['7d'] },
    ])
  })

  it("answers the workspace's Missions in every state a Missions page groups, and the Deliverables list", async () => {
    host.setWorkspace({ name: 'Harness workspace', socialsAvailable: false })
    giveSampleData()
    render(<WorkPanels />)
    expect(line('missions').split(', ')).toEqual([
      'running Compare three laptops and write a shortlist', 'awaiting_approval Plan the chemistry revision week',
      'awaiting_human Draft the bake sale poster', 'running Book the library study rooms',
      'completed Build the climate debate slides', 'completed Write the shelf sorter script',
      'failed Check student discounts on the shortlist',
    ])
    expect(SAMPLE_PAGE_DATA.missions.missions[0].id).toBe('harness-mission-1')
    expect(await screen.findByText(/^6 Deliverables: Laptop shortlist/)).toBeInTheDocument()
  })

  it("times every run a few hours after the fixtures' made-up morning, so the shots read the same each run", () => {
    const morning = Date.parse(SAMPLE_PAGE_DATA.agentStats.timestamp)
    const hoursAhead = SAMPLE_PAGE_DATA.activitySchedule.scheduled.map((item) => (Date.parse(item.next_run_at ?? '') - morning) / HOUR_MS)
    expect(hoursAhead.every((hours) => hours > 0 && hours < SAME_DAY_HOURS)).toBe(true)
    expect(SAMPLE_PAGE_DATA.needsYou.total).toBe(SAMPLE_PAGE_DATA.activityStats.needs_attention)
  })

  it('is given by the harness page before it draws the mock host', () => {
    const main = readFileSync(MAIN, 'utf8')
    const drawHost = main.slice(main.indexOf('function drawHost('))
    expect(drawHost.indexOf('giveSampleData()')).toBeGreaterThan(0)
    expect(drawHost.indexOf('giveSampleData()')).toBeLessThan(drawHost.indexOf('root.render('))
  })
})

describe("the harness page's sample proactive data (SDK 1.3.0)", () => {
  const proactive = () => ({ brief: useBrief(), readiness: useReadiness(), suggestions: useSuggestions(), calibration: useCalibration() })

  it("answers the day's brief, what Auto depends on and the open suggestions, and offers no calibration, as core's server", () => {
    giveSampleData()
    const { result } = renderHook(proactive)
    expect(result.current.brief.data?.greeting).toBe('Morning.')
    expect(result.current.readiness.data?.items.map((item) => item.state)).toEqual(['ready', 'ready', 'not_checked', 'needs_setup'])
    expect(result.current.suggestions.data?.map((row) => row.proposed_action.kind)).toEqual(['board_task', 'chat'])
    expect(result.current.calibration).toMatchObject({ data: null, available: false })
  })

  it('makes the brief from the same rows: what needs you, the suggestions, the runs today, and what the brief needs that is not ready', () => {
    const { brief, needsYou, suggestions, activitySchedule, readiness } = SAMPLE_PAGE_DATA
    expect(brief.counts.needs_you).toBe(needsYou.total)
    expect(brief.sections.needs_you).toHaveLength(needsYou.total)
    expect(brief.sections.suggestions.map((row) => row.id)).toEqual(suggestions.map((row) => row.id))
    expect(brief.sections.today.map((row) => row.title)).toEqual(activitySchedule.scheduled.map((item) => item.name))
    const unready = readiness.items.filter((item) => item.state !== 'ready' && item.needed_by.includes('brief'))
    expect(brief.sections.unchecked.map((row) => row.title)).toEqual(unready.map((item) => item.label))
    expect(brief.date).toBe(SAMPLE_PAGE_DATA.agentStats.timestamp.slice(0, 10))
  })

  it('has no brief today when the brief is off: no data, not loading and no error, the normal state of such a day', () => {
    giveSampleData()
    const { result } = renderHook(() => useBrief())
    act(() => showBrief(false))
    expect([result.current.data, result.current.isLoading, result.current.error]).toEqual([null, false, null])
    act(() => showBrief(true))
    expect(result.current.data?.state_hash).toBe(SAMPLE_PAGE_DATA.brief.state_hash)
  })

  it("gives every Mission where it stands, what happens next and what Try again does (SDK 1.3.0's Mission rows)", () => {
    const rows = SAMPLE_PAGE_DATA.missions.missions
    expect(rows.map((mission) => mission.display_state)).toEqual(['working', 'needs_you', 'needs_you', 'working', 'done', 'done', 'failed'])
    expect(rows.filter((mission) => mission.retry).map((mission) => [mission.state, mission.retry])).toEqual([['failed', 'rerun_mission']])
  })
})
