// The made-up answers the harness page gives the page areas' reads (src/host/sample-data.ts), so a theme's panels show
// rows in the shots, not their loading line: HUD's AGENTS and MISSION panels, and panels on the Command Center's day
// (the reads HUD's TODAY, NEEDS YOU and NEXT UP panels make). Until they are given every read is loading, as in a
// theme's tests; once given, the roster, its counts, one running Mission, the day's numbers (in any window asked),
// what needs you across its five kinds and the runs coming up answer; and the harness page gives them before it draws
// the mock host (app/main.tsx).
import {
  type ActivitySchedule, type ActivityStats, type NeedsYou, type NeedsYouAskRow, type NeedsYouTicketRow,
  useActivityFeed, useActivitySchedule, useActivityStats, useAgents, useAgentStats, useNeedsYou,
} from '@automatos/theme-sdk'
import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it } from 'vitest'
import { host } from '../src/host.ts'
import { giveSampleData, SAMPLE_PAGE_DATA } from '../src/host/sample-data.ts'

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
