// Theme voice: the voice session's words in the conversation, as core's chat adds them (src/internal/live-voice-turns.ts
// over core's lib/chat/live-voice-turns.ts and lib/voice/live-turns.ts). While the fake host's session runs on a
// conversation, useChatController's messages for it end with two ordinary messages, `voice-live-user` (what the member
// is saying) and `voice-live-assistant` (what Auto is saying), each once it has words; only on the conversation the
// session names, never on a new chat with no id; gone once the session ends or the turn is saved (core's settle rule:
// Auto's growing words of a saved exchange stay out, the member's next words come back). A VoiceButton that names no
// conversation starts the session on the one on screen. Made-up words.
import { type HostChatConversation, type HostChatController, useChatController, VoiceButton } from '@automatos/theme-sdk'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { host } from '../src/host.ts'
import { VOICE_LIVE_ASSISTANT_ID, VOICE_LIVE_USER_ID } from '../src/internal/live-voice-turns.ts'

const QUESTION = 'What should I look for in a laptop?'
const ANSWER = 'Aim for 16 GB of memory.'
const HEARD = 'What needs me on the board today?'
const REPLY = 'Two cards are waiting for your approval.'
const NEXT = 'Open the first one.'
/** The stored messages' ids: the conversation's id and each one's place. */
const STORED = ['c1-0', 'c1-1']
const LIVE = [...STORED, VOICE_LIVE_USER_ID, VOICE_LIVE_ASSISTANT_ID]

let latest: HostChatController | null = null

function Thread({ conversation }: { readonly conversation: HostChatConversation }) {
  const chat = useChatController(conversation)
  latest = chat
  return (
    <ol aria-label="Conversation">
      {chat.messages.map((message) => (
        <li key={message.id} data-id={message.id}>
          {message.text}
        </li>
      ))}
    </ol>
  )
}

/** The chat screen, as a theme's is: the conversation on screen, its thread keyed by it, and a voice button. */
function ChatScreen({ conversation: named }: { readonly conversation?: string | null }) {
  const { conversation } = useChatController()
  return (
    <>
      {conversation === null ? null : <Thread key={conversation.key} conversation={conversation} />}
      <VoiceButton press="toggle" conversation={named} />
    </>
  )
}

const ids = (): (string | null)[] => Array.from(document.querySelectorAll('li'), (item) => item.getAttribute('data-id'))

function lastTwo(): readonly HostChatController['messages'][number][] {
  if (latest === null) throw new Error('No chat drew.')
  return latest.messages.slice(-2)
}

/** The stored conversation c1 on screen through its ?chatId= link, with c2 beside it. */
function openConversation(named?: string | null): void {
  const stored = (id: string) => ({ id, title: 'Laptop for uni', updatedAt: '2026-10-14T09:00:00+00:00', preview: null })
  const messages = [{ role: 'user' as const, text: QUESTION }, { role: 'assistant' as const, text: ANSWER }]
  host.setConversations([{ ...stored('c1'), messages }, stored('c2')])
  host.setSearchParams('chatId=c1')
  render(<ChatScreen conversation={named} />)
}

/** The session speaking on `chatId`, with what the member said and Auto's reply so far. */
function speakOn(chatId: string | null, heard = HEARD, reply = REPLY): void {
  act(() => {
    host.setVoice({ chatId, heard, reply })
    host.setVoicePhase('speaking')
  })
}

beforeEach(() => {
  host.reset()
  latest = null
})

describe("the voice session's words in its conversation", () => {
  it('end its messages while the session runs: what the member says, then what Auto says, each once it has words', () => {
    openConversation()
    expect(ids()).toEqual(STORED)
    act(() => {
      host.setVoice({ chatId: 'c1' })
      host.setVoicePhase('listening')
    })
    expect(ids()).toEqual(STORED)
    act(() => host.setVoiceWords({ heard: HEARD }))
    expect(ids()).toEqual([...STORED, VOICE_LIVE_USER_ID])
    act(() => host.setVoicePhase('thinking'))
    expect(ids()).toEqual([...STORED, VOICE_LIVE_USER_ID])
    act(() => {
      host.setVoicePhase('speaking')
      host.setVoiceWords({ reply: REPLY })
    })
    expect(ids()).toEqual(LIVE)
    expect(screen.getByRole('list', { name: 'Conversation' })).toHaveTextContent(`${QUESTION}${ANSWER}${HEARD}${REPLY}`)
  })

  it('are ordinary messages, as core shapes them: their words and nothing else, frozen', () => {
    openConversation()
    speakOn('c1')
    const [user, auto] = lastTwo()
    const plain = { writing: false, stopped: false, error: null, receipts: null, provenance: null, savedError: null, limitReached: null }
    expect(user).toMatchObject({ id: VOICE_LIVE_USER_ID, role: 'user', text: HEARD, ...plain })
    expect(auto).toMatchObject({ id: VOICE_LIVE_ASSISTANT_ID, role: 'assistant', text: REPLY, ...plain })
    expect([auto?.activity, auto?.toolCalls, auto?.deliverables, auto?.approvals, auto?.linkedDeliverables]).toEqual([[], [], [], [], []])
    expect(Object.isFrozen(auto)).toBe(true)
    act(() => host.setVoiceWords({ heard: '' }))
    expect(ids()).toEqual([...STORED, VOICE_LIVE_ASSISTANT_ID])
  })

  it('show only on the conversation the session names: not on another one, nor with none named', () => {
    openConversation()
    speakOn('c2')
    expect(ids()).toEqual(STORED)
    speakOn(null)
    expect(ids()).toEqual(STORED)
    speakOn('c1')
    expect(ids()).toEqual(LIVE)
  })

  it('show on no new chat, which has no id for the session to name', () => {
    render(<ChatScreen />)
    speakOn('c1')
    expect(ids()).toEqual([])
  })

  it('go when the session ends: quick-ask back at idle, a Live call ended, a failure', () => {
    openConversation()
    speakOn('c1')
    act(() => host.setVoicePhase('idle'))
    expect(ids()).toEqual(STORED)
    speakOn('c1')
    act(() => host.setVoicePhase('ended', 'live'))
    expect(ids()).toEqual(STORED)
    speakOn('c1')
    act(() => host.setVoiceError('The microphone stopped.'))
    expect(ids()).toEqual(STORED)
  })
})

describe('a saved turn', () => {
  it("takes them out once its conversation's rows land, and keeps them out while Auto's reply grows", () => {
    openConversation()
    speakOn('c1')
    act(() => host.voiceTurnSaved('c2'))
    expect(ids()).toEqual(LIVE)
    act(() => host.voiceTurnSaved('c1'))
    expect(ids()).toEqual(STORED)
    act(() => host.setVoiceWords({ reply: `${REPLY} The first is a budget.` }))
    expect(ids()).toEqual(STORED)
  })

  it("lets the member's next words show, a new exchange, and a new session's", () => {
    openConversation()
    speakOn('c1')
    act(() => host.voiceTurnSaved('c1'))
    act(() => host.setVoiceWords({ heard: NEXT, reply: '' }))
    expect(ids()).toEqual([...STORED, VOICE_LIVE_USER_ID])
    expect(lastTwo()[1]).toMatchObject({ text: NEXT })
    act(() => host.voiceTurnSaved('c1'))
    act(() => host.setVoicePhase('idle'))
    speakOn('c1', NEXT, '')
    expect(ids()).toEqual([...STORED, VOICE_LIVE_USER_ID])
  })
})

describe('a voice button on the chat screen', () => {
  it('starts the session on the conversation on screen when it names none, and the words show there', () => {
    openConversation()
    fireEvent.click(screen.getByRole('button', { name: 'Talk to Auto' }))
    expect(host.voicePresses()).toEqual([{ action: 'start', mode: 'quick', chatId: 'c1' }])
    act(() => host.setVoiceWords({ heard: HEARD }))
    expect(ids()).toEqual([...STORED, VOICE_LIVE_USER_ID])
  })

  it('starts it on a new chat when it names one (null), where no words show', () => {
    openConversation(null)
    fireEvent.click(screen.getByRole('button', { name: 'Talk to Auto' }))
    expect(host.voicePresses()).toEqual([{ action: 'start', mode: 'quick', chatId: null }])
    act(() => host.setVoiceWords({ heard: HEARD }))
    expect(ids()).toEqual(STORED)
  })
})
