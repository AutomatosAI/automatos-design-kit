/**
 * PRD-268 K17 (SDK 1.4.0): a chat message's knownParts on the fake chat (src/sdk/chat.ts over
 * src/internal/scripted/message-parts.ts), read through the SDK as a theme that owns /chat reads them, and the cases of
 * core's frontend/lib/theme-sdk/__tests__/chat-parts.test.ts. A stored message's parts are its fixture's, read as core
 * reads them (the brief by its part, a suggestion's id, the chips the host would draw), frozen, never the raw parts; a
 * message of the turn carries its words alone. Made-up data.
 */
import { type HostBriefPart, type HostChatController, type HostChatConversation, type HostMessagePart, useChatController } from '@automatos/theme-sdk'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import transcriptFixture from '../fixtures/conversations/transcript.json'
import briefFixture from '../fixtures/proactive/brief.json'
import turnsFixture from '../fixtures/streams/turns.json'
import { AUTO_THREAD, AUTO_THREAD_CHAT_ID, host } from '../src/host.ts'
import { SAMPLE_PAGE_DATA } from '../src/host/sample-data.ts'
import { TRANSCRIPT_CHAT_ID } from '../src/host/transcript.ts'
import { knownPartsOf } from '../src/internal/scripted/message-parts.ts'

const ASK = 'Compare these laptops'
const LIVE_ANSWER = 'Here is your laptop shortlist.'
const SUGGESTION_ID = '00000000-0000-4000-8000-00000000a001'
const SOURCE_ID = '7d1c0a52-3e0b-4c55-9a1e-2f6f0c1d9b10'
const TRANSCRIPT_CHIPS = ['Compare the two lightest', 'Which lasts longest?', 'Show me the prices']
const BRIEF = { type: 'brief@1', brief: briefFixture }

let chat: HostChatController | null = null

function Thread({ conversation }: { readonly conversation: HostChatConversation }) {
  const controller = useChatController(conversation)
  chat = controller
  return <button type="button" onClick={() => controller.send(ASK)}>Send</button>
}

function ChatScreen() {
  const { conversation } = useChatController()
  return conversation === null ? null : <Thread key={conversation.key} conversation={conversation} />
}

/** The conversation `chatId` the backend holds, opened from the address as core's deep link opens one. */
function opened(conversations: Parameters<typeof host.setConversations>[0], chatId: string): void {
  host.setConversations(conversations)
  host.setSearchParams(`chatId=${chatId}`)
  render(<ChatScreen />)
}

function shown(): HostChatController['messages'] {
  if (chat === null) throw new Error('The chat screen has not rendered.')
  return chat.messages
}

const typesOf = (parts: readonly HostMessagePart[]): string[] => parts.map((part) => part.type)
const briefIn = (parts: readonly HostMessagePart[]) => parts.find((part): part is HostBriefPart => part.type === 'brief@1')?.brief ?? null

beforeEach(() => {
  host.reset()
  chat = null
})

describe('knownParts on the messages a conversation opens with', () => {
  it("hands the Auto thread's parts typed, in order: the brief by its part, the suggestion's id and the chips", () => {
    opened(AUTO_THREAD, AUTO_THREAD_CHAT_ID)
    const [brief, question, answer] = shown()
    expect(typesOf(brief.knownParts)).toEqual(['text', 'brief@1'])
    expect(briefIn(brief.knownParts)).toMatchObject({ v: 1, date: briefFixture.date, prose: briefFixture.prose, state_hash: briefFixture.state_hash })
    expect(question.knownParts).toEqual([{ type: 'text', text: question.text }])
    expect(answer.knownParts).toEqual([
      { type: 'text', text: answer.text },
      { type: 'suggestion@1', suggestion_id: SUGGESTION_ID },
      { type: 'reply_chips@1', replies: ['Start it', 'Not now'] },
    ])
  })

  it('freezes the list, each part and the brief down to its rows, and never hands the raw parts', () => {
    opened(AUTO_THREAD, AUTO_THREAD_CHAT_ID)
    const [message] = shown()
    const brief = briefIn(message.knownParts)
    expect(Object.isFrozen(message.knownParts)).toBe(true)
    message.knownParts.forEach((part) => expect(Object.isFrozen(part)).toBe(true))
    expect([Object.isFrozen(brief), Object.isFrozen(brief?.sections.needs_you), Object.isFrozen(brief?.sections.needs_you[0])]).toEqual([true, true, true])
    expect(brief).not.toBe(briefFixture)
    expect(Object.keys(message)).not.toContain('parts')
    expect(Object.keys(message)).not.toContain('stored')
  })

  it("gives the transcript's reply its suggestion and three chips, so the chat shots show them, and its question its words", () => {
    opened(host.conversationsOf(transcriptFixture, 'conversations/transcript.json'), TRANSCRIPT_CHAT_ID)
    const [question, reply] = shown()
    expect(question.knownParts).toEqual([{ type: 'text', text: question.text }])
    expect(typesOf(reply.knownParts)).toEqual(['text', 'suggestion@1', 'reply_chips@1'])
    expect(reply.knownParts.at(-1)).toEqual({ type: 'reply_chips@1', replies: TRANSCRIPT_CHIPS })
    // The suggestion is one the sample useSuggestions lists, so Start and Hide take it on the harness page.
    expect(reply.knownParts[1]).toEqual({ type: 'suggestion@1', suggestion_id: SUGGESTION_ID })
    expect(SAMPLE_PAGE_DATA.suggestions.map((suggestion) => suggestion.id)).toContain(SUGGESTION_ID)
  })
})

describe('knownParts on the messages of the turn', () => {
  it('gives the sent message and the live reply one text part of their words, no brief, suggestion or chips', async () => {
    host.setChatScript(host.scriptOf(host.recordedTurns(turnsFixture, 'streams/turns.json'), ['answer']))
    render(<ChatScreen />)
    expect(shown()).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    // The reply waiting for its first words has no part yet, as core's controller holds it.
    expect(shown().map((message) => message.knownParts)).toEqual([[{ type: 'text', text: ASK }], []])
    await waitFor(() => expect(shown().at(-1)?.text).toBe(LIVE_ANSWER))
    await waitFor(() => expect(chat?.status).toBe('idle'))
    expect(shown().map((message) => message.knownParts)).toEqual([[{ type: 'text', text: ASK }], [{ type: 'text', text: LIVE_ANSWER }]])
  })
})

describe("knownPartsOf: core's cases", () => {
  const malformed = [
    { type: 'weather@1', forecast: 'rain' }, { type: 'reasoning', reasoning: 'thinking' }, { type: 'constructor' }, { type: '__proto__' },
    { type: 'text', text: 7 }, { type: 'brief@1', brief: { v: 2 } }, { type: 'brief@1' }, { type: 'suggestion@1', suggestion_id: '../../admin' },
    { type: 'reply_chips@1', replies: ['Window', 3] }, { type: 'reply_chips@1', replies: 'Window, Aisle' },
    { type: 'reply_chips@1', replies: ['Only one'] }, { type: 7 }, 'text', null, [],
  ]

  it("drops every part of an unknown type and every part that isn't what its type says, keeping the rest", () => {
    expect(() => knownPartsOf('assistant', malformed)).not.toThrow()
    expect(knownPartsOf('assistant', malformed)).toEqual([])
    expect(knownPartsOf('assistant', [...malformed, { type: 'text', text: 'Hi' }])).toEqual([{ type: 'text', text: 'Hi' }])
    expect([knownPartsOf('assistant', undefined), knownPartsOf('assistant', 'brief@1')]).toEqual([[], []])
  })

  it("takes a suggestion part's id from the message's source, and hands over only the chips the host would draw", () => {
    expect(knownPartsOf('assistant', [{ type: 'suggestion@1' }], { origin: 'suggestion', suggestion_id: SOURCE_ID })).toEqual([
      { type: 'suggestion@1', suggestion_id: SOURCE_ID },
    ])
    const replies = ['  Window ', 'Aisle', 'Aisle', '/mission plan it', 'A reply that is far too long to tap', 'Middle', 'Either']
    expect(knownPartsOf('assistant', [{ type: 'reply_chips@1', replies }])).toEqual([{ type: 'reply_chips@1', replies: ['Window', 'Aisle', 'Middle'] }])
  })

  it("counts brief, suggestion and chip parts on Auto's messages only; a person's message keeps its text", () => {
    const parts = [{ type: 'text', text: 'Brief me' }, BRIEF, { type: 'suggestion@1', suggestion_id: SUGGESTION_ID }, { type: 'reply_chips@1', replies: ['A', 'B'] }]
    expect(knownPartsOf('user', parts)).toEqual([{ type: 'text', text: 'Brief me' }])
    expect(typesOf(knownPartsOf('assistant', parts))).toEqual(['text', 'brief@1', 'suggestion@1', 'reply_chips@1'])
  })
})
