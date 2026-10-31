// The core screen's side panels on the harness's page and Deliverables fakes: AGENTS lists the roster, active ones
// first, each status a glyph and a word, with how many are active; MISSION shows this conversation's Mission first,
// else the Mission running now (asking the activity feed for exactly that), linked to its page, with its steps; DELIVERABLES lists the newest three, each
// linked to its page, and says so when the list fails, a 200 with success: false included; TODAY shows the day's four
// numbers; NEEDS YOU the Needs-you number and its first rows, each linked where it is answered; NEXT UP the week's
// next runs, soonest first. Each says when it is still loading. The rows are made up. Roles, names and text only.
import {
  type ActivityFeed, type ActivitySchedule, type ActivityStats, BOARD_HREF, type Deliverable, missionHref, type MissionDetail,
  type MissionTask, type NeedsYou, type RosterAgent, ticketHref,
} from '@automatos/theme-sdk'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { host } from '@automatos/theme-harness/host'
import { AGENTS_LOADING, AGENTS_TITLE, AgentsPanel } from '../../src/chat/panels/agents-panel.tsx'
import {
  ALL_DELIVERABLES, DELIVERABLES_FAILED, DELIVERABLES_TITLE, DeliverablesPanel, NO_DELIVERABLES,
} from '../../src/chat/panels/deliverables-panel.tsx'
import {
  MISSION_TITLE, MissionPanel, NO_MISSION, RUNNING_MISSION, THIS_MISSION_LOADING,
} from '../../src/chat/panels/mission-panel.tsx'
import {
  moreLine, NEEDS_YOU_FAILED, NEEDS_YOU_TITLE, NeedsYouPanel, NOTHING_NEEDS_YOU,
} from '../../src/chat/panels/needs-you-panel.tsx'
import { NEXT_UP_TITLE, NextUpPanel, NOTHING_NEXT } from '../../src/chat/panels/next-up-panel.tsx'
import { TODAY_FAILED, TODAY_LOADING, TODAY_STATS, TODAY_TITLE, TodayPanel } from '../../src/chat/panels/today-panel.tsx'

const STAMP = '2026-10-14T09:00:00+00:00'

function agent(fields: Partial<RosterAgent> & Pick<RosterAgent, 'id' | 'name' | 'status'>): RosterAgent {
  return { description: null, agent_type: 'custom', premium_icon: null, created_at: STAMP, updated_at: STAMP, ...fields }
}

function deliverable(id: string, title: string): Deliverable {
  return {
    id, workspace_id: 'ws-harness', source_type: 'chat', source_id: null, agent_id: null, agent_name: null, artifact_type: 'report',
    title, summary: null, storage_type: 'workspace', file_path: `outputs/${id}.md`, file_name: null, file_type: null, file_size_bytes: null,
    preview_url: null, preview_type: null, extra: {}, status: 'active', created_at: STAMP, updated_at: STAMP,
  }
}

const panel = (title: string): HTMLElement => screen.getByRole('region', { name: title })

beforeEach(() => {
  host.reset()
})

describe('AGENTS', () => {
  it('says it is loading until the roster answers', () => {
    render(<AgentsPanel />)
    expect(panel(AGENTS_TITLE)).toHaveTextContent(AGENTS_LOADING)
  })

  it('lists the roster, active agents first, each status a glyph and a word, and how many are active', () => {
    render(<AgentsPanel />)
    act(() => host.setPageQuery('useAgents', { data: [
      agent({ id: 1, name: 'Scribe', status: 'inactive', job_title: 'Writes the reports' }),
      agent({ id: 2, name: 'Scout', status: 'active', job_title: 'Searches the web' }),
      agent({ id: 3, name: 'Analyst', status: 'active', unavailable: 'No AI credit' }),
    ] }))
    const rows = within(panel(AGENTS_TITLE)).getAllByRole('listitem')
    expect(rows.map((row) => row.textContent)).toEqual([
      'Scout● ActiveSearches the web',
      'Scribe— InactiveWrites the reports',
      'Analyst○ UnavailableNo AI credit',
    ])
    expect(panel(AGENTS_TITLE)).toHaveTextContent('1 / 3')
  })
})

function task(id: string, title: string, sequence: number, state: MissionTask['state']): MissionTask {
  return {
    id, title, description: null, task_type: null, sequence_number: sequence, agent_role: null, state, state_type: 'active',
    assigned_agent_id: null, attempt_number: 1, tokens_used: 0, estimated_tokens: 0, complexity: null, parallel_group: null,
    failure_reason_code: null, failure_detail: null, output_excerpt: null, output: null, started_at: null, completed_at: null,
    created_at: STAMP,
  }
}

/** A Mission the conversation planned, its tasks out of order on purpose. */
const planned: MissionDetail = {
  id: 'm-9', workspace_id: 'ws-harness', goal: 'Compare three laptops', state: 'running', state_type: 'active', plan: null,
  config: null, check_each_step: false, output_summary: null, token_budget_estimate: null, tokens_used: 0, max_retries: 1,
  max_concurrent: 1, complexity_tier: null, parallel_groups: [], has_synthesis_tasks: false, created_by: 'owner',
  started_at: STAMP, completed_at: null, created_at: STAMP, updated_at: STAMP, recent_events: [],
  tasks: [
    task('t2', 'Read the reviews', 2, 'running'),
    task('t1', 'Search the shops', 1, 'verified'),
    task('t4', 'Write the shortlist', 4, 'pending'),
    task('t3', 'Ask a friend', 3, 'skipped'),
  ],
}

describe('MISSION', () => {
  const running: ActivityFeed = {
    items: [{
      id: 'run-1', type: 'mission', name: 'Laptop shortlist', status: 'running', started_at: STAMP, completed_at: null,
      duration_seconds: null, agent: null, agents: [], summary: '', source_id: 'm-7', source_url: null, trigger: null, error_message: null,
      step_progress: { current: 2, total: 3, steps: [
        { name: 'Search the web', status: 'completed' },
        { name: 'Read four pages', status: 'running' },
        { name: 'Write the report', status: 'pending' },
      ] },
    }],
    total: 1, limit: 1, offset: 0,
  }

  it('asks the activity feed for the one Mission running, and shows it linked, with its steps', () => {
    render(<MissionPanel />)
    expect(host.pageAsks()).toContainEqual({ hook: 'useActivityFeed', args: [RUNNING_MISSION] })
    act(() => host.setPageQuery('useActivityFeed', { data: running }))
    const shown = panel(MISSION_TITLE)
    expect(within(shown).getByRole('link', { name: 'Laptop shortlist' })).toHaveAttribute('href', '/missions/m-7')
    expect(within(shown).getAllByRole('listitem').map((step) => step.textContent)).toEqual([
      '✓Search the web', '▸Read four pages', '○Write the report',
    ])
    expect(shown).toHaveTextContent('2 / 3')
  })

  it('says so when no Mission runs', () => {
    render(<MissionPanel />)
    act(() => host.setPageQuery('useActivityFeed', { data: { items: [], total: 0, limit: 1, offset: 0 } }))
    expect(panel(MISSION_TITLE)).toHaveTextContent(NO_MISSION)
  })

  it("shows this conversation's Mission first: its goal linked, its tasks in order, the done ones of all", () => {
    render(<MissionPanel missionId="m-9" />)
    expect(host.pageAsks()).toContainEqual({ hook: 'useMission', args: ['m-9'] })
    expect(host.pageAsks().filter((ask) => ask.hook === 'useActivityFeed')).toEqual([])
    expect(panel(MISSION_TITLE)).toHaveTextContent(THIS_MISSION_LOADING)
    act(() => host.setPageQuery('useMission', { data: planned }))
    const shown = panel(MISSION_TITLE)
    expect(within(shown).getByRole('link', { name: 'Compare three laptops' })).toHaveAttribute('href', missionHref('m-9'))
    expect(within(shown).getAllByRole('listitem').map((step) => step.textContent)).toEqual([
      '✓Search the shops', '▸Read the reviews', '–Ask a friend', '○Write the shortlist',
    ])
    expect(shown).toHaveTextContent('1 / 4')
    // HUD 1.2.0, the one-live-border rule: a Mission at work isn't waiting for you, so MISSION never glows.
    expect(shown).not.toHaveAttribute('data-live')
  })

  it("stands the newest running Mission in when this conversation's can't be read", () => {
    render(<MissionPanel missionId="m-9" />)
    act(() => host.setPageQuery('useMission', { error: 'Mission not found' }))
    act(() => host.setPageQuery('useActivityFeed', { data: running }))
    expect(within(panel(MISSION_TITLE)).getByRole('link', { name: 'Laptop shortlist' })).toHaveAttribute('href', '/missions/m-7')
  })
})

describe('DELIVERABLES', () => {
  it('lists the newest three, each linked to its page, and links the Deliverables page', async () => {
    host.setDeliverables(['d-1', 'd-2', 'd-3', 'd-4'].map((id, index) => deliverable(id, `Report ${index + 1}`)))
    render(<DeliverablesPanel />)
    const links = await waitFor(() => {
      const found = within(panel(DELIVERABLES_TITLE)).getAllByRole('link').filter((link) => link.textContent?.startsWith('Report'))
      expect(found).toHaveLength(3)
      return found
    })
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/deliverables?deliverable=d-1', '/deliverables?deliverable=d-2', '/deliverables?deliverable=d-3',
    ])
    expect(within(panel(DELIVERABLES_TITLE)).getByRole('link', { name: ALL_DELIVERABLES })).toHaveAttribute('href', '/deliverables')
  })

  it('says there are none yet', async () => {
    render(<DeliverablesPanel />)
    await waitFor(() => expect(panel(DELIVERABLES_TITLE)).toHaveTextContent(NO_DELIVERABLES))
  })

  it('says the list failed when it answers success: false', async () => {
    host.setDeliverables({ success: false, deliverables: [], total: 0, limit: 20, offset: 0, error: 'Workspace not found' })
    render(<DeliverablesPanel />)
    await waitFor(() => expect(panel(DELIVERABLES_TITLE)).toHaveTextContent(DELIVERABLES_FAILED))
  })
})

describe('TODAY', () => {
  const stats: ActivityStats = {
    working_now: 2, channels_live: 0, completed_today: 7, needs_attention: 1, agents_active: 3, tasks_in_queue: 4, period: '1d',
  }

  it("asks for the day's numbers and shows each under its label, Needs you in the accent while anything needs you", () => {
    render(<TodayPanel />)
    expect(panel(TODAY_TITLE)).toHaveTextContent(TODAY_LOADING)
    expect(host.pageAsks()).toContainEqual({ hook: 'useActivityStats', args: ['1d'] })
    act(() => host.setPageQuery('useActivityStats', { data: stats }))
    const shown = within(panel(TODAY_TITLE))
    expect(shown.getAllByRole('term').map((term) => term.textContent)).toEqual(TODAY_STATS.map((stat) => stat.label))
    expect(shown.getAllByRole('definition').map((value) => value.textContent)).toEqual(['2', '7', '1', '4'])
    expect(shown.getByText('1').parentElement).toHaveAttribute('data-tone', 'live')
    expect(shown.getByText('7').parentElement).not.toHaveAttribute('data-tone')
  })

  it('says so when the numbers fail', () => {
    render(<TodayPanel />)
    act(() => host.setPageQuery('useActivityStats', { error: 'Request failed' }))
    expect(panel(TODAY_TITLE)).toHaveTextContent(TODAY_FAILED)
  })
})

describe('NEEDS YOU', () => {
  const needs: NeedsYou = {
    total: 5,
    counts: { review: 1, question: 1, approval: 1, stuck: 1, failed: 1 },
    rows: {
      review: [{ ticket_id: 42, number: '#0042', title: 'Check the laptop report', agent_name: 'Scribe', mission_id: null, at: STAMP }],
      question: [{ source: 'grant', id: '7', title: 'Which budget?', ticket_id: 43, agent_name: 'Scout', at: STAMP }],
      approval: [{ source: 'mission', id: 'm-9', title: null, ticket_id: null, agent_name: null, at: STAMP }],
      stuck: [{ ticket_id: 44, title: 'Post the bake sale', agent_name: null, mission_id: 'm-3', opens: 'mission', at: STAMP }],
      failed: [{ ticket_id: 45, title: 'Send the newsletter', agent_name: null, mission_id: null, at: STAMP }],
    },
  }

  it('shows the number, and the first three rows linked where each is answered, each kind in words', () => {
    render(<NeedsYouPanel />)
    act(() => host.setPageQuery('useNeedsYou', { data: needs }))
    const shown = panel(NEEDS_YOU_TITLE)
    expect(shown).toHaveAttribute('data-live', 'true')
    expect(within(shown).getByText('5')).toBeInTheDocument()
    const rows = within(shown).getAllByRole('listitem')
    expect(rows.map((row) => row.textContent)).toEqual([
      '#0042 · Check the laptop report◆ ReviewScribe', 'Which budget?◆ QuestionScout', 'A Mission plan◆ Approval',
    ])
    expect(within(rows[0]).getByRole('link')).toHaveAttribute('href', ticketHref(42))
    expect(within(rows[1]).getByRole('link')).toHaveAttribute('href', ticketHref(43, '7'))
    expect(within(rows[2]).getByRole('link')).toHaveAttribute('href', missionHref('m-9'))
    expect(within(shown).getByRole('link', { name: moreLine(2) })).toHaveAttribute('href', BOARD_HREF)
  })

  it('says nothing needs you at zero, and says so when it fails', () => {
    const none: NeedsYou = { ...needs, total: 0, rows: { review: [], question: [], approval: [], stuck: [], failed: [] } }
    const { unmount } = render(<NeedsYouPanel />)
    act(() => host.setPageQuery('useNeedsYou', { data: none }))
    expect(panel(NEEDS_YOU_TITLE)).toHaveTextContent(NOTHING_NEEDS_YOU)
    expect(panel(NEEDS_YOU_TITLE)).not.toHaveAttribute('data-live')
    unmount()
    render(<NeedsYouPanel />)
    act(() => host.setPageQuery('useNeedsYou', { error: 'Request failed' }))
    expect(panel(NEEDS_YOU_TITLE)).toHaveTextContent(NEEDS_YOU_FAILED)
  })
})

describe('NEXT UP', () => {
  const inHours = (hours: number): string => new Date(Date.now() + hours * 3_600_000).toISOString()
  const run = (id: string, name: string, at: string | null, agent: string | null = null) => ({
    id, name, type: 'routine' as const, next_run_at: at, frequency: 'weekly', agent_name: agent, agent_id: null,
  })
  const schedule: ActivitySchedule = {
    scheduled: [
      run('s2', 'Weekly budget check', inHours(30), 'Analyst'),
      run('s1', 'Bake sale post', inHours(2)),
      run('s3', 'Not timed yet', null),
      run('s4', 'Revision plan', inHours(50), 'Scribe'),
      run('s5', 'Newsletter', inHours(60)),
    ],
  }

  it("asks for the week's schedule and lists the next three runs, soonest first, with how many are timed", () => {
    render(<NextUpPanel />)
    expect(host.pageAsks()).toContainEqual({ hook: 'useActivitySchedule', args: ['7d'] })
    act(() => host.setPageQuery('useActivitySchedule', { data: schedule }))
    const shown = panel(NEXT_UP_TITLE)
    const rows = within(shown).getAllByRole('listitem')
    expect(rows).toHaveLength(3)
    expect(rows.map((row) => row.querySelector('time')?.nextElementSibling?.textContent)).toEqual([
      'Bake sale post', 'Analyst · Weekly budget check', 'Scribe · Revision plan',
    ])
    expect(within(shown).getByText('4')).toBeInTheDocument()
  })

  it('says nothing is scheduled this week', () => {
    render(<NextUpPanel />)
    act(() => host.setPageQuery('useActivitySchedule', { data: { scheduled: [] } }))
    expect(panel(NEXT_UP_TITLE)).toHaveTextContent(NOTHING_NEXT)
  })
})
