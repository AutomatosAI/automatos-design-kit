/**
 * PRD-268 (SDK 1.3.0): the approval view on the ToolApproval and MissionApproval stand-ins, and the ReadinessList and
 * CalibrationCard stand-ins, read through the SDK as a theme places them. An approval whose payload carries
 * `approval_view` (fixtures/streams/turns.json's approvalView turn holds one) shows who asked, the action, its target,
 * the preview and the rule before its buttons, inside its protected surface, and answers 1 (Deny, Reject) and 3
 * (Approve & run) while it has focus; a view for another card is dropped. ReadinessList draws the sample readiness
 * (fixtures/proactive/readiness.json) with Check again as the area's run; CalibrationCard draws what it is given.
 */
import {
  CalibrationCard, MissionApproval, ReadinessList, ToolApproval, type ApprovalViewData, type CalibrationAnswer, type MissionApprovalData,
  type ToolApprovalData,
} from '@automatos/theme-sdk'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import missionFixture from '../fixtures/cards/mission-approval.json'
import turnsFixture from '../fixtures/streams/turns.json'
import { host } from '../src/host.ts'
import { SAMPLE_PAGE_DATA } from '../src/host/sample-data.ts'
import { APPROVE_LABEL, DENY_LABEL } from '../src/sdk/cards/approvals.tsx'
import { CHECK_AGAIN, CHECKED_A_MOMENT_AGO, CHECKED_RECENTLY, READINESS_TITLE } from '../src/sdk/cards/readiness-list.tsx'
import { FORGET_THAT, SOUNDS_RIGHT } from '../src/sdk/cards/calibration-card.tsx'

type ApprovalFrame = { readonly data: { readonly data: { readonly tool_approval: ToolApprovalData } } }
/** The approvalView turn's tool approval: Auto asks before it sends, with the view. */
const TOOL = (turnsFixture.turns.approvalView.frames[2] as unknown as ApprovalFrame).data.data.tool_approval
const VIEW = TOOL.approval_view as ApprovalViewData
const MISSION = missionFixture as MissionApprovalData

beforeEach(() => {
  host.reset()
})

describe('the approval view', () => {
  it('shows who asked, the action, its target, the preview and the rule before the buttons, inside the protected surface', () => {
    const { container } = render(<ToolApproval data={TOOL} />)
    const body = screen.getByRole('group', { name: `Action approval needed: ${VIEW.action.summary}` })
    expect(body.closest('[data-protected-surface="tool-approval"]')).not.toBeNull()
    expect(body).toHaveAccessibleDescription(VIEW.rule.sentence)
    const text = body.textContent ?? ''
    const parts = [`Asked by ${VIEW.asked_by.name} · send`, VIEW.target?.label ?? '', VIEW.preview?.body ?? '', VIEW.rule.sentence, APPROVE_LABEL]
    const at = parts.map((part) => text.indexOf(part))
    expect(at.every((index) => index >= 0)).toBe(true)
    expect(at).toEqual([...at].sort((a, b) => a - b))
    expect(screen.getByRole('button', { name: APPROVE_LABEL })).toHaveAttribute('aria-keyshortcuts', '3')
    expect(screen.getByRole('button', { name: DENY_LABEL })).toHaveAttribute('aria-keyshortcuts', '1')
    const named = Array.from(body.querySelectorAll('*')).flatMap((node) => node.getAttributeNames()).filter((name) => name.startsWith('data-'))
    expect(named).toEqual([])
    expect(container.querySelector('[data-protected-surface-inner]')?.contains(body)).toBe(true)
  })

  it('answers 1 with Deny and 3 with Approve & run while it has focus, and 2 with nothing (Always allow is not built)', () => {
    render(<ToolApproval data={TOOL} />)
    const body = screen.getByRole('group', { name: `Action approval needed: ${VIEW.action.summary}` })
    fireEvent.keyDown(body, { key: '2' })
    expect(host.cardActions()).toEqual([])
    fireEvent.keyDown(body, { key: '1' })
    expect(host.cardActions()).toEqual([{ card: 'tool-approval', id: VIEW.grant_id, action: 'denied' }])
    render(<MissionApproval data={{ ...MISSION, approval_view: { ...VIEW, grant_id: MISSION.mission_id } }} />)
    const plan = screen.getByRole('group', { name: `Mission plan — approval needed: ${VIEW.action.summary}` })
    fireEvent.keyDown(plan, { key: '3' })
    expect(host.cardActions().at(-1)).toEqual({ card: 'mission-approval', id: MISSION.mission_id, action: 'approved' })
  })

  it("drops a view for another card, and a card without one is today's: no group, no keys", () => {
    render(<ToolApproval data={{ ...TOOL, approval_view: { ...VIEW, grant_id: '999' } }} />)
    expect(screen.queryByRole('group')).toBeNull()
    expect(screen.queryByText(VIEW.rule.sentence)).toBeNull()
    expect(screen.getByRole('button', { name: APPROVE_LABEL })).not.toHaveAttribute('aria-keyshortcuts')
  })
})

describe('ReadinessList', () => {
  it("draws each item as one sentence with its state and its in-app fix, the browser's rows after the server's", () => {
    const microphone = { id: 'microphone', label: 'Microphone', detail: '', state: 'ready' as const, needed_by: ['voice' as const] }
    render(<ReadinessList readiness={SAMPLE_PAGE_DATA.readiness} clientItems={[microphone]} />)
    const list = screen.getByRole('region', { name: READINESS_TITLE })
    expect(within(list).getAllByRole('listitem').map((row) => row.getAttribute('aria-label'))).toEqual([
      'Automatos: ready.', 'Model: ready.', 'Web search: not checked.', 'Calendar: needs setup. Connect calendar.', 'Microphone: ready.',
    ])
    expect(within(list).getByRole('link', { name: 'Connect calendar' })).toHaveAttribute('href', '/settings?tab=integrations')
  })

  it('says it is checking while nothing is read, runs Check again as the area does, and says when it checked a moment ago', async () => {
    const limited = Object.assign(new Error('Too soon'), { status: 429, body: { code: CHECKED_RECENTLY, detail: 'Too soon' } })
    host.setPageAction('useCheckReadiness', () => Promise.reject(limited))
    render(<ReadinessList readiness={null} />)
    expect(screen.getByRole('status')).toHaveTextContent('Checking…')
    fireEvent.click(screen.getByRole('button', { name: CHECK_AGAIN }))
    expect(await screen.findByText(CHECKED_A_MOMENT_AGO)).toBeInTheDocument()
    expect(host.pageRuns()).toEqual([{ hook: 'useCheckReadiness', variables: undefined }])
  })
})

describe('CalibrationCard', () => {
  it('draws each line with its source count and Reject, the offers, and the answers the theme sends', async () => {
    const onAnswer = vi.fn<(answer: CalibrationAnswer) => Promise<void>>(() => Promise.resolve())
    render(<CalibrationCard calibration={SAMPLE_PAGE_DATA.calibration} onAnswer={onAnswer} />)
    expect(screen.getByText('from 1 Deliverable and 1 Conversation')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem').filter((item) => item.getAttribute('data-ai-generated') === 'true')).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: 'Reject: You run the school bake sale.' }))
    expect(await screen.findByText(FORGET_THAT)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: SOUNDS_RIGHT }))
    await waitFor(() => expect(screen.getByRole('article')).toHaveAttribute('data-state', 'accepted'))
    expect(onAnswer.mock.calls.map(([answer]) => answer)).toEqual([
      { calibration_id: SAMPLE_PAGE_DATA.calibration.id, answer: 'reject', line_id: 'line-2' },
      { calibration_id: SAMPLE_PAGE_DATA.calibration.id, answer: 'accept' },
    ])
  })

  it("offers no Reject and disables Sounds right without the theme's handler, and says so when there is nothing to read", () => {
    const { unmount } = render(<CalibrationCard calibration={SAMPLE_PAGE_DATA.calibration} />)
    expect(screen.queryByRole('button', { name: /^Reject: / })).toBeNull()
    expect(screen.getByRole('button', { name: SOUNDS_RIGHT })).toBeDisabled()
    unmount()
    render(<CalibrationCard calibration={{ ...SAMPLE_PAGE_DATA.calibration, lines: [], empty: true }} />)
    expect(screen.getByRole('article')).toHaveAttribute('data-state', 'empty')
    expect(screen.queryByRole('button')).toBeNull()
  })
})
