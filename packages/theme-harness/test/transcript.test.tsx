// The transcript the harness can open the chat on (src/host/transcript.ts), so a theme's chat page is shot with a
// conversation on it: a stored reply carries its turn's frames, read onto it as the stream reads them (its tool line and
// the Deliverable it made, src/sdk/chat.ts); the transcript is a conversation the backend holds, linked from the address
// as core's ?chatId= deep link opens one; the setting is in the address (`chat=transcript`); and the shots' transcript
// group opens the chat page with it, in the default look at 1440 px (src/host/shot-groups.ts). Made-up data.
import { type HostChatConversation, useChatController, useConversationList } from '@automatos/theme-sdk'
import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import transcriptFixture from '../fixtures/conversations/transcript.json'
import { host } from '../src/host.ts'
import { DEFAULT_SETTINGS, readSettings, settingsQuery } from '../src/host/router.ts'
import { shotAddress, shotGroups } from '../src/host/shot-groups.ts'
import { showTranscript, TRANSCRIPT_CHAT_ID } from '../src/host/transcript.ts'

const ASKED = 'Help me pick a light laptop for travel'

/** One conversation's messages, each with its tool lines and Deliverables, as a theme's thread draws them. */
function Thread({ conversation }: { readonly conversation: HostChatConversation }) {
  const chat = useChatController(conversation)
  return (
    <ol>
      {chat.messages.map((message) => (
        <li key={message.id} data-testid={message.role}>
          <p>{message.text}</p>
          {message.toolCalls.map((call) => (
            <span key={call.toolCallId} data-testid="tool">{`${call.toolName} ${call.state} ${call.summary ?? ''}`}</span>
          ))}
          {message.deliverables.map((made) => (
            <span key={made.id} data-testid="deliverable">{`${made.id} ${made.title} ${made.kind}`}</span>
          ))}
        </li>
      ))}
    </ol>
  )
}

/** The chat screen: the conversation on screen, its thread keyed by it, as Play's and HUD's are. */
function ChatScreen() {
  const { conversation } = useChatController()
  const list = useConversationList()
  const titles = list.status === 'loaded' ? list.chats.map((chat) => chat.title).join(', ') : ''
  return (
    <>
      <p data-testid="list">{titles}</p>
      {conversation === null ? null : <Thread key={conversation.key} conversation={conversation} />}
    </>
  )
}

beforeEach(() => {
  host.reset()
})

describe('a stored reply with its frames', () => {
  it('opens with the tool line and the Deliverable its turn streamed, beside its words', () => {
    host.setConversations(host.conversationsOf(transcriptFixture, 'conversations/transcript.json'))
    host.setSearchParams(`chatId=${TRANSCRIPT_CHAT_ID}`)
    render(<ChatScreen />)
    expect(screen.getByTestId('user')).toHaveTextContent(ASKED)
    expect(screen.getByTestId('assistant')).toHaveTextContent('Here is your laptop shortlist')
    expect(screen.getByTestId('tool')).toHaveTextContent('platform_search_documents completed 3 documents found')
    expect(screen.getByTestId('deliverable')).toHaveTextContent('d-report-1 Laptop shortlist document')
  })

  it('refuses a stored row whose frames are not recorded frames', () => {
    const row = (frames: unknown) => [{ id: 'c-1', title: 'T', updatedAt: '2026-10-14T09:00:00+00:00', preview: null, messages: [{ role: 'assistant', text: '', frames }] }]
    expect(() => host.conversationsOf(row('tool'))).toThrow('conversations[0].messages[0].frames is not a list.')
    expect(() => host.conversationsOf(row([{ kind: 'tool' }]))).toThrow('conversations[0].messages[0].frames[0] is neither a text, a data nor an error frame.')
  })
})

describe('the transcript', () => {
  it('opens the chat on the made-up exchange, which the lists show, and on a new chat again once off', async () => {
    showTranscript(true)
    render(<ChatScreen />)
    expect(screen.getByTestId('user')).toHaveTextContent(ASKED)
    expect(await screen.findByText('Laptop shortlist', { selector: '[data-testid="list"]' })).toBeInTheDocument()
    act(() => showTranscript(false))
    expect(screen.queryByTestId('user')).toBeNull()
  })

  it('is a setting in the address, which the transcript group opens the chat page with', () => {
    expect(readSettings('?chat=transcript').transcript).toBe(true)
    expect(readSettings('').transcript).toBe(false)
    expect(settingsQuery({ ...DEFAULT_SETTINGS, transcript: true })).toBe('?chat=transcript')
    const group = shotGroups(['ember'], 1024, ['/chat']).find((candidate) => candidate.transcript)
    expect(group).toEqual({ folder: 'ember/1440-transcript', preset: 'ember', width: 1440, reducedMotion: true, page: '/chat', transcript: true })
    if (group === undefined) throw new Error('no transcript group')
    expect(readSettings(shotAddress(group, '/chat').slice(1))).toMatchObject({ path: '/chat', transcript: true, reducedMotion: true })
  })
})
