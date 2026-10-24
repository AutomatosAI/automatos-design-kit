// The core screen's side panels on the harness's page and Deliverables fakes: AGENTS lists the roster, active ones
// first, each status a glyph and a word, with how many are active; MISSION shows the Mission running now, linked to
// its page, with its steps, and asks the activity feed for exactly that; DELIVERABLES lists the newest three, each
// linked to its page, and says so when the list fails, a 200 with success: false included. Each says when it is
// still loading. The rows are made up. Roles, names and text only.
import type { ActivityFeed, Deliverable, RosterAgent } from '@automatos/theme-sdk'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { host } from '@automatos/theme-harness/host'
import { AGENTS_LOADING, AGENTS_TITLE, AgentsPanel } from '../../src/chat/panels/agents-panel.tsx'
import {
  ALL_DELIVERABLES, DELIVERABLES_FAILED, DELIVERABLES_TITLE, DeliverablesPanel, NO_DELIVERABLES,
} from '../../src/chat/panels/deliverables-panel.tsx'
import { MISSION_TITLE, MissionPanel, NO_MISSION, RUNNING_MISSION } from '../../src/chat/panels/mission-panel.tsx'

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
