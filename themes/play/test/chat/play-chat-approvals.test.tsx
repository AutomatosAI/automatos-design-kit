// PRD-260 T-005c — approvals in Play's chat, as the core chat shows them. Moved from core's
// components/play/chat/__tests__/play-chat-approvals.test.tsx (at 101a0bf33) and rewritten for the kit: the SDK is
// the harness's fake (packages/theme-harness), so the turn's tool-data `tool_approval` and `mission_approval` parts
// come from a recorded turn the send takes (host.setChatScript), held open while the reply is written and ended with
// host.continueHeldTurn, as core's test ended it by hand. The cards are the host's (cards.ToolApproval and
// cards.MissionApproval), here the harness's stand-ins, which keep each click (host.cardActions()) where core's
// widgets called their hooks. Hello's first open is kept in the SDK's storage area (hello-played), not in core's
// sessionStorage key. Every assertion of what Play renders is kept: the cards inside Auto's reply, Approve & run,
// Deny, Reject and the X reaching the card's own, and Auto listening while a card waits. What the host's widgets
// draw and call (the oversight, the params, the task count, a failed approve's toast), a card outliving the chat
// screen (the controller's approvals store) and lib/chat/approvals.ts itself are core's to prove, and the ledger
// names those tests (test/moved-from-core/chat.json). Auto himself is a stand-in that shows his state and caption.
// Roles and text only.
import { writeThemeState } from '@automatos/theme-sdk'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AutoMascotProps } from '../../src/components/mascot/auto-mascot.tsx'
import { APPROVALS_LABEL } from '../../src/components/play/chat/approval-cards.tsx'
import { AWAITING_ANSWER } from '../../src/components/play/chat/caption.ts'
import { PLACEHOLDER } from '../../src/components/play/chat/message-box.tsx'
import { PlayChat } from '../../src/components/play/chat/play-chat.tsx'
import { HELLO_KEY, HELLO_STATE } from '../../src/lib/mascot/session.ts'
import { host } from '@automatos/theme-harness/host'

// Auto as his state and caption only, as core's test has him: data-state, then the caption and its detail.
vi.mock('../../src/components/mascot/auto-mascot.tsx', async () => {
  const { createElement } = await import('react')
  return {
    AutoMascot: ({ state, caption, detail }: Pick<AutoMascotProps, 'state' | 'caption' | 'detail'>) =>
      createElement('div', { 'data-testid': 'auto', 'data-state': state }, caption, ' ', detail),
  }
})

type Turn = Parameters<typeof host.setChatScript>[0][number]
type Frame = Turn['frames'][number]

/** chat.tsx's card titles, as the host's cards show them (core's lib/chat/approvals.ts). */
const TOOL_APPROVAL_TITLE = 'Action approval needed'
const MISSION_APPROVAL_TITLE = 'Mission plan — approval needed'
const UPDATED = '2026-10-14T09:00:00+00:00'
const QUESTION = 'Delete the old brief?'
/** Auto's words once the turn ends, as core's test wrote them. */
const ANSWER = 'That needs your OK first.'
const CHECKING = 'Checking the brief'

// --- the payloads of result_formatter.py, as core's test has them ----------

const TOOL_APPROVAL = {
  grant_id: 42,
  action: 'platform_delete_document',
  message: 'This action (destructive) requires confirmation.',
  permission_level: 'destructive',
  params: { document_id: 7 },
  risk_class: 'destructive',
  risk_tier: 'human_in_the_loop',
  oversight_rationale: 'Destructive: deletes data. A human must approve before it runs.',
  requires_approval: true,
}
const MISSION_APPROVAL = {
  mission_id: 'm-1',
  goal: 'Refund the customer and email them',
  state: 'awaiting_approval',
  task_count: 2,
  tasks: [
    { title: 'Issue refund', agent_role: 'ops', sequence: 1 },
    { title: 'Send email', agent_role: 'comms', sequence: 2 },
  ],
  risk_class: 'external_side_effect',
  risk_tier: 'human_in_the_loop',
  oversight_rationale: 'External side-effect: acts on a third-party system.',
  requires_approval: true,
}
const dataPart = (type: string, data: unknown): Frame => ({ data: { type, data } })
const toolData = (data: unknown): Frame => dataPart('tool-data', data)

/**
 * The stored conversation on screen, then QUESTION sent: the reply being written carries `raised`, a frame per
 * tick, and the turn stays open (core's test opened it streaming, with the reply already on screen).
 */
async function renderTurn(...raised: readonly Frame[]) {
  host.setConversations([
    { id: 'c1', title: 'Tidy the shelf', updatedAt: UPDATED, preview: null, messages: [{ role: 'user', text: 'Hello' }, { role: 'assistant', text: 'Hi.' }] },
  ])
  host.setSearchParams('chatId=c1')
  host.setChatScript([{ frames: raised, hold: true }])
  render(<PlayChat />)
  await screen.findByRole('list', { name: 'Conversation' })
  const box = screen.getByRole('textbox', { name: PLACEHOLDER })
  fireEvent.change(box, { target: { value: QUESTION } })
  fireEvent.keyDown(box, { key: 'Enter' })
}

/** The turn ends: Auto's words in the reply, then the chat back to idle (Send again). */
async function finishTurn() {
  act(() => host.continueHeldTurn({ frames: [{ text: ANSWER }] }))
  await screen.findByRole('button', { name: 'Send' })
}

const auto = () => screen.getByTestId('auto')
const reply = (): HTMLElement => {
  const replies = screen.getAllByRole('article', { name: 'Auto said' })
  return replies[replies.length - 1]
}
const cardsNow = () => within(reply()).getByRole('region', { name: APPROVALS_LABEL })
/** The reply's approvals region once it is on screen: it renders a tick after its data part. */
const cards = () => waitFor(cardsNow)
const click = (button: HTMLElement) =>
  act(async () => {
    fireEvent.click(button)
  })

beforeEach(() => {
  host.reset()
  writeThemeState(HELLO_KEY, true, HELLO_STATE) // hello already played this session
})

describe('an action that needs approval (tool_approval)', () => {
  it("renders the core's 'Action approval needed' card inside the reply, with the action it asks to run", async () => {
    await renderTurn(toolData({ tool_approval: TOOL_APPROVAL }))
    const card = await cards()
    expect(within(card).getByText(TOOL_APPROVAL_TITLE)).toBeInTheDocument()
    expect(within(card).getAllByText('platform_delete_document').length).toBeGreaterThan(0)
  })

  it("Approve & run is the host card's, for the grant; Auto listens until then", async () => {
    await renderTurn(toolData({ tool_approval: TOOL_APPROVAL }))
    await waitFor(() => expect(auto()).toHaveAttribute('data-state', 'listening'))
    await finishTurn()
    expect(auto()).toHaveAttribute('data-state', 'listening')
    expect(auto()).toHaveTextContent(AWAITING_ANSWER)

    await click(within(await cards()).getByRole('button', { name: /approve & run/i }))
    expect(host.cardActions()).toEqual([{ card: 'tool-approval', id: '42', action: 'approved' }])
    await waitFor(() => expect(within(cardsNow()).getByRole('status')).toHaveTextContent(/the action ran/i))
    await waitFor(() => expect(auto()).toHaveAttribute('data-state', 'idle'))
  })

  it("Deny is the host card's, for the grant, and Auto stops listening", async () => {
    await renderTurn(toolData({ tool_approval: TOOL_APPROVAL }))
    await finishTurn()
    await click(within(await cards()).getByRole('button', { name: /deny/i }))
    expect(host.cardActions()).toEqual([{ card: 'tool-approval', id: '42', action: 'denied' }])
    await waitFor(() => expect(within(cardsNow()).getByRole('status')).toHaveTextContent(/will not run/i))
    await waitFor(() => expect(auto()).toHaveAttribute('data-state', 'idle'))
  })

  it('closing the card with its X takes it away and ends the wait', async () => {
    await renderTurn(toolData({ tool_approval: TOOL_APPROVAL }))
    await finishTurn()
    await click(within(await cards()).getByRole('button', { name: 'Close' }))
    expect(within(reply()).queryByRole('region', { name: APPROVALS_LABEL })).toBeNull()
    await waitFor(() => expect(auto()).toHaveAttribute('data-state', 'idle'))
  })
})

describe('a Mission plan that needs approval (mission_approval)', () => {
  it("renders the core's plan card: the goal and its tasks in order", async () => {
    await renderTurn(toolData({ mission_approval: MISSION_APPROVAL }))
    const card = await cards()
    expect(within(card).getByText(MISSION_APPROVAL_TITLE)).toBeInTheDocument()
    expect(within(card).getByText('Refund the customer and email them')).toBeInTheDocument()
    expect(within(card).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      expect.stringContaining('Issue refund'),
      expect.stringContaining('Send email'),
    ])
  })

  it("Approve & run is the host card's; the card leaves the reply as it leaves Studio's canvas", async () => {
    await renderTurn(toolData({ mission_approval: MISSION_APPROVAL }))
    await finishTurn()
    await waitFor(() => expect(auto()).toHaveAttribute('data-state', 'listening'))
    await click(within(await cards()).getByRole('button', { name: /approve & run/i }))
    expect(host.cardActions()).toEqual([{ card: 'mission-approval', id: 'm-1', action: 'approved' }])
    await waitFor(() => expect(within(reply()).queryByRole('region', { name: APPROVALS_LABEL })).toBeNull())
    await waitFor(() => expect(auto()).toHaveAttribute('data-state', 'idle'))
  })

  it("Reject is the host card's, for the plan", async () => {
    await renderTurn(toolData({ mission_approval: MISSION_APPROVAL }))
    await finishTurn()
    await click(within(await cards()).getByRole('button', { name: /reject/i }))
    expect(host.cardActions()).toEqual([{ card: 'mission-approval', id: 'm-1', action: 'rejected' }])
    await waitFor(() => expect(auto()).toHaveAttribute('data-state', 'idle'))
  })

  it('Auto listens until the last waiting card is settled', async () => {
    await renderTurn(toolData({ mission_approval: MISSION_APPROVAL, tool_approval: TOOL_APPROVAL }))
    await finishTurn()
    await click(within(await cards()).getByRole('button', { name: /reject/i }))
    await waitFor(() => expect(within(cardsNow()).queryByText(MISSION_APPROVAL_TITLE)).toBeNull())
    expect(auto()).toHaveAttribute('data-state', 'listening')
    await click(within(await cards()).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(auto()).toHaveAttribute('data-state', 'idle'))
  })
})

describe('parts that are not approvals', () => {
  it('render nothing and leave Auto as he was', async () => {
    await renderTurn(
      toolData({ tool_approval: { grant_id: '../1', action: 'x' }, mission_approval: { mission_id: '../../admin', goal: 'x' } }),
      dataPart('tool-start', { tool_approval: TOOL_APPROVAL }),
      toolData({ documents: [{ id: 'd1' }] }),
      // A progress line after them, so the test knows the parts before it were read; it moves no one.
      dataPart('progress', { text: CHECKING }),
    )
    expect(auto()).toHaveAttribute('data-state', 'thinking')
    expect(await within(reply()).findByText(CHECKING)).toBeInTheDocument()
    expect(within(reply()).queryByRole('region', { name: APPROVALS_LABEL })).toBeNull()
    expect(auto()).toHaveAttribute('data-state', 'thinking')
  })
})
