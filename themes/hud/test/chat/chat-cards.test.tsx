// The host's cards and HUD's own in Auto's reply, on the harness's fake chat controller and its card stand-ins
// (each a protected surface that keeps its clicks, host.cardActions()): an approval card inside the reply, answered
// through the host's own buttons, and one whose reply left the conversation shown after it; the Deliverable a turn
// made, linked to the host's page only with a real id; the tool lines and the receipts in words; the snag box with
// Try again; the host's credits banner instead of a snag; the withdraw offer and the tickets; and the Mission Auto
// suggests once his answer is done. The payloads are made up. Roles and text only.
import { type HostReceipt, receiptLine } from '@automatos/theme-sdk'
import { act, fireEvent, waitFor, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { CREDITS_EXHAUSTED_CODE, host, LIVE_KEY } from '@automatos/theme-harness/host'
import { APPROVALS_LABEL } from '../../src/chat/approval-cards.tsx'
import { SEND } from '../../src/chat/composer.tsx'
import { MARK_DONE, MARK_FAILED, MARK_RUNNING, MARK_WAITING } from '../../src/chat/labels.ts'
import { SUGGESTION_LABEL } from '../../src/chat/mission-cards.tsx'
import { BADGE_DONE, BADGE_NOT_DONE, RECEIPTS_TITLE } from '../../src/chat/receipts.tsx'
import { TICKETS_LABEL } from '../../src/chat/reply-cards.tsx'
import { SNAG_TITLE, TRY_AGAIN, TURN_FAILED } from '../../src/chat/snag-box.tsx'
import { TOOL_LINES_LABEL } from '../../src/chat/tool-lines.tsx'
import {
  ASKED, ask, box, dataPart, failure, HELD, REFUSED, renderChat, reply, streamEnds, stubClips, toolData, toolEnd, toolStart,
  type Frame, words,
} from './support.tsx'

const TOOL_APPROVAL = {
  grant_id: 42,
  action: 'platform_delete_document',
  message: 'This action (destructive) requires confirmation.',
  risk_tier: 'human_in_the_loop',
  requires_approval: true,
}
const MISSION_APPROVAL = {
  mission_id: 'm-1',
  goal: 'Compare three laptops and write it up',
  task_count: 1,
  tasks: [{ title: 'Compare laptops', agent_role: 'research', sequence: 1 }],
}
const TOOL_APPROVAL_TITLE = 'Action approval needed'
const MISSION_APPROVAL_TITLE = 'Mission plan — approval needed'

function receipt(fields: Partial<HostReceipt>): HostReceipt {
  return { action: 'platform_update_task', kind: 'write', status: 'done', subject: '', effect: '', link: null, reason: null, ...fields }
}
const receiptsPart = (receipts: readonly HostReceipt[]): Frame => toolData({ [LIVE_KEY]: { receipts, above: [] } })
const cards = () => waitFor(() => within(reply()).getByRole('region', { name: APPROVALS_LABEL }))

beforeEach(() => {
  host.reset()
  stubClips()
})

describe('approval cards', () => {
  it("shows the host's tool approval inside the reply; Approve & run is the card's own, for the grant", async () => {
    await renderChat([{ frames: [toolData({ tool_approval: TOOL_APPROVAL })], hold: true }])
    ask()
    const card = await cards()
    const surface = within(card).getByRole('region', { name: TOOL_APPROVAL_TITLE })
    expect(surface).toHaveAttribute('data-protected-surface', 'tool-approval')
    fireEvent.click(within(surface).getByRole('button', { name: /approve & run/i }))
    expect(host.cardActions()).toEqual([{ card: 'tool-approval', id: '42', action: 'approved' }])
    expect(within(surface).getByRole('status')).toHaveTextContent(/the action ran/i)
  })

  it("shows the host's Mission plan inside the reply, and Reject closes it", async () => {
    await renderChat([{ frames: [toolData({ mission_approval: MISSION_APPROVAL })], hold: true }])
    ask()
    const card = await cards()
    const surface = within(card).getByRole('region', { name: MISSION_APPROVAL_TITLE })
    await act(async () => {
      fireEvent.click(within(surface).getByRole('button', { name: /reject/i }))
    })
    expect(host.cardActions()).toEqual([{ card: 'mission-approval', id: 'm-1', action: 'rejected' }])
    await waitFor(() => expect(within(reply()).queryByRole('region', { name: APPROVALS_LABEL })).toBeNull())
  })
})

describe('the Deliverable card', () => {
  it("links a Deliverable the turn made to the host's page for it", async () => {
    await renderChat([{ frames: [toolData({ generated_document: { deliverable_id: 'd-42', title: 'Laptop shortlist', format: 'pdf' } })], hold: true }])
    ask()
    const card = await waitFor(() => within(reply()).getByRole('article', { name: 'Deliverable: Laptop shortlist' }))
    expect(within(card).getByRole('link', { name: 'Open Laptop shortlist' })).toHaveAttribute('href', '/deliverables?deliverable=d-42')
    expect(card).toHaveTextContent('Document · just now')
  })

  it('shows no card for an id that is not a Deliverable id', async () => {
    await renderChat([{ frames: [toolData({ generated_document: { deliverable_id: '../../admin?x=1', title: 'Sneaky' } }), words('Here.')], hold: true }])
    ask()
    await waitFor(() => expect(reply()).toHaveTextContent('Here.'))
    expect(screen.queryByRole('article', { name: 'Deliverable: Sneaky' })).toBeNull()
  })
})

describe('tool lines and receipts', () => {
  it('says each call in words after its glyph: done, failed, waiting for you, running', async () => {
    await renderChat([{
      frames: [
        toolStart('t1', 'platform_web_search'),
        toolEnd({ toolCallId: 't1', toolName: 'platform_web_search', success: true, summary: '3 results', durationMs: 2140 }),
        toolStart('t2', 'platform_send_email'),
        toolEnd({ toolCallId: 't2', toolName: 'platform_send_email', error: 'the mail server timed out' }),
        toolStart('t3', 'platform_update_agent'),
        toolEnd({ toolCallId: 't3', toolName: 'platform_update_agent', waiting: true, summary: 'card raised' }),
        toolStart('t4', 'platform_web_search', { query: 'budget laptops' }),
      ],
      hold: true,
    }])
    ask()
    const lines = () => within(within(reply()).getByRole('list', { name: TOOL_LINES_LABEL })).getAllByRole('listitem')
    await waitFor(() => expect(lines()).toHaveLength(4))
    expect(lines().map((line) => line.textContent)).toEqual([
      `${MARK_DONE}Searched the web · 3 results · 2.1 s`,
      `${MARK_FAILED}Send email didn't work · the mail server timed out`,
      `${MARK_WAITING}Waiting for you · card raised`,
      `${MARK_RUNNING}Searching the web: 'budget laptops'`,
    ])
  })

  it("lists what Auto did in the host's words, a done one linked to its page, each with its tag", async () => {
    const done = receipt({ subject: '#0422', effect: 'moved to Done', link: '/activity?ticket=422' })
    const refused = receipt({ action: 'platform_send_email', status: 'refused', subject: 'Letter to the team', reason: 'no mail connection' })
    await renderChat([{ frames: [receiptsPart([done, refused]), words('Done.')] }])
    ask()
    const section = await waitFor(() => within(reply()).getByRole('region', { name: RECEIPTS_TITLE }))
    const items = within(section).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual([
      `${MARK_DONE}${receiptLine(done)}${BADGE_DONE}`,
      `${MARK_FAILED}${receiptLine(refused)}${BADGE_NOT_DONE}`,
    ])
    expect(within(items[0]).getByRole('link', { name: receiptLine(done) })).toHaveAttribute('href', '/activity?ticket=422')
  })
})

describe('the snag box', () => {
  it('shows a reply that failed in words, and Try again asks again with the focus in the box', async () => {
    await renderChat([{ frames: [failure({ message: 'The model took too long to answer.', code: 'timeout' })] }, HELD])
    ask()
    const snag = await waitFor(() => within(reply()).getByRole('region', { name: SNAG_TITLE }))
    expect(snag).toHaveTextContent('The model took too long to answer.')
    await streamEnds()
    fireEvent.click(within(snag).getByRole('button', { name: TRY_AGAIN }))
    expect(host.chatSent()).toEqual([{ chatId: 'c1', text: ASKED, retry: false }, { chatId: 'c1', text: ASKED, retry: true }])
    expect(box()).toHaveFocus()
  })

  it('shows a turn that failed before the reply began under the conversation', async () => {
    await renderChat([REFUSED, HELD])
    ask()
    const snag = await screen.findByRole('region', { name: SNAG_TITLE })
    expect(snag).toHaveTextContent(TURN_FAILED)
    fireEvent.click(within(snag).getByRole('button', { name: TRY_AGAIN }))
    expect(host.chatSent().map((sent) => sent.retry)).toEqual([false, true])
  })

  it("shows the host's credits banner, not a snag, when the credits are used up", async () => {
    await renderChat([{ frames: [], status: 402, body: `{"error_code": "${CREDITS_EXHAUSTED_CODE}"}` }])
    ask()
    expect(await screen.findByRole('alert')).toHaveAttribute('data-protected-surface', 'trial-exhausted-banner')
    expect(screen.queryByRole('region', { name: SNAG_TITLE })).toBeNull()
  })
})

describe("the host's other cards", () => {
  it('places the withdraw offer and the tickets inside the reply that carries them', async () => {
    const offer = { message: 'A request is still waiting on your yes.', requests: [{ grant_id: 7, action: 'platform_delete_document', reason: 'You said no' }] }
    const ticket = { id: 92, number: '#0042', title: 'Write the comparison', status: 'in_progress', assigned_agent: 'Scout' }
    await renderChat([{ frames: [words('Filed it.'), toolData({ task_card: ticket }), dataPart('withdraw_offer', offer)] }])
    ask()
    await waitFor(() => expect(within(reply()).getByRole('group', { name: 'Withdraw request' })).toHaveTextContent(offer.message))
    const tickets = within(reply()).getByRole('region', { name: TICKETS_LABEL })
    expect(within(tickets).getByRole('article', { name: 'Task #0042' })).toHaveTextContent('Write the comparison')
  })

  it("shows the host's Mission suggestion once the turn is over", async () => {
    const suggestion = dataPart('mission-suggestion', { goal: 'Research ten laptops and compare them', complexity: 'medium' })
    await renderChat([{ frames: [suggestion, words('That is a big one.')], hold: true }])
    ask()
    await waitFor(() => expect(reply()).toHaveTextContent('That is a big one.'))
    expect(screen.queryByRole('region', { name: SUGGESTION_LABEL })).toBeNull()
    act(() => host.continueHeldTurn({ frames: [] }))
    await screen.findByRole('button', { name: SEND })
    expect(screen.getByRole('region', { name: SUGGESTION_LABEL })).toHaveTextContent('Research ten laptops and compare them')
  })
})
