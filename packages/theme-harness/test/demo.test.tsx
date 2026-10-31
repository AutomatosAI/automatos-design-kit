// The demo extras over the harness's sample data, in jsdom (src/host/demo.ts, src/host/demo-data.ts): the address's
// `demo=` names them (src/host/router.ts readSettings, settingsQuery), and app/host.tsx prepareHost gives them to the
// fake host before the first render, as main.tsx starts the page. `healthy-agents`: every agent of the roster active;
// `older-chats`: five older conversations beside the transcript, or a new chat; `approval-turn`: the next send answered
// with the recorded turn that raises an approval; `hello-played`: Play's hello played this session, in theme state;
// `brief-thread` (SDK 1.4.0): the chat on Auto's thread holding the day's brief as a brief@1 message; `brief-row`: Auto
// reads the brief's third row from the page's start, as the host's Listen tells it. With none the page draws the
// sample data, as the regression shots do. A sample theme (made-up data) draws what it reads on its /chat page.
import {
  BriefVoice, defineTheme, readThemeState, useAgents, useChatController, useConversationList, type HostChatConversation,
  type ThemeRegistrationHost,
} from '@automatos/theme-sdk'
import type { ThemePackageManifest } from '@automatos/theme-cli/manifest'
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { HarnessHost, prepareHost } from '../app/host.tsx'
import showcaseFixture from '../fixtures/conversations/showcase.json'
import turnsFixture from '../fixtures/streams/turns.json'
import { host } from '../src/host.ts'
import { BRIEF_ROW_READ, DEMO_EXTRAS, demoOf, demoText, HELLO_KEY, HELLO_STATE, NO_DEMO, type DemoExtra } from '../src/host/demo.ts'
import { APPROVAL_TURN, HEALTHY_ROSTER, OLDER_CONVERSATIONS } from '../src/host/demo-data.ts'
import { BRIEF_THREAD, BRIEF_THREAD_CHAT_ID } from '../src/internal/scripted/auto-thread.ts'
import type { HarnessTheme } from '../src/host/register.ts'
import { DEFAULT_SETTINGS, readSettings, settingsQuery, type HarnessSettings } from '../src/host/router.ts'
import { giveSampleData, SAMPLE_PAGE_DATA } from '../src/host/sample-data.ts'
import { TRANSCRIPT_CONVERSATIONS } from '../src/host/transcript.ts'

const MANIFEST: ThemePackageManifest = {
  schema: 'automatos-theme/v1', id: 'example/demo', name: 'Demo', version: '1.0.0',
  engines: { automatos: '^1.1.0', sdk: '^1.1.0' }, base: 'studio', htmlClass: 'demo', minWidth: 1024, tone: 'light',
  slots: ['frame@1'], pages: { '/chat': { mode: 'own' } },
}

function Frame({ children }: { readonly children?: ReactNode }) {
  return <div data-testid="frame">{children}</div>
}

/** The conversation on screen's messages, each by its role and the types of its known parts. */
function Parts({ conversation }: { readonly conversation: HostChatConversation }) {
  const { messages } = useChatController(conversation)
  return <p data-testid="parts">{messages.map((message) => `${message.role}:${message.knownParts.map((part) => part.type).join('+')}`).join(' ')}</p>
}

/**
 * What the page reads: each agent's status, the conversations' titles, whether Play's hello has played, the
 * conversation on screen and its messages' parts, and the brief row the host's Listen marks.
 */
function ChatPage() {
  const agents = useAgents().data ?? []
  const list = useConversationList()
  const { conversation } = useChatController()
  const titles = list.status === 'loaded' ? list.chats.map((chat) => chat.title) : []
  const hello = readThemeState(HELLO_KEY, HELLO_STATE).value
  return (
    <>
      <p data-testid="agents">{agents.map((agent) => `${agent.name}:${agent.status}:${agent.unavailable ?? ''}`).join(' ')}</p>
      <p data-testid="titles">{titles.join(' | ')}</p>
      <p data-testid="hello">{String(hello)}</p>
      <p data-testid="chat">{conversation?.chatId ?? 'new'}</p>
      {conversation !== null && <Parts key={conversation.key} conversation={conversation} />}
      <BriefVoice />
    </>
  )
}

function register(registration: ThemeRegistrationHost): void {
  registration.registerSlot('frame@1', Frame)
  registration.registerPage('/chat', ChatPage)
}

const THEME: HarnessTheme = {
  manifest: MANIFEST, presets: [], prepaint: null, loadEntry: () => Promise.resolve({ default: defineTheme({ register }) }),
}

/** The page on /chat with the transcript, as main.tsx starts it, with these extras; resolves once the page is drawn. */
async function drawChat(demo: readonly DemoExtra[]): Promise<void> {
  const settings: HarnessSettings = { ...DEFAULT_SETTINGS, path: '/chat', width: 1440, transcript: true, demo }
  giveSampleData()
  prepareHost(THEME, settings, window.innerWidth)
  render(<HarnessHost theme={THEME} initial={settings} />)
  await screen.findByTestId('agents')
}

const titlesOf = (list: readonly { readonly title: string }[]): string[] => list.map((conversation) => conversation.title)

beforeEach(() => {
  host.reset()
})

describe('the demo extras in the address', () => {
  it('are none by default, and `demo=` names them in their own order, each once, a name it does not know dropped', () => {
    expect(DEMO_EXTRAS).toEqual(['healthy-agents', 'older-chats', 'approval-turn', 'hello-played', 'brief-thread', 'brief-row'])
    expect(DEFAULT_SETTINGS.demo).toBe(NO_DEMO)
    expect(readSettings('').demo).toEqual([])
    expect(demoOf('hello-played,healthy-agents,hello-played,everything')).toEqual(['healthy-agents', 'hello-played'])
    expect(demoText(['older-chats', 'healthy-agents'])).toBe('healthy-agents,older-chats')
    expect(settingsQuery({ ...DEFAULT_SETTINGS, demo: ['older-chats'] })).toBe('?demo=older-chats')
    expect(settingsQuery({ ...DEFAULT_SETTINGS, demo: [] })).toBe('')
    DEMO_EXTRAS.forEach((extra) => expect(readSettings(settingsQuery({ ...DEFAULT_SETTINGS, demo: [extra] })).demo).toEqual([extra]))
  })
})

describe('the page without them', () => {
  it('draws the sample roster, the transcript alone, and no hello played', async () => {
    await drawChat(NO_DEMO)
    expect(host.turnsLeft()).toBe(0)
    expect(screen.getByTestId('agents')).toHaveTextContent('Ledger:inactive:')
    expect(screen.getByTestId('agents')).toHaveTextContent('Patch:error:No CLI host is online.')
    await waitFor(() => expect(screen.getByTestId('titles')).toHaveTextContent(titlesOf(TRANSCRIPT_CONVERSATIONS).join(' | ')))
    expect(screen.getByTestId('titles').textContent?.split(' | ')).toHaveLength(TRANSCRIPT_CONVERSATIONS.length)
    expect(screen.getByTestId('hello')).toHaveTextContent('null')
    expect(document.querySelector('[data-brief-voice="root"]')).not.toHaveAttribute('data-voice-row')
  })
})

describe('the page with them', () => {
  it('`healthy-agents`: every agent of the sample roster, each active and able to run', async () => {
    await drawChat(['healthy-agents'])
    expect(HEALTHY_ROSTER.map((agent) => agent.name)).toEqual(SAMPLE_PAGE_DATA.agents.map((agent) => agent.name))
    const shown = screen.getByTestId('agents').textContent ?? ''
    expect(shown.split(' ').map((row) => row.split(':').slice(1).join(':'))).toEqual(HEALTHY_ROSTER.map(() => 'active:'))
  })

  it('`older-chats`: five older conversations beside the transcript, newest first after it', async () => {
    await drawChat(['older-chats'])
    expect(OLDER_CONVERSATIONS).toHaveLength(5)
    const expected = [...titlesOf(TRANSCRIPT_CONVERSATIONS), ...titlesOf(OLDER_CONVERSATIONS)]
    await waitFor(() => expect(screen.getByTestId('titles')).toHaveTextContent(expected.join(' | ')))
  })

  it('`approval-turn`: the next send takes the recorded turn that raises an approval with its view', async () => {
    await drawChat(['approval-turn'])
    expect(host.turnsLeft()).toBe(1)
    const recorded = host.recordedTurns(turnsFixture, 'fixtures/streams/turns.json')
    expect(JSON.stringify(recorded.turns[APPROVAL_TURN])).toContain('approval_view')
  })

  it('`hello-played`: Play\'s hello played this session, kept after the reset main.tsx starts with', async () => {
    await drawChat(['hello-played'])
    expect(screen.getByTestId('hello')).toHaveTextContent('true')
    expect(readThemeState(HELLO_KEY, HELLO_STATE)).toMatchObject({ ready: true, value: true })
  })

  it("`brief-thread`: the chat opens on Auto's thread holding the day's brief, its prose beside its brief@1 part", async () => {
    await drawChat(['brief-thread'])
    expect(await screen.findByTestId('parts')).toHaveTextContent('assistant:text+brief@1')
    expect(screen.getByTestId('chat')).toHaveTextContent(BRIEF_THREAD_CHAT_ID)
    expect(screen.getByTestId('parts').textContent?.split(' ')).toHaveLength(1)
    // Newest first: the transcript's 09:10 before the brief's 09:05.
    const expected = [...titlesOf(TRANSCRIPT_CONVERSATIONS), ...titlesOf(BRIEF_THREAD)]
    await waitFor(() => expect(screen.getByTestId('titles')).toHaveTextContent(expected.join(' | ')))
  })

  it("`brief-row`: Auto reads the brief's third row from the page's start, as the host's Listen marks it", async () => {
    await drawChat(['brief-row'])
    expect(BRIEF_ROW_READ).toBe(2)
    const listen = document.querySelector('[data-brief-voice="root"]')
    expect(listen).toHaveAttribute('data-voice-speaking', 'true')
    expect(listen).toHaveAttribute('data-voice-row', String(BRIEF_ROW_READ))
  })
})

describe('the older conversations', () => {
  it('are older than the transcript, newest first, each with its own id and title and a preview', () => {
    const transcriptAt = Math.min(...TRANSCRIPT_CONVERSATIONS.map((conversation) => Date.parse(conversation.updatedAt)))
    const times = showcaseFixture.map((conversation) => Date.parse(conversation.updatedAt))
    expect(times.every((time) => time < transcriptAt)).toBe(true)
    expect([...times].sort((a, b) => b - a)).toEqual(times)
    const ids = [...OLDER_CONVERSATIONS, ...TRANSCRIPT_CONVERSATIONS].map((conversation) => conversation.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(titlesOf(OLDER_CONVERSATIONS)).size).toBe(OLDER_CONVERSATIONS.length)
    OLDER_CONVERSATIONS.forEach((conversation) => expect(conversation.preview).toBeTruthy())
  })
})
