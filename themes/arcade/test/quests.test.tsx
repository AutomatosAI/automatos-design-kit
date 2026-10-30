// Arcade's Quests (/x/quests) on the harness's page fakes: the host's Missions as markers on the map, each named by
// its goal and state; the first that needs you opens first, in a quest window with its tasks as steps (from
// useMission), its progress and the host's own Mission page; a marker opens its own quest; no Missions is the quiet
// map. The Missions are made up.
import { type Mission, type MissionDetail, type MissionList, type MissionTask } from '@automatos/theme-sdk'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it } from 'vitest'
import { host } from '@automatos/theme-harness/host'

import { OPEN_MISSION, QUEST_LABEL, STEPS_LABEL } from '../src/quests/quest-window.tsx'
import { MAP_LABEL, QUIET_TITLE, QuestsPage } from '../src/quests/quests-page.tsx'

const STAMP = '2026-10-14T09:00:00+00:00'
const QUESTS_CSS = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/quests/quests.module.css'), 'utf8')

/** One rule's body from the stylesheet. */
function rule(selector: string): string {
  const start = QUESTS_CSS.indexOf(`${selector} {`)
  return start < 0 ? '' : QUESTS_CSS.slice(start, QUESTS_CSS.indexOf('}', start))
}

function mission(id: string, goal: string, state: Mission['state']): Mission {
  return {
    id, workspace_id: 'ws-harness', goal, state, state_type: 'active', plan: null, config: null, check_each_step: false,
    output_summary: null, token_budget_estimate: null, tokens_used: 0, max_retries: 1, max_concurrent: 1, complexity_tier: null,
    parallel_groups: [], has_synthesis_tasks: false, created_by: 'local', started_at: STAMP, completed_at: null, created_at: STAMP,
    updated_at: STAMP,
  }
}

function task(id: string, title: string, sequence: number, state: MissionTask['state']): MissionTask {
  return {
    id, title, description: null, task_type: null, sequence_number: sequence, agent_role: null, state, state_type: 'active',
    assigned_agent_id: null, attempt_number: 1, tokens_used: 0, estimated_tokens: 0, complexity: null, parallel_group: null,
    failure_reason_code: null, failure_detail: null, output_excerpt: null, output: null, started_at: null, completed_at: null,
    created_at: STAMP,
  }
}

const MISSIONS: readonly Mission[] = [
  mission('m-1', 'Revision plan for chemistry', 'running'),
  mission('m-2', 'Laptop shortlist for chemistry', 'awaiting_approval'),
  mission('m-3', 'Lisbon trip budget', 'completed'),
]
const LIST: MissionList = { missions: MISSIONS, total: 3, limit: 50, offset: 0 }
const DETAIL: MissionDetail = {
  ...MISSIONS[1],
  tasks: [task('t2', 'Check battery tests', 2, 'completed'), task('t1', 'Compare prices', 1, 'completed'), task('t3', 'Check student discounts', 3, 'pending')],
  recent_events: [],
}

beforeEach(() => {
  host.reset()
  host.setReducedMotion(true)
  host.setPathname('/x/quests')
})

describe('the quest map', () => {
  it('puts each Mission on the map, named by its goal and state', () => {
    render(<QuestsPage />)
    act(() => host.setPageQuery('useMissions', { data: LIST }))
    const map = screen.getByRole('region', { name: MAP_LABEL })
    expect(map).toHaveTextContent('3 quests')
    expect(within(map).getAllByRole('button').map((marker) => marker.getAttribute('aria-label'))).toEqual([
      'Revision plan for chemistry, active', 'Laptop shortlist for chemistry, needs you', 'Lisbon trip budget, done',
    ])
  })

  it('places each marker on its tile, held inside the map so an edge tile never hangs outside it', () => {
    render(<QuestsPage />)
    act(() => host.setPageQuery('useMissions', { data: LIST }))
    const markers = within(screen.getByRole('region', { name: MAP_LABEL })).getAllByRole('button')
    markers.forEach((marker) => {
      for (const axis of ['--marker-x', '--marker-y']) {
        const value = Number.parseFloat(marker.style.getPropertyValue(axis))
        expect(value).toBeGreaterThan(0)
        expect(value).toBeLessThan(100)
      }
    })
    expect(rule('.marker')).toContain('left: clamp(var(--marker-half), var(--marker-x), calc(100% - var(--marker-half)))')
    expect(rule('.marker')).toContain('top: clamp(var(--marker-half), var(--marker-y), calc(100% - var(--marker-half)))')
  })

  it('cuts a long goal to four lines in the quest window, the whole goal kept in its text and on hover', () => {
    const goal = `Plan ${'the chemistry revision week by week, '.repeat(8)}then book the library rooms`
    render(<QuestsPage />)
    act(() => host.setPageQuery('useMissions', { data: { ...LIST, missions: [mission('m-9', goal, 'running')], total: 1 } }))
    const title = within(screen.getByRole('region', { name: QUEST_LABEL })).getByRole('heading', { level: 2 })
    expect(title).toHaveTextContent(goal)
    expect(title).toHaveAttribute('title', goal)
    expect(rule('.questTitle')).toContain('-webkit-line-clamp: 4')
    expect(rule('.questTitle')).toContain('overflow: hidden')
  })

  it('opens the first quest that needs you, with its steps in order, its progress and its Mission page', () => {
    render(<QuestsPage />)
    act(() => {
      host.setPageQuery('useMissions', { data: LIST })
      host.setPageQuery('useMission', { data: DETAIL })
    })
    const quest = screen.getByRole('region', { name: QUEST_LABEL })
    expect(quest).toHaveTextContent('NEEDS YOU · Storm Peaks')
    const steps = within(quest).getByRole('list', { name: STEPS_LABEL })
    expect(within(steps).getAllByRole('listitem').map((step) => step.textContent)).toEqual([
      '✓Compare pricesDONE', '✓Check battery testsDONE', '·Check student discountsNEXT',
    ])
    expect(quest).toHaveTextContent('2 / 3 steps')
    expect(within(quest).getByRole('link', { name: OPEN_MISSION })).toHaveAttribute('href', '/missions/m-2')
  })

  it("opens a marker's own quest", () => {
    render(<QuestsPage />)
    act(() => host.setPageQuery('useMissions', { data: LIST }))
    const marker = screen.getByRole('button', { name: 'Lisbon trip budget, done' })
    fireEvent.click(marker)
    expect(marker).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('region', { name: QUEST_LABEL })).toHaveTextContent('Lisbon trip budget')
  })

  it('says the map is quiet with no Missions', () => {
    render(<QuestsPage />)
    act(() => host.setPageQuery('useMissions', { data: { missions: [], total: 0, limit: 50, offset: 0 } }))
    expect(screen.getByText(QUIET_TITLE)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: QUEST_LABEL })).toBeNull()
  })
})
