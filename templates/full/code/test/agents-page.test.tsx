// The /agents clone on the kit's harness, with nothing of Automatos running: it draws the workspace's agents through
// the SDK's pages/agents area (useAgents, useAgentStats), here the harness's fixture agents
// (packages/theme-harness/fixtures/agents), with the core page's counts, its status filter and search, and links to
// the host's own page for what only the core page has (another tab, an agent's details). It imports nothing of core.
import type { AgentStatistics, RosterAgent } from '@automatos/theme-sdk'
import { host } from '@automatos/theme-harness/host'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { AGENTS_HEADING, AgentsPage, LOAD_FAILED, RETRY, TABS_LABEL } from '../src/components/agents/agents-page.tsx'
import { LOADING, NO_MATCH, ROSTER_LABEL, SEARCH_LABEL } from '../src/components/agents/agents-roster.tsx'
import { STATS_LABEL } from '../src/components/agents/agents-stats.tsx'

const HARNESS = dirname(createRequire(import.meta.url).resolve('@automatos/theme-harness/package.json'))
const fixture = <T,>(name: string): T => JSON.parse(readFileSync(join(HARNESS, 'fixtures', 'agents', name), 'utf8')) as T
const ROSTER = fixture<RosterAgent[]>('roster.json')
const STATS = fixture<AgentStatistics>('stats.json')
const PAGE_DIR = new URL('../src/components/agents/', import.meta.url)
const CORE_IMPORT = /\bfrom\s*['"](?:@\/|next\/)|\bimport\s*\(\s*['"](?:@\/|next\/)/

function showAgents(): void {
  host.setPageQuery('useAgents', { data: ROSTER })
  host.setPageQuery('useAgentStats', { data: STATS })
}

/** The names on the roster's cards, in order. */
function cardNames(): (string | null)[] {
  return within(screen.getByRole('region', { name: ROSTER_LABEL })).queryAllByRole('heading', { level: 3 }).map((card) => card.textContent)
}

beforeEach(() => {
  host.reset()
})

describe('the /agents clone', () => {
  it("draws every agent of the roster, read through the SDK's useAgents and useAgentStats", () => {
    showAgents()
    render(<AgentsPage />)
    expect(screen.getByRole('heading', { level: 1, name: AGENTS_HEADING })).toBeInTheDocument()
    expect(cardNames()).toEqual(ROSTER.map((agent) => agent.name))
    expect(new Set(host.pageAsks().map((ask) => ask.hook))).toEqual(new Set(['useAgents', 'useAgentStats']))
  })

  it("shows the core page's counts: total, active, attention and inactive", () => {
    showAgents()
    render(<AgentsPage />)
    const cells = Array.from(screen.getByRole('region', { name: STATS_LABEL }).querySelectorAll('dl > div'), (cell) => cell.textContent)
    expect(cells).toEqual(['Total44 agents', 'Active250% online', 'Attention21 failing', 'Inactive1not running'])
  })

  it('filters the roster by status and by a search over names, roles, teams and skills', () => {
    showAgents()
    render(<AgentsPage />)
    fireEvent.click(screen.getByRole('button', { name: /^Active/ }))
    expect(cardNames()).toEqual(['Scout', 'Quill'])
    fireEvent.click(screen.getByRole('button', { name: /^All/ }))
    fireEvent.change(screen.getByLabelText(SEARCH_LABEL), { target: { value: 'invoice' } })
    expect(cardNames()).toEqual(['Ledger'])
    fireEvent.change(screen.getByLabelText(SEARCH_LABEL), { target: { value: 'no such agent' } })
    expect(screen.getByText(NO_MATCH)).toBeInTheDocument()
  })

  it("sends what only the core page has to the host's own page: the other tabs, an agent's details", () => {
    showAgents()
    render(<AgentsPage />)
    const tabs = within(screen.getByRole('navigation', { name: TABS_LABEL })).getAllByRole('link')
    expect(tabs.map((tab) => tab.getAttribute('href'))).toEqual(['/agents', '/agents?tab=org-chart', '/agents?tab=configuration', '/agents?tab=skills'])
    expect(tabs[0]).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: `Details: ${ROSTER[0].name}` })).toHaveAttribute('href', `/agents?agent=${ROSTER[0].id}`)
  })

  it('says while the agents load, and when they fail, with a retry that reads both again', () => {
    render(<AgentsPage />)
    expect(screen.getByText(LOADING)).toBeInTheDocument()
    act(() => host.setPageQuery('useAgents', { error: 'The backend is asleep.' }))
    expect(screen.getByRole('alert')).toHaveTextContent(LOAD_FAILED)
    fireEvent.click(screen.getByRole('button', { name: RETRY }))
    expect(new Set(host.pageRefetches())).toEqual(new Set(['useAgents', 'useAgentStats']))
  })

  it('imports nothing of core', () => {
    const files = readdirSync(PAGE_DIR).filter((name) => /\.tsx?$/.test(name))
    expect(files.length).toBeGreaterThan(0)
    expect(files.filter((name) => CORE_IMPORT.test(readFileSync(new URL(name, PAGE_DIR), 'utf8')))).toEqual([])
  })
})
