/**
 * PRD-261 B-05c: the fake chat's controls that Play's moved chat tests (themes/play/test/chat/) drive, through the
 * fake host (src/host.ts) as a theme's test does: a held turn goes on (continueHeldTurn), a stored reply keeps who
 * wrote it and a failure the server saved, the screen still opening its conversation (setChatOpening), a turn still
 * ending (setTurnEnding) and the Mission being planned (setPlanningMissionId). The chat screen is built as in
 * chat.test.tsx: useChatController() for the conversation on screen, then useChatController(conversation) in a child
 * keyed by conversation.key.
 */
import type { HostChatController, HostChatConversation } from '@automatos/theme-sdk'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useChatController } from '../src/sdk/chat.ts'
import { host } from '../src/host.ts'

const WORDS = 'Compare these laptops'
const SAVED_CHAT = 'harness-chat-saved'
const SAVED_FAILURE = 'The model is unavailable'
const BACKGROUND = 'Auto · background'
const MISSION = 'harness-mission-2'

type Turn = Parameters<typeof host.setChatScript>[0][number]

interface ChatProps {
  readonly onView: (chat: HostChatController) => void
  readonly onSent: (accepted: boolean) => void
}

function Conversation({ conversation, onView, onSent }: ChatProps & { readonly conversation: HostChatConversation }) {
  const chat = useChatController(conversation)
  onView(chat)
  return (
    <main>
      <ol aria-label="Messages">
        {chat.messages.map((message) => (
          <li key={message.id}>{message.text}</li>
        ))}
      </ol>
      <button type="button" onClick={() => onSent(chat.send(WORDS))}>Send</button>
      <button type="button" onClick={() => onSent(chat.retry())}>Try again</button>
      <button type="button" onClick={chat.stop}>Stop</button>
    </main>
  )
}

function ChatScreen(props: ChatProps & { readonly onScreen: (conversation: HostChatConversation | null) => void }) {
  const { conversation } = useChatController()
  props.onScreen(conversation)
  return conversation === null ? <p role="status">Opening</p> : <Conversation key={conversation.key} conversation={conversation} {...props} />
}

function renderChat() {
  const onView = vi.fn<(chat: HostChatController) => void>()
  const onSent = vi.fn<(accepted: boolean) => void>()
  const onScreen = vi.fn<(conversation: HostChatConversation | null) => void>()
  render(<ChatScreen onView={onView} onSent={onSent} onScreen={onScreen} />)
  const chat = (): HostChatController => {
    const last = onView.mock.lastCall?.[0]
    if (last === undefined) throw new Error('The chat screen has not rendered.')
    return last
  }
  return { chat, onSent, shown: () => onScreen.mock.lastCall?.[0] ?? null }
}

const click = (name: string): void => {
  fireEvent.click(screen.getByRole('button', { name }))
}

const held = (text: string): Turn => ({ frames: [{ text }], hold: true })

beforeEach(() => {
  host.reset()
})

describe('a held turn goes on', () => {
  it('plays the frames continueHeldTurn gives, holds again when asked, then ends', async () => {
    host.setChatScript([held('First')])
    const { chat } = renderChat()
    click('Send')
    await screen.findByText('First')
    act(() => host.continueHeldTurn({ frames: [{ text: ' and second' }], hold: true }))
    await screen.findByText('First and second')
    expect(chat()).toMatchObject({ status: 'streaming', streaming: true })
    act(() => host.continueHeldTurn({ frames: [] }))
    await waitFor(() => expect(chat().status).toBe('idle'))
    expect(chat().messages.map((message) => [message.text, message.stopped])).toEqual([[WORDS, false], ['First and second', false]])
  })

  it('keeps what a test went on with before the turn held for the turn, as it holds; a second one before then throws', async () => {
    host.setChatScript([{ frames: [], hold: true }])
    const { chat } = renderChat()
    click('Send')
    // The turn holds a tick after the send: what the test goes on with now waits for it.
    act(() => host.continueHeldTurn({ frames: [{ text: 'Late words' }] }))
    expect(() => host.continueHeldTurn({ frames: [] })).toThrow(/one is already waiting/)
    await screen.findByText('Late words')
    await waitFor(() => expect(chat().status).toBe('idle'))
  })

  it('lets go of the turn on Stop: it stays stopped, and the next held turn takes what comes after', async () => {
    host.setChatScript([held('Partly'), held('Next')])
    const { chat } = renderChat()
    click('Send')
    await screen.findByText('Partly')
    click('Stop')
    expect(chat().messages[1]).toMatchObject({ text: 'Partly', stopped: true })
    act(() => host.continueHeldTurn({ frames: [{ text: ' turn' }] }))
    click('Send')
    await waitFor(() => expect(chat().status).toBe('idle'))
    expect(chat().messages.map((message) => [message.text, message.stopped])).toEqual([
      [WORDS, false],
      ['Partly', true],
      [WORDS, false],
      ['Next turn', false],
    ])
  })
})

describe('the stored replies, the screen opening, a turn ending and the Mission', () => {
  it('opens a stored conversation with who wrote a reply and the failure the server saved; a reply of the turn has neither', () => {
    host.setConversations([
      {
        id: SAVED_CHAT,
        title: 'Saved',
        updatedAt: '2026-10-14T09:00:00+00:00',
        preview: null,
        messages: [
          { role: 'user', text: WORDS },
          { role: 'assistant', text: SAVED_FAILURE, savedError: SAVED_FAILURE },
          { role: 'assistant', text: 'Watched it.', provenance: BACKGROUND },
        ],
      },
    ])
    host.setSearchParams(`chatId=${SAVED_CHAT}`)
    const { chat } = renderChat()
    expect(chat().messages.map((message) => [message.provenance, message.savedError])).toEqual([
      [null, null],
      [null, SAVED_FAILURE],
      [BACKGROUND, null],
    ])
    const [parsed] = host.conversationsOf([{ id: 'x', title: 'X', updatedAt: '2026-10-14T09:00:00+00:00', preview: null, messages: [{ role: 'assistant', text: 'Hi', provenance: BACKGROUND }] }])
    expect(parsed?.messages).toEqual([{ role: 'assistant', text: 'Hi', provenance: BACKGROUND }])
    const bad = [{ id: 'x', title: 'X', updatedAt: '2026-10-14T09:00:00+00:00', preview: null, messages: [{ role: 'assistant', text: 'Hi', savedError: 7 }] }]
    expect(() => host.conversationsOf(bad)).toThrow(/savedError is not a string/)
  })

  it('shows no conversation while the screen is still opening it, then the same one', () => {
    host.setChatOpening(true)
    const { shown } = renderChat()
    expect(shown()).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('Opening')
    act(() => host.setChatOpening(false))
    expect(shown()).toMatchObject({ chatId: null, title: null })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('starts nothing while a turn is still ending, though nothing streams; then sends again', async () => {
    host.setChatScript([held('Back')])
    host.setTurnEnding(true)
    const { chat, onSent } = renderChat()
    click('Send')
    click('Try again')
    expect(onSent.mock.calls).toEqual([[false], [false]])
    expect(chat()).toMatchObject({ status: 'idle', streaming: false })
    expect(host.chatSent()).toEqual([])
    host.setTurnEnding(false)
    click('Send')
    expect(onSent).toHaveBeenLastCalledWith(true)
    await screen.findByText('Back')
  })

  it('hands the chat the Mission being planned, and none once it is cleared', () => {
    const { chat } = renderChat()
    expect(chat().planningMissionId).toBeNull()
    act(() => host.setPlanningMissionId(MISSION))
    expect(chat().planningMissionId).toBe(MISSION)
    act(() => host.setPlanningMissionId(null))
    expect(chat().planningMissionId).toBeNull()
  })
})
