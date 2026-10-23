// PRD-260 T-005c — approvals in Play's chat as the stream brings them, and a reply Stop ends. Moved from core's
// components/play/chat/__tests__/play-chat-approvals-stream.test.tsx (at 101a0bf33) and rewritten for the kit:
// core's test wrote useChat's data stream by hand; here the harness's fake SDK (packages/theme-harness) plays the
// same lines as recorded turns, a frame per tick (host.setChatScript; a held turn goes on with
// host.continueHeldTurn, as core's test wrote more lines into the open stream). Hello's first open is kept in the
// SDK's storage area (hello-played), not in core's sessionStorage key. Every assertion of what Play renders is
// kept: the cards inside the reply being written, a card outliving the reply Try again replaced (under "Approvals
// still open" while it waits and under "Approvals" once answered, M77, in the conversation's column, M80), Stop
// keeping the reply (P260-FX-30: its words, "You stopped this answer.", a tool line left running read as stopped,
// a card inside it, the next reply under it) and a card settled mid-turn returning Auto to the tool still running.
// The cards are the host's (cards.ToolApproval and cards.MissionApproval), here the harness's stand-ins, which keep
// each click (host.cardActions()). What core's own stream hook does (dropping the reply on Stop, the turn cancelled
// on the server, a detached reply merged in on chat_changed) is core's to prove, and the ledger names those tests
// (test/moved-from-core/chat.json). Auto himself is a stand-in that shows his state and caption. Roles and text only.
import { writeThemeState } from '@automatos/theme-sdk'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AutoMascotProps } from '../../src/components/mascot/auto-mascot.tsx'
import { APPROVALS_LABEL, LOOSE_APPROVALS_LABEL } from '../../src/components/play/chat/approval-cards.tsx'
import { STOPPED_NOTICE } from '../../src/components/play/chat/auto-reply.tsx'
import { AWAITING_ANSWER } from '../../src/components/play/chat/caption.ts'
import { PLACEHOLDER } from '../../src/components/play/chat/message-box.tsx'
import { PlayChat } from '../../src/components/play/chat/play-chat.tsx'
import { TRY_AGAIN } from '../../src/components/play/chat/snag-box.tsx'
import { TOOL_LINES_LABEL } from '../../src/components/play/chat/tool-lines.tsx'
import { TURN_END_LABEL } from '../../src/components/play/chat/turn-end.tsx'
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
const ASK = 'Delete the old brief?'
const PARTIAL = 'The keeper climbed the stairs'

// --- the wire's lines as recorded frames: `0:` words, `d:` data, `e:` a failure; result_formatter.py's payloads ----

const words = (text: string): Frame => ({ text })
const dataPart = (type: string, data: unknown): Frame => ({ data: { type, data } })
const TOOL_APPROVAL = {
  grant_id: 42,
  action: 'platform_delete_document',
  message: 'This action (destructive) requires confirmation.',
  permission_level: 'destructive',
  params: { document_id: 7 },
  risk_tier: 'human_in_the_loop',
  requires_approval: true,
}
const MISSION_APPROVAL = { mission_id: 'm-1', goal: 'Refund the customer', state: 'awaiting_approval', tasks: [{ title: 'Issue refund' }] }
const APPROVAL_PART = dataPart('tool-data', { tool_approval: TOOL_APPROVAL })
const MISSION_PART = dataPart('tool-data', { mission_approval: MISSION_APPROVAL })
const FAILED: Frame = { error: { message: 'The model stopped answering.' } }
const SEARCH_START = dataPart('tool-start', { toolCallId: 't1', toolName: 'platform_web_search', input: { query: 'lighthouse keepers' } })
/** The turn Try again takes. */
const AGAIN: Turn = { frames: [words('Here it is again.')] }
const HELD: Turn = { frames: [], hold: true }

const auto = () => screen.getByTestId('auto')
const replies = () => screen.getAllByRole('article', { name: 'Auto said' })
const latest = (): HTMLElement => replies()[replies().length - 1]
/** The reply Stop ended: the newest of Auto's, after the stored "Hi.". */
const stoppedReply = () => replies()[1]
const looseCards = () => screen.getByRole('region', { name: LOOSE_APPROVALS_LABEL })
/** What follows the conversation, in its column (TurnEnd). */
const turnEnd = () => screen.getByRole('group', { name: TURN_END_LABEL })
const click = (button: HTMLElement) =>
  act(async () => {
    fireEvent.click(button)
  })

/** Type into the message box and press Enter. */
function send(text: string) {
  const box = screen.getByRole('textbox', { name: PLACEHOLDER })
  fireEvent.change(box, { target: { value: text } })
  fireEvent.keyDown(box, { key: 'Enter' })
}

/** Open the stored chat and send ASK through the message box: the send takes the first of `turns`. */
async function openAndSend(turns: readonly Turn[]) {
  host.setConversations([
    { id: 'c1', title: 'Tidy the shelf', updatedAt: UPDATED, preview: null, messages: [{ role: 'user', text: 'Hello' }, { role: 'assistant', text: 'Hi.' }] },
  ])
  host.setSearchParams('chatId=c1')
  host.setChatScript(turns)
  render(<PlayChat />)
  await screen.findByRole('list', { name: 'Conversation' })
  send(ASK)
  expect(host.chatSent()).toHaveLength(1)
  expect(auto()).toHaveAttribute('data-state', 'thinking')
}

/** A turn's stream ends a tick after its last frame (the harness plays a frame per tick): let that tick pass. */
const streamEnds = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

/** The turn fails in words, and Try again replaces its reply with a new one (AGAIN): the reply leaves the conversation. */
async function failThenTryAgain() {
  const retry = await waitFor(() => within(latest()).getByRole('button', { name: TRY_AGAIN }))
  await streamEnds()
  await click(retry)
  expect(host.chatSent().map((sent) => sent.retry)).toEqual([false, true])
  await screen.findByText('Here it is again.')
  await screen.findByRole('button', { name: 'Send' })
}

beforeEach(() => {
  host.reset()
  writeThemeState(HELLO_KEY, true, HELLO_STATE) // hello already played this session
})

describe("the stream's tool-data line → the card inside the reply being written", () => {
  it("a tool_approval and a mission_approval on the wire become the core's cards in the streaming reply; Auto listens", async () => {
    await openAndSend([{ frames: [words('That needs your OK first.'), APPROVAL_PART, MISSION_PART], hold: true }])
    const writing = await waitFor(() => {
      const newest = latest()
      within(newest).getByText(MISSION_APPROVAL_TITLE)
      return newest
    })
    expect(writing).toHaveAttribute('aria-busy', 'true')
    const cards = within(writing).getByRole('region', { name: APPROVALS_LABEL })
    expect(within(cards).getByText(TOOL_APPROVAL_TITLE)).toBeInTheDocument()
    expect(within(cards).getByText(MISSION_APPROVAL_TITLE)).toBeInTheDocument()
    await waitFor(() => expect(auto()).toHaveAttribute('data-state', 'listening'))
    act(() => host.continueHeldTurn({ frames: [] }))
    await screen.findByRole('button', { name: 'Send' })
    expect(auto()).toHaveAttribute('data-state', 'listening')
    expect(auto()).toHaveTextContent(AWAITING_ANSWER)
  })
})

describe('a card outlives its reply', () => {
  it('Try again replaces the reply, the card stays under the conversation and answering it returns Auto to idle', async () => {
    await openAndSend([{ frames: [APPROVAL_PART, FAILED] }, AGAIN])
    await failThenTryAgain()
    expect(screen.queryAllByRole('region', { name: APPROVALS_LABEL })).toHaveLength(0)
    expect(within(looseCards()).getByText(TOOL_APPROVAL_TITLE)).toBeInTheDocument()
    expect(within(turnEnd()).getByRole('region', { name: LOOSE_APPROVALS_LABEL })).toBe(looseCards())
    await waitFor(() => expect(auto()).toHaveAttribute('data-state', 'listening'))
    expect(auto()).toHaveTextContent(AWAITING_ANSWER)

    await click(within(looseCards()).getByRole('button', { name: /approve & run/i }))
    expect(host.cardActions()).toEqual([{ card: 'tool-approval', id: '42', action: 'approved' }])
    // Answered, it is no longer "still open": the same card, its outcome showing, under "Approvals" (M77).
    await waitFor(() => expect(screen.queryByRole('region', { name: LOOSE_APPROVALS_LABEL })).toBeNull())
    const answered = within(turnEnd()).getByRole('region', { name: APPROVALS_LABEL })
    expect(within(answered).getByRole('status')).toHaveTextContent(/the action ran/i)
    expect(within(answered).queryByRole('button', { name: /approve & run/i })).toBeNull()
    await waitFor(() => expect(auto()).toHaveAttribute('data-state', 'idle'))
  })

  it('with two cards left open, answering one moves it under "Approvals"; the other waits under "Approvals still open"', async () => {
    await openAndSend([{ frames: [APPROVAL_PART, MISSION_PART, FAILED] }, AGAIN])
    await failThenTryAgain()
    const open = within(turnEnd()).getAllByRole('region', { name: LOOSE_APPROVALS_LABEL })
    expect(open).toHaveLength(2)

    const tool = open.find((region) => within(region).queryByText(TOOL_APPROVAL_TITLE) !== null) as HTMLElement
    await click(within(tool).getByRole('button', { name: /deny/i }))
    expect(host.cardActions()).toEqual([{ card: 'tool-approval', id: '42', action: 'denied' }])
    await waitFor(() => expect(within(looseCards()).getByText(MISSION_APPROVAL_TITLE)).toBeInTheDocument())
    expect(within(looseCards()).queryByText(TOOL_APPROVAL_TITLE)).toBeNull()
    const answered = within(turnEnd()).getByRole('region', { name: APPROVALS_LABEL })
    expect(within(answered).getByText(TOOL_APPROVAL_TITLE)).toBeInTheDocument()
    expect(within(answered).getByRole('status')).toHaveTextContent(/will not run/i)
    expect(auto()).toHaveAttribute('data-state', 'listening')
  })

  it('Try again replaces the failed reply; the card stays once, its X closes it and Auto idles', async () => {
    await openAndSend([{ frames: [APPROVAL_PART, FAILED] }, AGAIN])
    await failThenTryAgain()
    expect(screen.queryAllByRole('region', { name: APPROVALS_LABEL })).toHaveLength(0)
    expect(screen.getAllByText(TOOL_APPROVAL_TITLE)).toHaveLength(1)
    await waitFor(() => expect(auto()).toHaveAttribute('data-state', 'listening'))

    await click(within(looseCards()).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('region', { name: LOOSE_APPROVALS_LABEL })).toBeNull()
    await waitFor(() => expect(auto()).toHaveAttribute('data-state', 'idle'))
  })
})

describe('Stop keeps the reply Auto was writing (P260-FX-30, decision F4)', () => {
  /** Press Stop: the chat keeps the reply being written and ends the turn. */
  const pressStop = () => click(screen.getByRole('button', { name: 'Stop' }))

  it("keeps the words written so far with 'You stopped this answer.'; the next message streams a new reply under it", async () => {
    await openAndSend([{ frames: [words(PARTIAL)], hold: true }, { frames: [words('Here is a short one.')], hold: true }])
    await screen.findByText(PARTIAL)
    await pressStop()
    expect(replies()).toHaveLength(2)
    expect(stoppedReply()).toHaveTextContent(PARTIAL)
    expect(within(stoppedReply()).getByText(STOPPED_NOTICE)).toBeInTheDocument()
    expect(stoppedReply()).toHaveAttribute('aria-busy', 'false')
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument()
    expect(auto()).toHaveAttribute('data-state', 'idle')

    send('A shorter one, please')
    await screen.findByText('Here is a short one.')
    const writing = latest()
    expect(writing).toHaveAttribute('aria-busy', 'true')
    expect(writing).toHaveTextContent('Here is a short one.')
    expect(within(writing).queryByText(STOPPED_NOTICE)).toBeNull()
    act(() => host.continueHeldTurn({ frames: [] }))
    await screen.findByRole('button', { name: 'Send' })
    expect(replies()).toHaveLength(3)
    expect(stoppedReply()).toHaveTextContent(PARTIAL)
    expect(within(stoppedReply()).getByText(STOPPED_NOTICE)).toBeInTheDocument()
    expect(screen.getAllByText(STOPPED_NOTICE)).toHaveLength(1)
  })

  it('Stop before the first word: Auto leaves thinking and the reply says you stopped it', async () => {
    await openAndSend([HELD])
    expect(auto()).toHaveAttribute('data-state', 'thinking')
    await pressStop()
    expect(replies()).toHaveLength(2)
    expect(within(stoppedReply()).getByText(STOPPED_NOTICE)).toBeInTheDocument()
    expect(auto()).toHaveAttribute('data-state', 'idle')
  })

  it("a tool line still running reads stopped ('Stopped: searching the web'), and Auto leaves searching", async () => {
    await openAndSend([{ frames: [SEARCH_START], hold: true }])
    await waitFor(() => expect(auto()).toHaveAttribute('data-state', 'searching'))
    expect(within(stoppedReply()).getByText("Searching the web: 'lighthouse keepers'")).toBeInTheDocument()
    await pressStop()
    const tools = within(stoppedReply()).getByRole('list', { name: TOOL_LINES_LABEL })
    expect(within(tools).getByText('Stopped: searching the web')).toBeInTheDocument()
    expect(within(stoppedReply()).getByText(STOPPED_NOTICE)).toBeInTheDocument()
    expect(auto()).toHaveAttribute('data-state', 'idle')
  })

  it('a card the reply raised stays inside it; Auto keeps listening, and answering it returns him to idle', async () => {
    await openAndSend([{ frames: [APPROVAL_PART], hold: true }])
    await waitFor(() => within(latest()).getByRole('region', { name: APPROVALS_LABEL }))
    await pressStop()
    expect(within(stoppedReply()).getByText(STOPPED_NOTICE)).toBeInTheDocument()
    const cards = within(stoppedReply()).getByRole('region', { name: APPROVALS_LABEL })
    expect(within(cards).getByText(TOOL_APPROVAL_TITLE)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: LOOSE_APPROVALS_LABEL })).toBeNull()
    await waitFor(() => expect(auto()).toHaveAttribute('data-state', 'listening'))
    expect(auto()).toHaveTextContent(AWAITING_ANSWER)

    await click(within(cards).getByRole('button', { name: /approve & run/i }))
    expect(host.cardActions()).toEqual([{ card: 'tool-approval', id: '42', action: 'approved' }])
    const answered = () => within(stoppedReply()).getByRole('region', { name: APPROVALS_LABEL })
    await waitFor(() => expect(within(answered()).getByRole('status')).toHaveTextContent(/the action ran/i))
    expect(within(answered()).queryByRole('button', { name: /approve & run/i })).toBeNull()
    await waitFor(() => expect(auto()).toHaveAttribute('data-state', 'idle'))
  })
})

describe('a card settled while the turn still runs', () => {
  it('returns Auto to the tool still running (its start was outranked by the card), then idle when it ends', async () => {
    const searchStart = dataPart('tool-start', { toolCallId: 't1', toolName: 'platform_web_search', input: { query: 'old brief' } })
    const searchEnd = dataPart('tool-end', { toolCallId: 't1', toolName: 'platform_web_search', success: true })
    await openAndSend([{ frames: [APPROVAL_PART, searchStart], hold: true }])
    await waitFor(() => within(latest()).getByRole('list', { name: TOOL_LINES_LABEL }))
    await waitFor(() => expect(auto()).toHaveAttribute('data-state', 'listening'))
    const writing = latest()
    await click(within(within(writing).getByRole('region', { name: APPROVALS_LABEL })).getByRole('button', { name: /deny/i }))
    expect(host.cardActions()).toEqual([{ card: 'tool-approval', id: '42', action: 'denied' }])
    await waitFor(() => expect(auto()).toHaveAttribute('data-state', 'searching'))
    act(() => host.continueHeldTurn({ frames: [searchEnd], hold: true }))
    await waitFor(() => expect(auto()).toHaveAttribute('data-state', 'idle'))
    act(() => host.continueHeldTurn({ frames: [] }))
    await screen.findByRole('button', { name: 'Send' })
    expect(auto()).toHaveAttribute('data-state', 'idle')
  })
})
