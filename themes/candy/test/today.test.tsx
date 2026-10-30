// Candy's Today (/x/today) on the harness's page fakes, and the pure helpers behind it: the day and the greeting,
// the line from the Needs-you total, the four numbers from the day's stats ("—" while they load), the orb's
// completed-today figure, the Needs-you rows newest first, each opening the thing itself, the schedule in the
// product's words, the empty and failed windows, the host's search, and the board's event stream held open while the
// page is on screen. Every row is made up; the clock is fixed at Friday 30 October 2026, 14:00 local time.
import type { ActivitySchedule, ActivityStats, AgentStatistics, NeedsYou, ScheduleItem } from '@automatos/theme-sdk'
import { host } from '@automatos/theme-harness/host'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { comingRows, kindWord, OTHER_KIND } from '../src/today/schedule-rows.ts'
import { APPROVALS_HREF, needRows, NEEDS_YOU_HREF } from '../src/today/needs-rows.ts'
import { figureOf, greetingFor, longDate, ON_IT, waitingLine } from '../src/today/today-words.ts'
import { COMING_EMPTY, COMING_TITLE } from '../src/today/coming-up.tsx'
import { NEEDS_EMPTY, NEEDS_FAILED, NEEDS_TITLE } from '../src/today/needs-window.tsx'
import { STATS_LABEL } from '../src/today/stat-cards.tsx'
import { SEARCH_AUTOMATOS, TODAY_TITLE, TodayPage } from '../src/today/today-page.tsx'

const NOW = new Date(2026, 9, 30, 14, 0).getTime()
const minutesAgo = (minutes: number): string => new Date(NOW - minutes * 60_000).toISOString()
const at = (day: number, hour: number, minute = 0): string => new Date(2026, 9, day, hour, minute).toISOString()

const STATS: ActivityStats = {
  working_now: 4, channels_live: 1, completed_today: 14, needs_attention: 3, agents_active: 6, tasks_in_queue: 9, period: '1d',
}
const AGENT_STATS: AgentStatistics = {
  total_agents: 8, active_agents: 6, inactive_agents: 2, agents_by_type: {}, timestamp: at(30, 13),
}

const NEEDS: NeedsYou = {
  total: 4,
  counts: { review: 1, question: 1, approval: 1, stuck: 0, failed: 1 },
  rows: {
    review: [{ ticket_id: 41, number: '#0041', title: 'Approve the October newsletter send', agent_name: 'Iris', mission_id: null, opens: 'ticket', at: minutesAgo(12) }],
    question: [{ source: 'grant', id: '77', title: 'Pick a headline for the launch post', ticket_id: 42, agent_name: 'Atlas', at: minutesAgo(40) }],
    approval: [{ source: 'mission', id: 'm-9', title: null, ticket_id: null, agent_name: 'Juno', at: minutesAgo(60) }],
    stuck: [],
    failed: [{ ticket_id: 43, title: 'Run the link check', agent_name: null, mission_id: 'm-3', opens: 'mission', at: minutesAgo(300) }],
  },
}

function item(id: string, name: string, type: ScheduleItem['type'], next: string | null): ScheduleItem {
  return { id, name, type, next_run_at: next, frequency: 'Daily', agent_name: null, agent_id: null }
}

const SCHEDULE: ActivitySchedule = {
  scheduled: [
    item('3', 'Morning brief', 'mission', at(31, 8)),
    item('1', 'Weekly sales digest', 'recipe', at(30, 16)),
    item('2', 'Inbox tidy-up', 'routine', at(30, 18, 30)),
    item('4', 'Launch post', 'social', at(31, 9)),
  ],
}

const EMPTY_NEEDS: NeedsYou = {
  total: 0, counts: { review: 0, question: 0, approval: 0, stuck: 0, failed: 0 }, rows: { review: [], question: [], approval: [], stuck: [], failed: [] },
}

function answerAll(): void {
  act(() => {
    host.setPageQuery('useActivityStats', { data: STATS })
    host.setPageQuery('useAgentStats', { data: AGENT_STATS })
    host.setPageQuery('useNeedsYou', { data: NEEDS })
    host.setPageQuery('useActivitySchedule', { data: SCHEDULE })
  })
}

const region = (name: string): HTMLElement => screen.getByRole('region', { name })

beforeEach(() => {
  host.reset()
  host.setReducedMotion(true)
  host.setPathname('/x/today')
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("today's words", () => {
  it('greets for the time of day and says the day in full', () => {
    expect([greetingFor(9), greetingFor(12), greetingFor(17), greetingFor(18)]).toEqual([
      'Good morning', 'Good afternoon', 'Good afternoon', 'Good evening',
    ])
    expect(longDate(NOW)).toBe('Friday 30 October')
  })

  it('says what is waiting in words, and only the first sentence until the total is known', () => {
    expect(waitingLine(null)).toBe(ON_IT)
    expect(waitingLine(0)).toBe('Your agents are on it. Nothing is waiting for you.')
    expect(waitingLine(1)).toBe('Your agents are on it. One thing is waiting for you.')
    expect(waitingLine(3)).toBe('Your agents are on it. Three things are waiting for you.')
    expect(waitingLine(12)).toBe('Your agents are on it. 12 things are waiting for you.')
  })

  it('shows a dash for a count still unknown', () => {
    expect([figureOf(null), figureOf(undefined), figureOf(0), figureOf(14)]).toEqual(['—', '—', '0', '14'])
  })
})

describe('the Needs-you rows', () => {
  it('lists every kind in one list, newest first, each opening the thing itself', () => {
    expect(needRows(NEEDS).map((row) => [row.title, row.agent, row.href])).toEqual([
      ['Approve the October newsletter send', 'Iris', '/command-center?tab=board&task_id=41'],
      ['Pick a headline for the launch post', 'Atlas', '/command-center?tab=board&task_id=42&question=77'],
      ['A Mission plan', 'Juno', '/missions/m-9'],
      ['Run the link check', null, '/missions/m-3'],
    ])
  })

  it('opens a question with no ticket on the questions tab, and an approval with none on the approvals tab', () => {
    const rows = needRows({
      ...EMPTY_NEEDS,
      rows: {
        ...EMPTY_NEEDS.rows,
        question: [{ source: 'grant', id: '5', title: 'Which budget?', ticket_id: null, agent_name: 'Atlas', at: null }],
        approval: [{ source: 'grant', id: '6', title: 'Send the e-mail', ticket_id: null, agent_name: 'Iris', at: minutesAgo(1) }],
      },
    })
    expect(rows.map((row) => [row.title, row.href])).toEqual([
      ['Send the e-mail', APPROVALS_HREF],
      ['Which budget?', '/command-center?tab=questions'],
    ])
  })
})

describe('the schedule', () => {
  it('names each kind in the product words', () => {
    expect(['recipe', 'routine', 'mission', 'task', 'task_due', 'social', 'cron'].map(kindWord)).toEqual([
      'Playbook', 'Routine', 'Mission', 'Task', 'Task due', 'Post', OTHER_KIND,
    ])
  })

  it('lists the soonest first, with when each runs next', () => {
    expect(comingRows(SCHEDULE, NOW, 3).map((row) => [row.name, row.kind, row.when, row.set])).toEqual([
      ['Weekly sales digest', 'Playbook', '16:00', 1],
      ['Inbox tidy-up', 'Routine', '18:30', 2],
      ['Morning brief', 'Mission', 'Tomorrow', 3],
    ])
  })

  it('says how often an item runs when the schedule gives no next time', () => {
    const [row] = comingRows({ scheduled: [item('9', 'Check the shop', 'routine', null)] }, NOW, 3)
    expect(row.when).toBe('Daily')
  })
})

describe('the Today page', () => {
  it('names the page, greets, and says what is waiting', () => {
    render(<TodayPage />)
    answerAll()
    expect(screen.getByRole('heading', { level: 1, name: TODAY_TITLE })).toHaveAttribute('data-theme-heading')
    expect(screen.getByText('Friday 30 October')).toBeInTheDocument()
    expect(screen.getByText('Good afternoon')).toBeInTheDocument()
    expect(screen.getByText('Your agents are on it. Four things are waiting for you.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Chat with Auto' })).toHaveAttribute('href', '/chat')
    expect(screen.getByRole('link', { name: 'See what needs you' })).toHaveAttribute('href', NEEDS_YOU_HREF)
  })

  it("shows the day's numbers from the stats, with the roster's total beside agents active", () => {
    render(<TodayPage />)
    answerAll()
    const cards = within(screen.getByRole('list', { name: STATS_LABEL })).getAllByRole('listitem')
    expect(cards.map((card) => card.textContent)).toEqual([
      'Working now4agents busy', 'Needs you3waiting', 'In queue9tasks lined up', 'Agents active6of 8',
    ])
    expect(screen.getByText('14')).toBeInTheDocument()
    expect(screen.getByText('completed today')).toBeInTheDocument()
  })

  it('shows a dash for every number while the stats load, and holds the board stream open', () => {
    render(<TodayPage />)
    const cards = within(screen.getByRole('list', { name: STATS_LABEL })).getAllByRole('listitem')
    expect(cards.map((card) => within(card).getByText('—'))).toHaveLength(4)
    expect(screen.getByText(ON_IT)).toBeInTheDocument()
    expect(region(NEEDS_TITLE)).toHaveAttribute('aria-busy', 'true')
    expect(host.boardStreams()).toBe(1)
  })

  it('lists the newest three that need you, each with its agent and time, opening the thing itself', () => {
    render(<TodayPage />)
    answerAll()
    const needs = region(NEEDS_TITLE)
    expect(within(needs).getByRole('link', { name: 'See all 4' })).toHaveAttribute('href', NEEDS_YOU_HREF)
    const rows = within(needs).getAllByRole('listitem')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent('Iris · 12 min ago')
    expect(rows[1]).toHaveTextContent('Atlas · 40 min ago')
    expect(within(needs).getByRole('link', { name: 'Open Approve the October newsletter send' })).toHaveAttribute(
      'href', '/command-center?tab=board&task_id=41',
    )
    expect(within(needs).getByRole('link', { name: 'Open A Mission plan' })).toHaveAttribute('href', '/missions/m-9')
  })

  it("lists what's coming up in words", () => {
    render(<TodayPage />)
    answerAll()
    const rows = within(region(COMING_TITLE)).getAllByRole('listitem')
    expect(rows.map((row) => row.textContent)).toEqual([
      'Weekly sales digestPlaybook16:00', 'Inbox tidy-upRoutine18:30', 'Morning briefMissionTomorrow',
    ])
  })

  it('says so when nothing needs the person and nothing is scheduled', () => {
    render(<TodayPage />)
    act(() => {
      host.setPageQuery('useNeedsYou', { data: EMPTY_NEEDS })
      host.setPageQuery('useActivitySchedule', { data: { scheduled: [] } })
    })
    expect(within(region(NEEDS_TITLE)).getByText(NEEDS_EMPTY)).toBeInTheDocument()
    expect(within(region(NEEDS_TITLE)).queryByRole('link')).toBeNull()
    expect(within(region(COMING_TITLE)).getByText(COMING_EMPTY)).toBeInTheDocument()
    expect(screen.getByText('Your agents are on it. Nothing is waiting for you.')).toBeInTheDocument()
  })

  it('says a failed read in words, and Try again asks again', () => {
    render(<TodayPage />)
    act(() => host.setPageQuery('useNeedsYou', { error: 'Network down' }))
    const needs = region(NEEDS_TITLE)
    expect(within(needs).getByText(NEEDS_FAILED)).toBeInTheDocument()
    fireEvent.click(within(needs).getByRole('button', { name: 'Try again' }))
    expect(host.pageRefetches()).toContain('useNeedsYou')
  })

  it("opens the host's search", () => {
    render(<TodayPage />)
    fireEvent.click(screen.getByRole('button', { name: SEARCH_AUTOMATOS }))
    expect(host.globalSearchOpens()).toBe(1)
  })

  it('reads the stats for today, and lets go of the board stream when it leaves', () => {
    const { unmount } = render(<TodayPage />)
    expect(host.pageAsks().find((ask) => ask.hook === 'useActivityStats')?.args).toEqual(['1d'])
    unmount()
    expect(host.boardStreams()).toBe(0)
  })
})
