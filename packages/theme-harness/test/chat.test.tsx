/**
 * PRD-261 B-02c: the fake chat area (src/sdk/chat.ts) over recorded turns (fixtures/streams/*.json, core's
 * play-parity chat-turns.json format). A small chat screen is built the way Play's is: useChatController() for the
 * conversation on screen, then useChatController(conversation) in a child keyed by conversation.key. The host state
 * the fake reads (src/internal/scripted/host-inputs.ts: the health, the query string, the router) is set here
 * through a mock of that one module, so these tests need none of the host's controls.
 */
import type {
  HostChatController, HostChatConversation, HostChatDraftLink, HostChatOnScreen, HostChatTurnEvent, HostConversationListState,
  HostReceipt, MissionApprovalData, ToolApprovalData,
} from '@automatos/theme-sdk'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { Component, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import conversationsFixture from '../fixtures/conversations/list.json'
import detailsFixture from '../fixtures/streams/details.json'
import turnsFixture from '../fixtures/streams/turns.json'
import { MISSION_APPROVAL_TITLE, TOOL_APPROVAL_TITLE } from '../src/internal/scripted/approvals.ts'
import { cardsControls, MissionApproval, resetCards, ToolApproval } from '../src/sdk/cards.ts'
import { APPROVE_LABEL, APPROVED_LINE, REJECT_LABEL } from '../src/sdk/cards/approvals.tsx'
import {
  chatControls, liveReceiptsOf, movedSomethingOnTheBoard, receiptLine, receiptLink, resetChat, useChatController, useConversationList,
  useRecentChats, useStartChat,
} from '../src/sdk/chat.ts'

const { chatSent, conversationsOf, recordedTurns, scriptOf, setAiLabelShown, setChatScript, setConversations, startedChats, turnsLeft } =
  chatControls
const { cardActions } = cardsControls

const inputs = vi.hoisted(() => ({ connection: 'connected' as 'connected' | 'down', query: '', push: vi.fn() }))

vi.mock('../src/internal/scripted/host-inputs.ts', async () => {
  const { useMemo } = await import('react')
  const router = { push: inputs.push, replace: vi.fn(), back: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }
  return {
    CHAT_HREF: '/chat',
    useHealth: () => ({ connection: inputs.connection, checking: false, check: () => undefined }),
    useHostSearchParams: () => {
      const query = inputs.query
      return useMemo(() => new URLSearchParams(query), [query])
    },
    useHostRouter: () => router,
    useWorkspace: () => ({ workspace: null, isLoading: false }),
    useEdition: () => 'local',
    useTrial: () => null,
  }
})

const TURNS = recordedTurns(turnsFixture, 'streams/turns.json')
const DETAILS = recordedTurns(detailsFixture, 'streams/details.json')
const CONVERSATIONS = conversationsOf(conversationsFixture, 'conversations/list.json')
const WORDS = 'Compare these laptops'
const ANSWER = 'Here is your laptop shortlist.'
const HELD = 'I am still writing the comparison'

interface ChatProps {
  readonly onView: (chat: HostChatController) => void
  readonly onEvent?: (event: HostChatTurnEvent) => void
  readonly onData?: (part: unknown) => void
  readonly onSent?: (accepted: boolean) => void
}

/** Shows the error a child threw while rendering, as an alert. */
class Caught extends Component<{ readonly children: ReactNode }, { readonly error: Error | null }> {
  override state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  override render() {
    return this.state.error === null ? this.props.children : <p role="alert">{this.state.error.message}</p>
  }
}

/** The cards a reply raised, and the loose ones after the conversation, placed as Play places them. */
function Approvals({ chat }: { readonly chat: HostChatController }) {
  const all = [...chat.messages.flatMap((message) => message.approvals), ...chat.looseApprovals]
  return (
    <>
      {all.map((approval) =>
        approval.kind === 'tool' ? (
          <ToolApproval key={approval.key} data={approval.data as ToolApprovalData} onDecided={() => approval.answered()} onClose={approval.closed} />
        ) : (
          <MissionApproval key={approval.key} data={approval.data as MissionApprovalData} onClose={approval.closed} />
        ),
      )}
    </>
  )
}

function Conversation({ conversation, onView, onEvent, onData, onSent }: ChatProps & { readonly conversation: HostChatConversation }) {
  const chat = useChatController(conversation, { onEvent, onData })
  onView(chat)
  return (
    <main>
      <ol aria-label="Messages">
        {chat.messages.map((message) => (
          <li key={message.id}>{message.text}</li>
        ))}
      </ol>
      <Approvals chat={chat} />
      <button type="button" onClick={() => onSent?.(chat.send(WORDS))}>Send</button>
      <button type="button" onClick={() => onSent?.(chat.retry())}>Try again</button>
      <button type="button" onClick={chat.stop}>Stop</button>
    </main>
  )
}

function ChatScreen(props: ChatProps) {
  const { conversation } = useChatController()
  return conversation === null ? null : <Conversation key={conversation.key} conversation={conversation} {...props} />
}

const NewChatButton = () => <button type="button" onClick={useStartChat().startChat}>New chat</button>

function renderChat(props: Partial<Omit<ChatProps, 'onView'>> = {}) {
  const onView = vi.fn<(chat: HostChatController) => void>()
  render(
    <>
      <ChatScreen onView={onView} {...props} />
      <NewChatButton />
    </>,
  )
  const chat = (): HostChatController => {
    const last = onView.mock.lastCall?.[0]
    if (last === undefined) throw new Error('The chat screen has not rendered.')
    return last
  }
  return { chat }
}

const click = (name: string): void => {
  fireEvent.click(screen.getByRole('button', { name }))
}

beforeEach(() => {
  vi.restoreAllMocks()
  resetChat()
  resetCards()
  inputs.connection = 'connected'
  inputs.query = ''
  inputs.push.mockReset()
})

describe('useChatController: a recorded turn', () => {
  it('streams the deltas into the reply being written, then ends idle, the new chat named by the backend', async () => {
    setChatScript(scriptOf(TURNS, ['answer']))
    const { chat } = renderChat()
    click('Send')
    expect(chat()).toMatchObject({ status: 'streaming', streaming: true })
    expect(chat().messages.map((message) => [message.role, message.text, message.writing])).toEqual([
      ['user', WORDS, false],
      ['assistant', '', true],
    ])
    await waitFor(() => expect(chat().status).toBe('idle'))
    expect(chat().messages[1]).toMatchObject({ text: ANSWER, writing: false, stopped: false, error: null })
    expect(chat().conversation.chatId).toBe('harness-chat')
    expect(chat().title).toBe(WORDS)
  })

  it('shows the words while the reply is written; Stop keeps them as stopped and ends the turn (P260-FX-30)', async () => {
    setChatScript(scriptOf(TURNS, ['partial', 'answer']))
    const { chat } = renderChat()
    click('Send')
    await screen.findByText(HELD)
    expect(chat()).toMatchObject({ status: 'streaming', streaming: true })
    expect(chat().messages[1]).toMatchObject({ text: HELD, writing: true, stopped: false })
    click('Stop')
    expect(chat()).toMatchObject({ status: 'idle', streaming: false })
    expect(chat().messages[1]).toMatchObject({ text: HELD, writing: false, stopped: true })
    click('Send')
    await waitFor(() => expect(chat().status).toBe('idle'))
    expect(chat().messages.map((message) => message.text)).toEqual([WORDS, HELD, WORDS, ANSWER])
    expect(chat().messages.map((message) => message.stopped)).toEqual([false, true, false, false])
  })

  it('Try again sends the owner\'s last message again after a refused request', async () => {
    setChatScript(scriptOf(TURNS, ['refused', 'answer']))
    const { chat } = renderChat()
    click('Send')
    await waitFor(() => expect(chat().status).toBe('error'))
    expect(chat().messages.map((message) => message.role)).toEqual(['user'])
    click('Try again')
    await waitFor(() => expect(chat().status).toBe('idle'))
    expect(chat().messages.map((message) => [message.role, message.text])).toEqual([['user', WORDS], ['assistant', ANSWER]])
    expect(chatSent()).toEqual([
      { chatId: null, text: WORDS, retry: false },
      { chatId: null, text: WORDS, retry: true },
    ])
  })

  it('files the approvals a reply raised; they resolve through the ToolApproval and MissionApproval stand-ins', async () => {
    const onEvent = vi.fn<(event: HostChatTurnEvent) => void>()
    setChatScript(scriptOf(TURNS, ['approvals']))
    const { chat } = renderChat({ onEvent })
    click('Send')
    const tool = await screen.findByRole('region', { name: TOOL_APPROVAL_TITLE })
    await waitFor(() => expect(chat().status).toBe('idle'))
    expect(chat().approvalWaiting).toBe(true)
    expect(chat().messages[1]?.approvals.map((card) => [card.kind, card.status, card.chatId])).toEqual([
      ['tool', 'waiting', 'harness-chat'],
      ['mission', 'waiting', 'harness-chat'],
    ])
    expect(onEvent).toHaveBeenCalledWith({ type: 'approval-waiting' })
    fireEvent.click(within(tool).getByRole('button', { name: APPROVE_LABEL }))
    expect(within(tool).getByRole('status')).toHaveTextContent(APPROVED_LINE)
    expect(chat().messages[1]?.approvals.map((card) => card.status)).toEqual(['answered', 'waiting'])
    const mission = screen.getByRole('region', { name: MISSION_APPROVAL_TITLE })
    fireEvent.click(within(mission).getByRole('button', { name: REJECT_LABEL }))
    expect(screen.queryByRole('region', { name: MISSION_APPROVAL_TITLE })).toBeNull()
    expect(chat().approvalWaiting).toBe(false)
    expect(onEvent).toHaveBeenLastCalledWith({ type: 'approval-settled' })
    expect(cardActions()).toEqual([
      { card: 'tool-approval', id: '26101', action: 'approved' },
      { card: 'mission-approval', id: 'harness-mission-1', action: 'rejected' },
    ])
  })

  it('starts nothing while a turn runs, or while the host\'s AI label is off screen (PRD-264 EUAI-11b)', async () => {
    const onSent = vi.fn<(accepted: boolean) => void>()
    setChatScript(scriptOf(TURNS, ['partial']))
    renderChat({ onSent })
    setAiLabelShown(false)
    click('Send')
    setAiLabelShown(true)
    click('Send')
    click('Send')
    click('Try again')
    expect(onSent.mock.calls).toEqual([[false], [true], [false], [false]])
    expect(chatSent()).toHaveLength(1)
    await screen.findByText(HELD)
  })
})

describe('useChatController: failures', () => {
  it('reads a request refused for used-up credits as trialExhausted', async () => {
    setChatScript(scriptOf(TURNS, ['outOfCredits']))
    const { chat } = renderChat()
    click('Send')
    await waitFor(() => expect(chat().status).toBe('error'))
    expect(chat()).toMatchObject({ errorCode: 'credits_exhausted', trialExhausted: true })
  })

  it('keeps a reply that failed in words, and tells turn-failed once with its code', async () => {
    const onEvent = vi.fn<(event: HostChatTurnEvent) => void>()
    setChatScript(scriptOf(DETAILS, ['failed']))
    const { chat } = renderChat({ onEvent })
    click('Send')
    await waitFor(() => expect(chat().status).toBe('idle'))
    expect(chat().messages[1]).toMatchObject({ text: 'Let me check', error: { message: 'The model did not answer in time.', code: 'model_timeout' } })
    expect(onEvent.mock.calls.filter(([event]) => event.type === 'turn-failed')).toEqual([[{ type: 'turn-failed', code: 'model_timeout' }]])
  })

  it('fails a send while the backend is down, as a fetch that cannot connect, and takes no turn', async () => {
    setChatScript(scriptOf(TURNS, ['answer']))
    inputs.connection = 'down'
    const { chat } = renderChat()
    click('Send')
    await waitFor(() => expect(chat().status).toBe('error'))
    expect(chat().messages.map((message) => message.role)).toEqual(['user'])
    expect(chat().errorCode).toBeNull()
    expect(turnsLeft()).toBe(1)
  })
})

describe('useChatController: what else a reply carries', () => {
  it('reads tool calls, receipts, Deliverables, a task card, thinking, a withdraw offer, a cap and a suggestion', async () => {
    const onData = vi.fn<(part: unknown) => void>()
    const onEvent = vi.fn<(event: HostChatTurnEvent) => void>()
    const names = ['tools', 'receipts', 'document', 'taskCard', 'thinking', 'withdraw', 'limit', 'suggestion']
    setChatScript(scriptOf(DETAILS, names))
    const { chat } = renderChat({ onData, onEvent })
    for (const _name of names) {
      click('Send')
      await waitFor(() => expect(chat().status).toBe('idle'))
    }
    const [tools, receipts, made, task, thinking, withdraw, limit] = chat().messages.filter((message) => message.role === 'assistant')
    expect(tools?.toolCalls.map((call) => [call.toolCallId, call.state, call.waiting])).toEqual([['call-1', 'completed', false], ['call-2', 'completed', true]])
    expect(tools?.toolCalls[0]).toMatchObject({ summary: '3 documents found', durationMs: 420, input: { query: 'laptops' } })
    expect(tools?.activity).toEqual(['Reading three reviews'])
    expect(receipts?.receipts?.map((receipt) => receiptLine(receipt))).toEqual([
      '#0422: moved to Done',
      'Laptop shortlist: saved',
      'Weekly update: tried, refused: no account connected',
    ])
    expect(receipts?.above).toEqual(['One write was refused.'])
    expect(receipts?.linkedDeliverables).toEqual([{ id: 'd-report-1', title: 'Laptop shortlist', kind: 'document' }])
    expect(made?.deliverables).toEqual([{ id: 'd-report-1', title: 'Laptop shortlist', kind: 'document' }])
    expect(task?.taskCards.map((card) => [card.number, card.title])).toEqual([['#0422', 'Compare laptops']])
    expect(thinking?.reasoningChars).toBe('Comparing battery life'.length)
    expect(withdraw?.withdrawOffer?.requests).toEqual([{ grant_id: 26102, action: 'platform_delete_document', reason: 'You said no' }])
    expect(limit?.limitReached).toBe('This turn reached its limit of 25 tool calls.')
    expect(chat().suggestion).toEqual({ goal: 'Research and buy a laptop', complexity: 'medium', agentId: 7 })
    const forwarded = onData.mock.calls.map(([part]) => (part as { readonly type: string }).type)
    expect(forwarded).toEqual(['tool-start', 'tool-end', 'tool-start', 'tool-end', 'tool-data', 'tool-data', 'tool-data', 'mission-suggestion'])
    expect(onEvent.mock.calls.filter(([event]) => event.type === 'deliverable-added')).toHaveLength(1)
  })
})

describe('useChatController: the conversation on screen', () => {
  it('opens a ?chatId= link to a conversation the backend holds, with its messages; New chat shows a fresh one', () => {
    setConversations(CONVERSATIONS)
    inputs.query = 'chatId=harness-chat-laptops'
    const { chat } = renderChat()
    expect(chat().conversation).toMatchObject({ chatId: 'harness-chat-laptops', title: 'Laptop shortlist' })
    expect(chat().messages.map((message) => message.text)).toEqual(['Help me pick a laptop', ANSWER])
    click('New chat')
    expect(startedChats()).toBe(1)
    expect(inputs.push).toHaveBeenCalledWith('/chat')
    expect(chat().conversation).toMatchObject({ chatId: null, title: null })
    expect(chat()).toMatchObject({ title: 'New chat', messages: [] })
  })

  it('reads a theme\'s draft link into a draft until the screen takes it', () => {
    const link: HostChatDraftLink = { param: 'draft', read: (params) => params?.get('draft') ?? null }
    const onScreen = vi.fn<(view: HostChatOnScreen) => void>()
    function DraftScreen() {
      const view = useChatController({ draftLink: link })
      onScreen(view)
      return <button type="button" onClick={view.takeDraft}>Take</button>
    }
    inputs.query = 'draft=Compare%20laptops'
    render(<DraftScreen />)
    expect(onScreen.mock.lastCall?.[0].draft).toEqual({ text: 'Compare laptops', serial: 1 })
    click('Take')
    expect(onScreen.mock.lastCall?.[0].draft).toBeNull()
  })

  it('opens only a conversation it handed out, and refuses a component that switches the way it calls', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const forged: HostChatConversation = { key: 'made-up', chatId: null, title: null }
    function Forged() {
      useChatController(forged)
      return null
    }
    render(<Caught><Forged /></Caught>)
    expect(screen.getByRole('alert')).toHaveTextContent('opens only a conversation that useChatController() handed out')
    const handed = vi.fn<(conversation: HostChatConversation | null) => void>()
    function OnScreen() {
      handed(useChatController().conversation)
      return null
    }
    render(<OnScreen />)
    const conversation = handed.mock.lastCall?.[0] ?? null
    function Switcher({ open }: { readonly open: HostChatConversation | null }) {
      if (open === null) useChatController()
      else useChatController(open)
      return null
    }
    const { rerender } = render(<Caught><Switcher open={null} /></Caught>)
    rerender(<Caught><Switcher open={conversation} /></Caught>)
    const alerts = screen.getAllByRole('alert')
    expect(alerts[alerts.length - 1]).toHaveTextContent('for the life of a component')
  })
})

describe('the lists, New chat and the receipts', () => {
  it('lists the conversations newest first, at most the limit; fails while the backend is down, and Retry asks again', async () => {
    const onList = vi.fn<(list: HostConversationListState) => void>()
    const onRecent = vi.fn<(chats: readonly string[], active: string | null) => void>()
    function Lists() {
      const list = useConversationList(2)
      const recent = useRecentChats()
      onList(list)
      onRecent(recent.chats.map((summary) => summary.id), recent.activeChatId)
      return list.status === 'failed' ? <button type="button" onClick={list.retry}>Retry</button> : null
    }
    setConversations(CONVERSATIONS)
    inputs.connection = 'down'
    render(<Lists />)
    expect(onList.mock.lastCall?.[0].status).toBe('loading')
    await screen.findByRole('button', { name: 'Retry' })
    expect(onRecent.mock.lastCall?.[0]).toEqual([])
    inputs.connection = 'connected'
    click('Retry')
    await waitFor(() => expect(onList.mock.lastCall?.[0].status).toBe('loaded'))
    const loaded = onList.mock.lastCall?.[0]
    expect(loaded?.status === 'loaded' ? loaded.chats.map((summary) => summary.title) : []).toEqual(['Laptop shortlist', 'Bake sale'])
    expect(onRecent.mock.lastCall?.[0]).toEqual(['harness-chat-laptops', 'harness-chat-bake-sale', 'harness-chat-chemistry'])
  })

  it('says each receipt in the host\'s words, links only a done one inside the app, and reads the live frame', () => {
    const receipt = (fields: Partial<HostReceipt>): HostReceipt => ({
      action: 'platform_update_task', kind: 'write', status: 'done', subject: '#0422', effect: 'moved to Done', link: '/board?task=422', reason: null, ...fields,
    })
    expect(receiptLine(receipt({ status: 'waiting', effect: 'change an agent' }))).toBe('change an agent — waiting for you')
    expect(receiptLine(receipt({ status: 'skipped', reason: null }))).toBe('#0422: not run: no reason given')
    expect(receiptLink(receipt({}))).toBe('/board?task=422')
    expect(receiptLink(receipt({ link: '//elsewhere.example.com/x' }))).toBeNull()
    expect(receiptLink(receipt({ status: 'refused' }))).toBeNull()
    expect(movedSomethingOnTheBoard([receipt({})])).toBe(true)
    expect(movedSomethingOnTheBoard([receipt({ kind: 'read' }), receipt({ subject: 'Letter' })])).toBe(false)
    const part = { type: 'tool-data', data: { receipts: { receipts: [receipt({}), { action: 1 }], above: ['', 'Above'], model: 'harness-model' } } }
    expect(liveReceiptsOf(part)).toEqual({ receipts: [receipt({})], above: ['Above'], model: 'harness-model' })
    expect(liveReceiptsOf({ type: 'tool-start', data: {} })).toBeNull()
  })
})
