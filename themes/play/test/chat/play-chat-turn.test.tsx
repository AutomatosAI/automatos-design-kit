// PRD-260 §4 — a turn's details in Play's chat, on the host's chat controller. Moved from core's
// components/play/chat/__tests__/play-chat-turn.test.tsx (at 101a0bf33) and rewritten for the kit: the SDK is the
// harness's fake (packages/theme-harness), so what core's mocked chat hook handed Play (a reply's tool calls,
// receipts, Deliverables, failure, withdraw offer and tickets, a Mission suggestion part, a refused send) comes from
// recorded turns each send takes (host.setChatScript; a held turn goes on with host.continueHeldTurn), a stored
// reply's provenance or saved failure from the conversation the backend holds (host.setConversations), the spent
// trial from host.setTrial and the Mission being planned from host.setPlanningMissionId. The host's cards are the
// harness's stand-ins; the Mission card is wrapped to read the props Play gives it. Hello's first open is kept in the
// SDK's storage area (hello-played), not in core's sessionStorage key. Every assertion of what Play renders is kept.
// What the host's cards draw and do (the banner's words, Launch Mission's request, Withdraw's call, a ticket's
// Open on the board) and what the controller reads off a stored row are core's to prove, and the ledger names those
// tests (test/moved-from-core/chat.json). Auto himself is a stand-in that shows his state. Roles and text only.
import {
  type HostReceipt, type HostTaskCard, type MissionSuggestionCardProps, receiptLine, type WithdrawOffer, writeThemeState,
} from '@automatos/theme-sdk'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AutoMascotProps } from '../../src/components/mascot/auto-mascot.tsx'
import { STOPPED_NOTICE } from '../../src/components/play/chat/auto-reply.tsx'
import { DeliverableCard } from '../../src/components/play/chat/deliverable-card.tsx'
import { MARK_DONE, MARK_FAILED, MARK_MUTED, MARK_WAITING } from '../../src/components/play/chat/labels.ts'
import { PLACEHOLDER } from '../../src/components/play/chat/message-box.tsx'
import { MISSION_CREATED_LABEL, SUGGESTION_LABEL } from '../../src/components/play/chat/mission-suggestion.tsx'
import { PlayChat } from '../../src/components/play/chat/play-chat.tsx'
import {
  BADGE_DONE, BADGE_NOT_DONE, BADGE_SKIPPED, NO_ACTIONS, NOTHING_ON_THE_BOARD, RECEIPTS_TITLE, receiptBadge,
} from '../../src/components/play/chat/receipts.tsx'
import { TICKETS_LABEL } from '../../src/components/play/chat/reply-cards.tsx'
import { SNAG_TITLE, TRY_AGAIN, TURN_FAILED } from '../../src/components/play/chat/snag-box.tsx'
import { TOOL_LINES_LABEL } from '../../src/components/play/chat/tool-lines.tsx'
import { HELLO_KEY, HELLO_STATE } from '../../src/lib/mascot/session.ts'
import { CREDITS_EXHAUSTED_CODE, host, LIVE_KEY } from '@automatos/theme-harness/host'

/** Every MissionSuggestionCard Play drew, with its props, newest last. */
const seen = vi.hoisted(() => ({ suggestions: [] as readonly MissionSuggestionCardProps[] }))

// The host's Mission card is the harness's stand-in, wrapped to keep the props Play hands it.
vi.mock('@automatos/theme-sdk', async (importOriginal) => {
  const sdk = await importOriginal<typeof import('@automatos/theme-sdk')>()
  const { createElement } = await import('react')
  return {
    ...sdk,
    MissionSuggestionCard: (props: MissionSuggestionCardProps) => {
      seen.suggestions = [...seen.suggestions, props]
      return createElement(sdk.MissionSuggestionCard, props)
    },
  }
})

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
type StoredChat = Parameters<typeof host.setConversations>[0][number]
type StoredMessage = NonNullable<StoredChat['messages']>[number]

const UPDATED = '2026-10-14T09:00:00+00:00'
const QUESTION = 'Shortlist three laptops?'
/** What each test asks after the stored question. */
const ASKED = 'And now?'
/** The host's banner, as its protected surface names it (core's test reads its test id). */
const TRIAL_BANNER = 'trial-exhausted-banner'
/** The label a failed turn's stored row carries, which a reply never shows. */
const TURN_ERROR_LABEL = 'Error'
const BACKGROUND_LABEL = 'Auto · background'
const HELD: Turn = { frames: [], hold: true }
const REFUSED: Turn = { frames: [], status: 500 }
const OUT_OF_CREDITS: Turn = { frames: [], status: 402, body: `{"error_code": "${CREDITS_EXHAUSTED_CODE}"}` }

function receipt(fields: Partial<HostReceipt>): HostReceipt {
  return { action: 'platform_update_task', kind: 'write', status: 'done', subject: '', effect: '', link: null, reason: null, ...fields }
}

const words = (text: string): Frame => ({ text })
const dataPart = (type: string, data: unknown): Frame => ({ data: { type, data } })
const toolData = (data: unknown): Frame => dataPart('tool-data', data)
const receiptsPart = (receipts: readonly HostReceipt[]): Frame => toolData({ [LIVE_KEY]: { receipts, above: [] } })
const failure = (error: Readonly<Record<string, string>>): Frame => ({ error })
const toolStart = (toolCallId: string, toolName: string, input?: unknown): Frame => dataPart('tool-start', { toolCallId, toolName, input })
const toolEnd = (fields: Readonly<Record<string, unknown>>): Frame => dataPart('tool-end', fields)

/** The stored conversation c1 on screen through its ?chatId= link. */
function openChat(messages: readonly StoredMessage[] = [{ role: 'user', text: QUESTION }]) {
  host.setConversations([{ id: 'c1', title: 'Laptop for uni', updatedAt: UPDATED, preview: null, messages }])
  host.setSearchParams('chatId=c1')
}

/** The stored conversation on screen, its messages listed, with the turns its next sends take. */
async function renderChat(turns: readonly Turn[] = [], messages?: readonly StoredMessage[]) {
  openChat(messages)
  host.setChatScript(turns)
  const view = render(<PlayChat />)
  await screen.findByRole('list', { name: 'Conversation' })
  return view
}

/** Type into the message box and press Enter. */
function ask(text: string = ASKED) {
  const box = screen.getByRole('textbox', { name: PLACEHOLDER })
  fireEvent.change(box, { target: { value: text } })
  fireEvent.keyDown(box, { key: 'Enter' })
}

/** A turn's stream ends a tick after its last frame (the harness plays a frame per tick): let that tick pass. */
const streamEnds = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

const auto = () => screen.getByTestId('auto')
const reply = (): HTMLElement => {
  const replies = screen.getAllByRole('article', { name: 'Auto said' })
  return replies[replies.length - 1]
}

beforeEach(() => {
  host.reset()
  seen.suggestions = []
  writeThemeState(HELLO_KEY, true, HELLO_STATE) // hello already played this session
})

describe('tool lines', () => {
  const calls: readonly Frame[] = [
    toolStart('t1', 'platform_web_search'),
    toolEnd({ toolCallId: 't1', toolName: 'platform_web_search', success: true, summary: '3 results', durationMs: 2140 }),
    toolStart('t2', 'platform_send_email'),
    toolEnd({ toolCallId: 't2', toolName: 'platform_send_email', error: 'the mail server timed out' }),
    toolStart('t3', 'platform_update_agent'),
    toolEnd({ toolCallId: 't3', toolName: 'platform_update_agent', waiting: true, summary: 'card raised' }),
    toolStart('t4', 'platform_web_search', { query: 'budget laptops' }),
  ]
  const lines = () => within(within(reply()).getByRole('list', { name: TOOL_LINES_LABEL })).getAllByRole('listitem')

  it("renders the reply's tool calls as lines in their states: done, failed, waiting for you, running", async () => {
    await renderChat([{ frames: calls, hold: true }])
    ask()
    await waitFor(() => expect(lines()).toHaveLength(4))
    expect(lines().map((line) => line.textContent)).toEqual([
      // F12: Play's own time, one decimal, as in the approved design ('2.1 s', not the core's '2 s').
      '✓Searched the web · 3 results · 2.1 s',
      "✕Send email didn't work · the mail server timed out",
      '…Waiting for you · card raised',
      "Searching the web: 'budget laptops'",
    ])
  })

  it('a call still running on a finished reply reads as stopped, never a spinner forever', async () => {
    await renderChat([{ frames: [toolStart('t4', 'platform_web_search', { query: 'budget laptops' }), words('Here is what I found.')] }])
    ask()
    await waitFor(() => expect(within(reply()).getByRole('list', { name: TOOL_LINES_LABEL })).toHaveTextContent('Stopped: searching the web'))
  })
})

describe('receipts', () => {
  const done = receipt({ subject: '#0422', effect: 'moved to Done', link: '/activity?ticket=422' })
  const refused = receipt({ action: 'platform_send_email', status: 'refused', subject: 'Letter to Maya', reason: 'no mail connection' })
  const section = () => within(reply()).getByRole('region', { name: RECEIPTS_TITLE })

  it("render in receiptLine's words, a done one linked to its page", async () => {
    await renderChat([{ frames: [receiptsPart([done, refused]), words('Done.')] }])
    ask()
    const shown = await waitFor(section)
    const items = within(shown).getAllByRole('listitem')
    // The mark, the line in receiptLine's words, then Play's tag (P260-FX-14).
    expect(items.map((item) => item.textContent)).toEqual([
      `${MARK_DONE}${receiptLine(done)}${BADGE_DONE}`,
      `${MARK_FAILED}${receiptLine(refused)}${BADGE_NOT_DONE}`,
    ])
    expect(within(items[0]).getByRole('link', { name: receiptLine(done) })).toHaveAttribute('href', '/activity?ticket=422')
    expect(within(items[1]).queryByRole('link')).toBeNull()
    expect(shown).not.toHaveTextContent(NOTHING_ON_THE_BOARD)
  })

  it("tags a done write 'Done' beside its line, a refused one 'Not done', a skipped one 'Skipped'; a done read and a waiting ask have none (P260-FX-14)", async () => {
    const read = receipt({ kind: 'read', subject: 'Brief', effect: 'looked up' })
    const skipped = receipt({ status: 'skipped', subject: 'Draft to Sam', reason: 'nothing to send' })
    const waiting = receipt({ status: 'waiting', effect: "card raised: change an agent 'Scout'" })
    await renderChat([{ frames: [receiptsPart([done, read, refused, skipped, waiting]), words('Done.')] }])
    ask()
    const [doneItem, readItem, refusedItem, skippedItem, waitingItem] = within(await waitFor(section)).getAllByRole('listitem')
    // Beside its line: the tag is the element right after the line's link, inside the same item.
    const tag = within(doneItem).getByText(BADGE_DONE)
    expect(tag.previousElementSibling).toBe(within(doneItem).getByRole('link', { name: receiptLine(done) }))
    expect(readItem.textContent).toBe(`${MARK_DONE}${receiptLine(read)}`)
    expect(within(refusedItem).getByText(BADGE_NOT_DONE).previousElementSibling).toHaveTextContent(receiptLine(refused))
    expect(skippedItem.textContent).toBe(`${MARK_MUTED}${receiptLine(skipped)}${BADGE_SKIPPED}`)
    expect(waitingItem.textContent).toBe(`${MARK_WAITING}${receiptLine(waiting)}`)
  })

  it('receiptBadge is the tag alone: Done only for a done write', () => {
    expect(receiptBadge(receipt({}))).toBe(BADGE_DONE)
    expect(receiptBadge(receipt({ kind: 'read' }))).toBeNull()
    expect(receiptBadge(receipt({ kind: 'read', status: 'refused' }))).toBe(BADGE_NOT_DONE)
    expect(receiptBadge(receipt({ status: 'skipped' }))).toBe(BADGE_SKIPPED)
    expect(receiptBadge(receipt({ status: 'waiting' }))).toBeNull()
  })

  it('a turn that ran nothing says so; one that moved nothing on the board says that', async () => {
    const read = receipt({ kind: 'read', subject: 'Brief', effect: 'looked up' })
    await renderChat([{ frames: [receiptsPart([]), words('Hi.')] }, { frames: [receiptsPart([read]), words('Read it.')] }])
    ask('Hi?')
    await screen.findByRole('button', { name: 'Send' })
    ask()
    await waitFor(() => expect(screen.getAllByRole('region', { name: RECEIPTS_TITLE })).toHaveLength(2))
    const [first, second] = screen.getAllByRole('region', { name: RECEIPTS_TITLE })
    expect(first).toHaveTextContent(NO_ACTIONS)
    expect(second).toHaveTextContent(NOTHING_ON_THE_BOARD)
  })

  it('a done receipt makes Auto celebrate once the turn finishes, not before', async () => {
    await renderChat([{ frames: [receiptsPart([done])], hold: true }])
    ask()
    await waitFor(section)
    expect(auto()).not.toHaveAttribute('data-state', 'celebrate')
    act(() => host.continueHeldTurn({ frames: [] }))
    await waitFor(() => expect(auto()).toHaveAttribute('data-state', 'celebrate'))
  })

  it('Stop after a done receipt ends the turn, and the stopped turn does not celebrate (P260-FX-04)', async () => {
    await renderChat([{ frames: [receiptsPart([done])], hold: true }])
    ask()
    await waitFor(section)
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(within(reply()).getByText(STOPPED_NOTICE)).toBeInTheDocument()
    expect(auto()).not.toHaveAttribute('data-state', 'celebrate')
    expect(auto()).toHaveAttribute('data-state', 'idle')
  })
})

describe('the Deliverable card', () => {
  it('a generated_document tool-data part renders the card, opening /deliverables?deliverable=<id>, and Auto celebrates', async () => {
    await renderChat([{ frames: [toolData({ generated_document: { deliverable_id: 'd-42', title: 'Laptop shortlist', format: 'pdf' } })], hold: true }])
    ask()
    const card = await waitFor(() => within(reply()).getByRole('article', { name: 'Deliverable: Laptop shortlist' }))
    expect(within(card).getByRole('link', { name: 'Open Laptop shortlist' })).toHaveAttribute('href', '/deliverables?deliverable=d-42')
    expect(card).toHaveTextContent('Document · just now')
    await waitFor(() => expect(auto()).toHaveAttribute('data-state', 'celebrate'))
  })

  it('a bad id renders no link', async () => {
    await renderChat([{ frames: [toolData({ generated_document: { deliverable_id: '../../admin?x=1', title: 'Sneaky' } }), words('Here.')], hold: true }])
    ask()
    await waitFor(() => expect(reply()).toHaveTextContent('Here.'))
    expect(within(reply()).queryByRole('link')).toBeNull()
    expect(screen.queryByRole('article', { name: 'Deliverable: Sneaky' })).toBeNull()
    render(<DeliverableCard deliverable={{ id: 'a b/../c', title: 'Odd', kind: 'document' }} />)
    const odd = screen.getByRole('article', { name: 'Deliverable: Odd' })
    expect(within(odd).queryByRole('link')).toBeNull()
  })

  // The card links the core's page relatively, never the receipt's own link (the host reads the core's absolute
  // open_url into the same id: the ledger).
  it("a done receipt that links a Deliverable renders its card, opening the core's page", async () => {
    const linked = receipt({ action: 'generate_document', subject: 'Budget memo', effect: 'made', link: '/deliverables?tab=outputs&deliverable=d-7' })
    await renderChat([{ frames: [receiptsPart([linked]), words('Made it.')] }])
    ask()
    const card = await waitFor(() => within(reply()).getByRole('article', { name: 'Deliverable: Budget memo' }))
    expect(within(card).getByRole('link', { name: 'Open Budget memo' })).toHaveAttribute('href', '/deliverables?deliverable=d-7')
  })
})

describe('the snag box', () => {
  it("a reply that failed shows Play's snag box; Try again asks the chat again, and Auto plays oops", async () => {
    await renderChat([{ frames: [failure({ message: 'The model took too long to answer.', code: 'timeout' })] }, HELD])
    ask()
    const snag = await waitFor(() => within(reply()).getByRole('region', { name: SNAG_TITLE }))
    expect(snag).toHaveTextContent('The model took too long to answer.')
    await waitFor(() => expect(auto()).toHaveAttribute('data-state', 'oops'))
    await streamEnds()
    fireEvent.click(within(snag).getByRole('button', { name: TRY_AGAIN }))
    expect(host.chatSent()).toEqual([{ chatId: 'c1', text: ASKED, retry: false }, { chatId: 'c1', text: ASKED, retry: true }])
  })

  it("a turn that failed before Auto's reply began (status 'error') shows the snag box under the conversation", async () => {
    await renderChat([REFUSED, HELD])
    ask()
    const snag = await screen.findByRole('region', { name: SNAG_TITLE })
    expect(snag).toHaveTextContent(TURN_FAILED)
    await waitFor(() => expect(auto()).toHaveAttribute('data-state', 'oops'))
    fireEvent.click(within(snag).getByRole('button', { name: TRY_AGAIN }))
    expect(host.chatSent().map((sent) => sent.retry)).toEqual([false, true])
  })

  it('a failed turn the server saved shows the snag box with its words and Try again, never as an answer (M29)', async () => {
    await renderChat([HELD], [
      { role: 'user', text: QUESTION },
      { role: 'assistant', text: '⚠️ The model is unavailable', savedError: 'The model is unavailable' },
    ])
    const saved = reply()
    const snag = within(saved).getByRole('region', { name: SNAG_TITLE })
    expect(snag).toHaveTextContent('The model is unavailable')
    expect(within(saved).getAllByText(/The model is unavailable/)).toHaveLength(1)
    expect(saved).not.toHaveTextContent('⚠')
    expect(within(saved).queryByText(TURN_ERROR_LABEL)).toBeNull()
    fireEvent.click(within(snag).getByRole('button', { name: TRY_AGAIN }))
    expect(host.chatSent()).toEqual([{ chatId: 'c1', text: QUESTION, retry: true }])
  })

  it('Try again by keyboard moves focus to the message box as the snag box goes, never to <body> (M20)', async () => {
    await renderChat([REFUSED, HELD])
    ask()
    const retry = within(await screen.findByRole('region', { name: SNAG_TITLE })).getByRole('button', { name: TRY_AGAIN })
    retry.focus()
    fireEvent.click(retry)
    expect(host.chatSent().map((sent) => sent.retry)).toEqual([false, true])
    // The chat answers again: the failed turn, and its snag box with Try again, are gone.
    expect(screen.queryByRole('region', { name: SNAG_TITLE })).toBeNull()
    expect(screen.getByRole('textbox', { name: PLACEHOLDER })).toHaveFocus()
    expect(document.activeElement).not.toBe(document.body)
  })

  it('only the newest reply gets Try again', async () => {
    const failed: Turn = { frames: [failure({ message: 'It failed.' })] }
    await renderChat([failed, failed])
    ask()
    await waitFor(() => expect(screen.getAllByRole('region', { name: SNAG_TITLE })).toHaveLength(1))
    await streamEnds()
    ask('Again?')
    await waitFor(() => expect(screen.getAllByRole('region', { name: SNAG_TITLE })).toHaveLength(2))
    const snags = screen.getAllByRole('region', { name: SNAG_TITLE })
    expect(within(snags[0]).queryByRole('button', { name: TRY_AGAIN })).toBeNull()
    expect(within(snags[1]).getByRole('button', { name: TRY_AGAIN })).toBeInTheDocument()
  })
})

describe('a reply posted in the background (M29)', () => {
  it("shows who wrote it under Auto's name, as Studio's badge does; a reply of the turn shows none", async () => {
    await renderChat([], [
      { role: 'user', text: QUESTION },
      { role: 'assistant', text: 'Here is the shortlist.' },
      { role: 'user', text: 'Watch the render for me?' },
      { role: 'assistant', text: 'Watched it. 8.4/10, passed.', provenance: BACKGROUND_LABEL },
    ])
    const [turn, posted] = screen.getAllByRole('article', { name: 'Auto said' })
    expect(within(posted).getByText(BACKGROUND_LABEL)).toBeInTheDocument()
    expect(posted).toHaveTextContent('Watched it. 8.4/10, passed.')
    expect(within(posted).queryByRole('region', { name: SNAG_TITLE })).toBeNull()
    expect(within(turn).queryByText(BACKGROUND_LABEL)).toBeNull()
  })
})

describe('used-up credits (PRD-265)', () => {
  it("credits_exhausted renders the core's TrialExhaustedBanner, not a snag", async () => {
    await renderChat([OUT_OF_CREDITS])
    ask()
    expect(await screen.findByRole('alert')).toHaveAttribute('data-protected-surface', TRIAL_BANNER)
    expect(screen.queryByRole('region', { name: SNAG_TITLE })).toBeNull()
  })

  it('a reply refused mid-stream for credits shows the banner instead of its snag box', async () => {
    await renderChat([{ frames: [failure({ message: 'Credits used up.', code: CREDITS_EXHAUSTED_CODE })] }])
    ask()
    expect(await screen.findByRole('alert')).toHaveAttribute('data-protected-surface', TRIAL_BANNER)
    expect(screen.queryByRole('region', { name: SNAG_TITLE })).toBeNull()
  })

  it('a paused balance shows the banner before anything is sent; with no spent trial (own keys) it does not', async () => {
    host.setTrial({ state: 'exhausted', grantedUsd: 1, spentUsd: 1 })
    const view = await renderChat()
    expect(screen.getByRole('alert')).toHaveAttribute('data-protected-surface', TRIAL_BANNER)
    view.unmount()

    host.setTrial(null)
    await renderChat()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('a Mission suggestion', () => {
  const goal = 'Research ten competitors and compare pricing'
  const suggestion = dataPart('mission-suggestion', { goal, complexity: 'organ', agent_id: 3 })
  const card = () => screen.getByRole('region', { name: SUGGESTION_LABEL })

  it("a mission-suggestion part renders the core's MissionSuggestionCard with the goal, once the turn is over", async () => {
    openChat([])
    host.setChatScript([{ frames: [suggestion, words('That is a big one.')], hold: true }])
    render(<PlayChat />)
    ask(QUESTION)
    await waitFor(() => expect(reply()).toHaveTextContent('That is a big one.'))
    expect(screen.queryByRole('region', { name: SUGGESTION_LABEL })).toBeNull()
    act(() => host.continueHeldTurn({ frames: [] }))
    expect(await waitFor(card)).toHaveTextContent(goal)
    // What the host's card launches the Mission with: the goal, the conversation and its recent words.
    const recentMessages = [{ role: 'user', content: QUESTION }, { role: 'assistant', content: 'That is a big one.' }]
    expect(seen.suggestions.at(-1)).toEqual({ goal, complexity: 'organ', agentId: 3, chatId: 'c1', recentMessages })
  })

  it('respects the planning gate: a Mission being planned shows its card instead', async () => {
    await renderChat([{ frames: [suggestion, words('That is a big one.')] }])
    ask()
    await waitFor(card)
    act(() => host.setPlanningMissionId('mission-1'))
    expect(screen.queryByRole('region', { name: SUGGESTION_LABEL })).toBeNull()
    expect(screen.getByRole('region', { name: MISSION_CREATED_LABEL })).toBeInTheDocument()
  })

  it('a new message clears the suggestion, as chat.tsx does', async () => {
    await renderChat([{ frames: [suggestion, words('That is a big one.')] }, HELD])
    ask()
    await waitFor(card)
    const box = screen.getByRole('textbox')
    fireEvent.change(box, { target: { value: 'No, just a quick answer' } })
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(host.chatSent().map((sent) => sent.text)).toEqual([ASKED, 'No, just a quick answer'])
    expect(screen.queryByRole('region', { name: SUGGESTION_LABEL })).toBeNull()
  })
})

describe("the core's withdraw offer and ticket cards (P260-FX-29, F091-C2)", () => {
  const OFFER: WithdrawOffer = {
    message: 'You said no — withdraw the request still waiting for your yes?',
    requests: [{ grant_id: 7, action: 'platform_delete_document', reason: "Delete 'christmas-box-2026.csv'" }],
  }
  const ticket = (fields: Partial<HostTaskCard>): HostTaskCard => ({
    id: 92, number: '#0042', title: 'Write the landing page', status: 'in_progress', assigned_agent: 'Bob', ...fields,
  })
  const WITHDRAW_GROUP = { name: 'Withdraw request' }
  const TICKET = { name: /^Task / }

  it("a live reply carrying a withdraw offer shows it; Withdraw goes to the host's card and the offer reads withdrawn", async () => {
    await renderChat([{ frames: [words("Understood, I won't delete it."), dataPart('withdraw_offer', OFFER)], hold: true }])
    ask()
    const offer = await waitFor(() => within(reply()).getByRole('group', WITHDRAW_GROUP))
    expect(offer).toHaveTextContent(OFFER.message)
    expect(offer).toHaveTextContent('platform_delete_document')
    fireEvent.click(within(offer).getByRole('button', { name: 'Withdraw' }))
    expect(host.cardActions()).toEqual([{ card: 'withdraw-offer', id: '7', action: 'withdrawn' }])
    expect(await within(offer).findByText('Withdrawn.')).toBeInTheDocument()
    expect(within(offer).queryByRole('button', { name: 'Withdraw' })).toBeNull()
  })

  it("each reply's tickets render the core's TaskCard in that reply", async () => {
    const first = ticket({ id: 118, number: '#0043', title: 'Chat with Bob: Hey Bob', status: 'assigned' })
    await renderChat([{ frames: [toolData({ task_card: first }), words('Bob has it.')] }, { frames: [toolData({ task_card: ticket({}) }), words('Filed it.')] }])
    ask()
    await screen.findByRole('button', { name: 'Send' })
    ask('And the landing page?')
    await waitFor(() => expect(screen.getAllByRole('region', { name: TICKETS_LABEL })).toHaveLength(2))
    const [bob, landing] = screen.getAllByRole('region', { name: TICKETS_LABEL })
    expect(within(bob).getByRole('article', { name: 'Task #0043' })).toHaveTextContent('Chat with Bob: Hey Bob')
    expect(within(landing).getByRole('article', { name: 'Task #0042' })).toHaveTextContent('Write the landing page')
  })

  it('a reply without either shows neither, beside one that carries both (one card per ticket)', async () => {
    const both: Turn = {
      frames: [toolData({ task_card: ticket({ status: 'assigned' }) }), toolData({ task_card: ticket({}) }), dataPart('withdraw_offer', OFFER), words('Filed it.')],
    }
    await renderChat([{ frames: [words('Hi.')] }, both])
    ask('Hi?')
    await screen.findByRole('button', { name: 'Send' })
    ask('File the landing page?')
    await waitFor(() => expect(reply()).toHaveTextContent('Filed it.'))
    const [plain, carrying] = screen.getAllByRole('article', { name: 'Auto said' })
    expect(within(plain).queryByRole('group', WITHDRAW_GROUP)).toBeNull()
    expect(within(plain).queryByRole('region', { name: TICKETS_LABEL })).toBeNull()
    expect(within(plain).queryAllByRole('article', TICKET)).toHaveLength(0)
    expect(within(carrying).getByRole('group', WITHDRAW_GROUP)).toBeInTheDocument()
    expect(within(carrying).getAllByRole('article', TICKET)).toHaveLength(1)
  })
})
