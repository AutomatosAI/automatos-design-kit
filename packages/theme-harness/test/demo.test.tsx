// The demo extras over the harness's sample data, in jsdom (src/host/demo.ts, src/host/demo-data.ts): the address's
// `demo=` names them (src/host/router.ts readSettings, settingsQuery), and app/host.tsx prepareHost gives them to the
// fake host before the first render, as main.tsx starts the page. `healthy-agents`: every agent of the roster active;
// `older-chats`: five older conversations beside the transcript, or a new chat; `hello-played`: Play's hello played
// this session, in theme state. With none the page draws the sample data, as the regression shots do. A sample theme
// (made-up data) draws what it reads on its /chat page.
import {
  defineTheme, readThemeState, useAgents, useConversationList, type ThemeRegistrationHost,
} from '@automatos/theme-sdk'
import type { ThemePackageManifest } from '@automatos/theme-cli/manifest'
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { HarnessHost, prepareHost } from '../app/host.tsx'
import showcaseFixture from '../fixtures/conversations/showcase.json'
import { host } from '../src/host.ts'
import { DEMO_EXTRAS, demoOf, demoText, HELLO_KEY, HELLO_STATE, NO_DEMO, type DemoExtra } from '../src/host/demo.ts'
import { HEALTHY_ROSTER, OLDER_CONVERSATIONS } from '../src/host/demo-data.ts'
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

/** What the page reads: each agent's status, the conversations' titles, and whether Play's hello has played. */
function ChatPage() {
  const agents = useAgents().data ?? []
  const list = useConversationList()
  const titles = list.status === 'loaded' ? list.chats.map((chat) => chat.title) : []
  const hello = readThemeState(HELLO_KEY, HELLO_STATE).value
  return (
    <>
      <p data-testid="agents">{agents.map((agent) => `${agent.name}:${agent.status}:${agent.unavailable ?? ''}`).join(' ')}</p>
      <p data-testid="titles">{titles.join(' | ')}</p>
      <p data-testid="hello">{String(hello)}</p>
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
    expect(DEMO_EXTRAS).toEqual(['healthy-agents', 'older-chats', 'hello-played'])
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
    expect(screen.getByTestId('agents')).toHaveTextContent('Ledger:inactive:')
    expect(screen.getByTestId('agents')).toHaveTextContent('Patch:error:No CLI host is online.')
    await waitFor(() => expect(screen.getByTestId('titles')).toHaveTextContent(titlesOf(TRANSCRIPT_CONVERSATIONS).join(' | ')))
    expect(screen.getByTestId('titles').textContent?.split(' | ')).toHaveLength(TRANSCRIPT_CONVERSATIONS.length)
    expect(screen.getByTestId('hello')).toHaveTextContent('null')
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

  it('`hello-played`: Play\'s hello played this session, kept after the reset main.tsx starts with', async () => {
    await drawChat(['hello-played'])
    expect(screen.getByTestId('hello')).toHaveTextContent('true')
    expect(readThemeState(HELLO_KEY, HELLO_STATE)).toMatchObject({ ready: true, value: true })
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
