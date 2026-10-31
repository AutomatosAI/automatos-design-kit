// HUD 1.2.0 (PRD-268): MISSIONS and SYSTEMS on the harness's page and proactive fakes. MISSIONS asks for the newest
// Missions and lists them, the ones that need you first, each its goal linked, its state as a glyph and a HUD word, `▸`
// and its next step, a rail while it works, Try again on a failed one through the SDK's own routes, and never glows.
// SYSTEMS lists what Auto depends on from useReadiness, each its state as a glyph and a word, its detail and its fix,
// with Check again. Roles, names, text and attributes only; every value is made up.
import { missionHref } from '@automatos/theme-sdk'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { host } from '@automatos/theme-harness/host'
import {
  MISSIONS_FAILED, MISSIONS_LOADING, MISSIONS_SHOWN, MISSIONS_TITLE, MissionsPanel, RECENT_MISSIONS, TRY_AGAIN,
} from '../../src/chat/panels/missions-panel.tsx'
import { CHECK_AGAIN, SYSTEMS_FAILED, SYSTEMS_LOADING, SYSTEMS_TITLE, SystemsPanel } from '../../src/chat/panels/systems-panel.tsx'
import { mission, missionList, READINESS } from './support.ts'

const panel = (title: string): HTMLElement => screen.getByRole('region', { name: title })

const MISSIONS = missionList([
  mission({ id: 'm-1', goal: 'Compare three laptops', display_state: 'working', next_step: 'Step 2 of 3: compare the battery tests' }),
  mission({ id: 'm-2', goal: 'Build the debate slides', state: 'completed', state_type: 'terminal', display_state: 'done' }),
  mission({
    id: 'm-3', goal: 'Plan the revision week', state: 'awaiting_approval', display_state: 'needs_you', next_step: 'Approve the plan, or reject it.',
  }),
  mission({
    id: 'm-4', goal: 'Check student discounts', state: 'failed', state_type: 'terminal', display_state: 'failed',
    next_step: "The discount site didn't answer.", retry: 'rerun_mission', config: { depth: 'quick' },
  }),
  mission({ id: 'm-5', goal: 'Sort the reading list', display_state: null }),
])

beforeEach(() => {
  host.reset()
})

describe('MISSIONS', () => {
  it('asks for the newest Missions and says it is loading, or that it failed', () => {
    const { unmount } = render(<MissionsPanel />)
    expect(host.pageAsks()).toContainEqual({ hook: 'useMissions', args: [RECENT_MISSIONS] })
    expect(panel(MISSIONS_TITLE)).toHaveTextContent(MISSIONS_LOADING)
    unmount()
    render(<MissionsPanel />)
    act(() => host.setPageQuery('useMissions', { error: 'Request failed' }))
    expect(panel(MISSIONS_TITLE)).toHaveTextContent(MISSIONS_FAILED)
  })

  it('lists the ones that need you first, each linked, its state as a glyph and a word, and ▸ its next step', () => {
    render(<MissionsPanel />)
    act(() => host.setPageQuery('useMissions', { data: MISSIONS }))
    const rows = within(panel(MISSIONS_TITLE)).getAllByRole('listitem')
    expect(rows).toHaveLength(MISSIONS_SHOWN)
    expect(rows.map((row) => row.textContent)).toEqual([
      'Plan the revision week◆ NEEDS YOU▸ Approve the plan, or reject it.',
      'Compare three laptops● WORKING▸ Step 2 of 3: compare the battery tests',
      'Build the debate slides✓ DONE',
      `Check student discounts✕ FAILED▸ The discount site didn't answer.${TRY_AGAIN}`,
    ])
    expect(within(rows[0]).getByRole('link', { name: 'Plan the revision week' })).toHaveAttribute('href', missionHref('m-3'))
    expect(within(rows[0]).getByText('NEEDS YOU', { exact: false })).toHaveAttribute('data-tone', 'live')
    expect(within(rows[3]).getByText('FAILED', { exact: false })).toHaveAttribute('data-tone', 'failed')
    expect(within(rows[2]).getByText('DONE', { exact: false })).toHaveAttribute('data-tone', 'quiet')
    expect(panel(MISSIONS_TITLE)).toHaveTextContent('5')
  })

  it('draws a rail on the one at work alone, and no state for one the server sent none for', () => {
    render(<MissionsPanel />)
    act(() => host.setPageQuery('useMissions', { data: missionList([...MISSIONS.missions.slice(0, 2), MISSIONS.missions[4]]) }))
    const rows = within(panel(MISSIONS_TITLE)).getAllByRole('listitem')
    expect(rows.map((row) => row.getAttribute('data-rail'))).toEqual(['true', null, null])
    expect(rows[2]).toHaveTextContent(/^Sort the reading list$/)
    expect(rows[2]).not.toHaveAttribute('data-display-state')
  })

  it('tries a failed one again through the route the server names: a rerun from its goal and settings, or a replan', async () => {
    render(<MissionsPanel />)
    const replanned = mission({ id: 'm-6', goal: 'Draft the poster', display_state: 'failed', retry: 'replan_mission' })
    act(() => host.setPageQuery('useMissions', { data: missionList([MISSIONS.missions[3], replanned]) }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: `${TRY_AGAIN}: Check student discounts` }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: `${TRY_AGAIN}: Draft the poster` }))
    })
    expect(host.pageRuns()).toEqual([
      { hook: 'useRerunMission', variables: { goal: 'Check student discounts', config: { depth: 'quick' } } },
      { hook: 'useReplanMission', variables: { id: 'm-6' } },
    ])
  })

  it('never glows, whatever needs you', () => {
    render(<MissionsPanel />)
    act(() => host.setPageQuery('useMissions', { data: MISSIONS }))
    expect(panel(MISSIONS_TITLE)).not.toHaveAttribute('data-live')
  })
})

describe('SYSTEMS', () => {
  it('says it is checking until useReadiness answers, and says so when it fails', () => {
    const { unmount } = render(<SystemsPanel />)
    expect(host.pageAsks()).toContainEqual({ hook: 'useReadiness', args: [] })
    expect(panel(SYSTEMS_TITLE)).toHaveTextContent(SYSTEMS_LOADING)
    unmount()
    render(<SystemsPanel />)
    act(() => host.setPageQuery('useReadiness', { error: 'Request failed' }))
    expect(panel(SYSTEMS_TITLE)).toHaveTextContent(SYSTEMS_FAILED)
  })

  it("lists what Auto depends on: each item's state as a glyph and a word, its detail and its fix, and how many are ready", () => {
    render(<SystemsPanel />)
    act(() => host.setPageQuery('useReadiness', { data: READINESS }))
    const rows = within(panel(SYSTEMS_TITLE)).getAllByRole('listitem')
    expect(rows.map((row) => row.textContent)).toEqual([
      'Automatos✓ READYAnswering.',
      "Web search○ NOT CHECKEDThe check didn't answer in time.",
      'Calendar◆ NEEDS SETUPNo calendar is connected.Connect calendar',
    ])
    expect(within(rows[2]).getByRole('link', { name: 'Connect calendar' })).toHaveAttribute('href', '/settings?tab=integrations')
    expect(within(rows[2]).getByText('NEEDS SETUP', { exact: false })).toHaveAttribute('data-tone', 'live')
    expect(within(rows[1]).getByText('NOT CHECKED', { exact: false })).toHaveAttribute('data-tone', 'quiet')
    expect(panel(SYSTEMS_TITLE)).toHaveTextContent('1 / 3')
    expect(panel(SYSTEMS_TITLE)).not.toHaveAttribute('data-live')
  })

  it('checks again through the SDK, and says why in one line when the server refuses', async () => {
    host.setPageAction('useCheckReadiness', () => {
      throw new Error('Checked a moment ago.')
    })
    render(<SystemsPanel />)
    act(() => host.setPageQuery('useReadiness', { data: READINESS }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: CHECK_AGAIN }))
    })
    expect(host.pageRuns()).toEqual([{ hook: 'useCheckReadiness', variables: undefined }])
    expect(within(panel(SYSTEMS_TITLE)).getByRole('status')).toHaveTextContent('Checked a moment ago.')
  })
})
