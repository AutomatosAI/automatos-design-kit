// Candy's Your team (/x/agents) on the harness's page fakes, and the pure helpers behind it: each agent's status as a
// glyph and a word, the filter counts as the host's roster counts them, the search by name, job or team, the gradient
// an agent keeps whatever the filter, each card opening the host's agents page at that agent, Manage agents, and the
// loading, failed and empty grids. Every agent is made up.
import type { RosterAgent } from '@automatos/theme-sdk'
import { host } from '@automatos/theme-harness/host'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  AgentsPage, FILTERS_LABEL, GRID_LABEL, LOADING_TEAM, MANAGE_AGENTS, NO_AGENTS, nothingShown, SEARCH_AGENTS, TEAM_FAILED, TEAM_TITLE,
} from '../src/agents/agents-page.tsx'
import { agentHref, jobOf, matchesQuery, rosterCounts, statusOf, visibleAgents } from '../src/agents/roster.ts'

const STAMP = '2026-10-30T09:00:00+00:00'

function agent(id: number, name: string, status: string, jobTitle: string | null, team: string | null): RosterAgent {
  return {
    id, name, status, job_title: jobTitle, team, description: `${name} helps the team.`, agent_type: 'custom', premium_icon: null,
    created_at: STAMP, updated_at: STAMP,
  }
}

const ROSTER: readonly RosterAgent[] = [
  agent(1, 'Iris', 'active', 'Social media lead', 'Marketing'),
  agent(2, 'Atlas', 'active', 'Research analyst', 'Insights'),
  agent(3, 'Juno', 'active', 'Operations assistant', 'Ops'),
  agent(4, 'Nova', 'inactive', 'Visual designer', 'Marketing'),
  agent(5, 'Sage', 'error', null, null),
]

const grid = (): HTMLElement => screen.getByRole('region', { name: GRID_LABEL })
const cardNames = (): string[] => within(grid()).queryAllByRole('heading', { level: 2 }).map((heading) => heading.textContent ?? '')

function showRoster(roster: readonly RosterAgent[] = ROSTER): void {
  act(() => host.setPageQuery('useAgents', { data: roster }))
}

beforeEach(() => {
  host.reset()
  host.setReducedMotion(true)
  host.setPathname('/x/agents')
})

describe('the roster as data', () => {
  it('says each status as a glyph and a word, never colour alone', () => {
    expect(['active', 'inactive', 'error', 'paused_for_review', ''].map((status) => {
      const { glyph, word, active } = statusOf(status)
      return `${glyph} ${word} ${active}`
    })).toEqual(['● Active true', '○ Inactive false', '✕ Error false', '○ Paused for review false', '○ Inactive false'])
  })

  it('counts active as the host does, and everything else as inactive', () => {
    expect(rosterCounts(ROSTER)).toEqual({ all: 5, active: 3, inactive: 2 })
  })

  it('finds an agent by name, job or team, in any case', () => {
    expect(['iris', 'ANALYST', 'marketing', 'helps', 'nobody'].map((query) => ROSTER.filter((each) => matchesQuery(each, query)).length)).toEqual([
      1, 1, 2, 1, 0,
    ])
  })

  it("keeps each agent's gradient, its place in the roster, whatever the filter", () => {
    expect(visibleAgents(ROSTER, 'inactive', '').map(({ agent: shown, set }) => [shown.name, set])).toEqual([['Nova', 1], ['Sage', 2]])
  })

  it("puts the job under the name, else the description, and opens the agent on the host's page", () => {
    expect([jobOf(ROSTER[0]), jobOf(ROSTER[4])]).toEqual(['Social media lead', 'Sage helps the team.'])
    expect(agentHref(42)).toBe('/agents?agent=42')
  })

  it('says why the grid is empty', () => {
    expect([nothingShown('all', ' zed '), nothingShown('active', ''), nothingShown('inactive', '')]).toEqual([
      'No agents match “zed”.', 'No active agents.', 'No inactive agents.',
    ])
  })
})

describe('the Your team page', () => {
  it('shows a card for each agent with its job, status and team, opening the agent', () => {
    render(<AgentsPage />)
    showRoster()
    expect(screen.getByRole('heading', { level: 1, name: TEAM_TITLE })).toHaveAttribute('data-theme-heading')
    expect(cardNames()).toEqual(['Iris', 'Atlas', 'Juno', 'Nova', 'Sage'])
    const [iris] = within(grid()).getAllByRole('listitem')
    expect(iris).toHaveTextContent('Social media lead')
    expect(iris).toHaveTextContent('● Active')
    expect(iris).toHaveTextContent('Team: Marketing')
    expect(within(iris).getByRole('link', { name: 'Iris' })).toHaveAttribute('href', '/agents?agent=1')
    const nova = within(grid()).getAllByRole('listitem')[3]
    expect(nova).toHaveTextContent('○ Inactive')
  })

  it('filters by status with the counts on the pills', () => {
    render(<AgentsPage />)
    showRoster()
    const pills = within(screen.getByRole('group', { name: FILTERS_LABEL }))
    expect(pills.getAllByRole('button').map((pill) => pill.textContent)).toEqual(['All 5', '●Active 3', '○Inactive 2'])
    expect(pills.getByRole('button', { name: 'All 5' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(pills.getByRole('button', { name: 'Inactive 2' }))
    expect(pills.getByRole('button', { name: 'Inactive 2' })).toHaveAttribute('aria-pressed', 'true')
    expect(pills.getByRole('button', { name: 'All 5' })).toHaveAttribute('aria-pressed', 'false')
    expect(cardNames()).toEqual(['Nova', 'Sage'])
    fireEvent.click(pills.getByRole('button', { name: 'Active 3' }))
    expect(cardNames()).toEqual(['Iris', 'Atlas', 'Juno'])
  })

  it('narrows the cards as you type, and says when none match', () => {
    render(<AgentsPage />)
    showRoster()
    const search = screen.getByRole('searchbox', { name: SEARCH_AGENTS })
    fireEvent.change(search, { target: { value: 'market' } })
    expect(cardNames()).toEqual(['Iris', 'Nova'])
    expect(screen.getByText('2 of 5 agents shown')).toBeInTheDocument()
    fireEvent.change(search, { target: { value: 'zed' } })
    expect(cardNames()).toEqual([])
    expect(within(grid()).getByText('No agents match “zed”.')).toBeInTheDocument()
  })

  it("links to the host's own agents page", () => {
    render(<AgentsPage />)
    expect(screen.getByRole('link', { name: MANAGE_AGENTS })).toHaveAttribute('href', '/agents')
  })

  it('is busy with no made-up cards while the roster loads', () => {
    render(<AgentsPage />)
    expect(grid()).toHaveAttribute('aria-busy', 'true')
    expect(within(grid()).getByText(LOADING_TEAM)).toBeInTheDocument()
    expect(within(grid()).queryAllByRole('listitem')).toHaveLength(0)
    expect(within(screen.getByRole('group', { name: FILTERS_LABEL })).getByRole('button', { name: 'All' })).toBeInTheDocument()
  })

  it('says so when there are no agents yet', () => {
    render(<AgentsPage />)
    showRoster([])
    expect(within(grid()).getByText(NO_AGENTS)).toBeInTheDocument()
    expect(grid()).not.toHaveAttribute('aria-busy')
  })

  it('says a failed read in words, and Try again asks again', () => {
    render(<AgentsPage />)
    act(() => host.setPageQuery('useAgents', { error: 'Network down' }))
    expect(within(grid()).getByText(TEAM_FAILED)).toBeInTheDocument()
    fireEvent.click(within(grid()).getByRole('button', { name: 'Try again' }))
    expect(host.pageRefetches()).toContain('useAgents')
  })
})
