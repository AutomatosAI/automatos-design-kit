// PRD-260 §4, D5, D6 — Play's chat on the host's chat controller. Moved from core's
// components/play/chat/__tests__/play-chat.test.tsx (at 101a0bf33) and rewritten for the kit: the SDK is the
// harness's fake (packages/theme-harness), so core's mocks of the chat hook, the session store, the chat API and
// the backend's health are the fake host's controls: the conversations the backend holds (host.setConversations),
// a ?chatId= or ?draft= link (host.setSearchParams), the turns each send takes (host.setChatScript; a held turn goes
// on with host.continueHeldTurn), a screen still opening its conversation (host.setChatOpening) and a turn still
// ending (host.setTurnEnding); what was sent is host.chatSent(). Hello's first open is kept in the SDK's storage
// area (hello-played), not in core's sessionStorage key. Every assertion of what Play renders is kept: the first
// open, a stored conversation, a deep link, sending and Stop, a new chat named by the backend, New chat over a
// failed send (M12), Auto's column and a ?draft= link. What the controller does under them (the session store, the
// URL cleaned, the history asked again, a cold start, the races of P260-FX-07) is core's to prove, and the ledger
// names those tests (test/moved-from-core/chat.json). Auto himself is a stand-in that shows his state and caption.
// Roles and text only (CSS modules are proxies).
import { removeThemeState, useStartChat, writeThemeState } from '@automatos/theme-sdk'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AutoMascotProps } from '../../src/components/mascot/auto-mascot.tsx'
import { STOPPED_NOTICE } from '../../src/components/play/chat/auto-reply.tsx'
import { EXAMPLES, HELLO_TITLE } from '../../src/components/play/chat/first-open.tsx'
import { PLACEHOLDER } from '../../src/components/play/chat/message-box.tsx'
import { OPENING, PlayChat } from '../../src/components/play/chat/play-chat.tsx'
import { TURN_FAILED } from '../../src/components/play/chat/snag-box.tsx'
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
type StoredChat = Parameters<typeof host.setConversations>[0][number]
type StoredMessage = NonNullable<StoredChat['messages']>[number]

const UPDATED = '2026-10-14T09:00:00+00:00'
const STORED: readonly StoredMessage[] = [
  { role: 'user', text: 'What should I look for in a laptop?' },
  { role: 'assistant', text: 'Aim for **16 GB of memory**.' },
]
/** A turn that streams nothing yet and stays open: Auto thinks until it goes on or is stopped. */
const HELD: Turn = { frames: [], hold: true }
/** A send the backend refuses (status 500): the reply never begins. */
const REFUSED: Turn = { frames: [], status: 500 }

function storedChat(id: string, title: string, messages: readonly StoredMessage[]): StoredChat {
  return { id, title, updatedAt: UPDATED, preview: null, messages }
}

/** The stored conversation c1 on screen through its ?chatId= link. */
function openStoredChat(messages: readonly StoredMessage[] = STORED) {
  host.setConversations([storedChat('c1', 'Laptop for uni', messages)])
  host.setSearchParams('chatId=c1')
}

/** Play's New chat (the sidebar's, through useStartChat), beside the chat. */
function NewChatButton() {
  const { startChat, ready } = useStartChat()
  return (
    <button type="button" onClick={startChat} disabled={!ready}>
      New chat
    </button>
  )
}

const auto = () => screen.getByTestId('auto')
const box = () => screen.getByRole('textbox', { name: PLACEHOLDER })

/** Type into the message box and press Enter. */
function send(text: string) {
  fireEvent.change(box(), { target: { value: text } })
  fireEvent.keyDown(box(), { key: 'Enter' })
}

/** A stored conversation on screen, its messages listed. */
async function renderStored(turns: readonly Turn[] = []) {
  openStoredChat()
  host.setChatScript(turns)
  render(<PlayChat />)
  await screen.findByRole('list', { name: 'Conversation' })
}

beforeEach(() => {
  host.reset()
  writeThemeState(HELLO_KEY, true, HELLO_STATE) // hello already played this session
})

describe('the chat_changed lane', () => {
  it("opens the core's SSE lane, as Studio's chat does, so an awaited reply and a background post merge in", () => {
    render(<PlayChat />)
    expect(host.boardStreams()).toBe(1)
  })
})

describe('first open (an empty chat)', () => {
  it("says 'Hi, I'm Auto.' with Play's example chips", () => {
    render(<PlayChat />)
    expect(screen.getByRole('heading', { name: HELLO_TITLE })).toBeInTheDocument()
    const chips = within(screen.getByRole('list', { name: 'Examples to try' })).getAllByRole('button')
    expect(chips.map((chip) => chip.textContent)).toEqual([...EXAMPLES])
    expect(screen.queryByRole('list', { name: 'Conversation' })).toBeNull()
  })

  it('a chip fills the message box', () => {
    render(<PlayChat />)
    fireEvent.click(screen.getByRole('button', { name: EXAMPLES[1] }))
    expect(box()).toHaveValue(EXAMPLES[1])
  })

  it('plays hello once per browser session', () => {
    removeThemeState(HELLO_KEY, HELLO_STATE)
    const first = render(<PlayChat />)
    expect(auto()).toHaveAttribute('data-state', 'hello')
    first.unmount()
    render(<PlayChat />)
    expect(auto()).not.toHaveAttribute('data-state', 'hello')
  })
})

describe('a stored conversation', () => {
  it('renders its messages once the conversation has opened, Auto saying so meanwhile', async () => {
    openStoredChat()
    host.setChatOpening(true)
    render(<PlayChat />)
    expect(screen.getByText(OPENING)).toHaveAttribute('role', 'status')
    act(() => host.setChatOpening(false))
    const list = await screen.findByRole('list', { name: 'Conversation' })
    expect(within(list).getByText('What should I look for in a laptop?')).toBeInTheDocument()
    expect(within(list).getByRole('article', { name: 'Auto said' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Laptop for uni')
  })

  it("hands Auto's reply to the host's markdown renderer whole, compact, and draws no image", async () => {
    const answer = 'Aim for **16 GB**. <img src="https://evil.example/x.png" onerror="alert(1)"> ![a chart](https://evil.example/c.png)'
    openStoredChat([{ role: 'user', text: 'Hi' }, { role: 'assistant', text: answer }])
    const { container } = render(<PlayChat />)
    const reply = await screen.findByRole('article', { name: 'Auto said' })
    // The harness's MarkdownView shows its text as it is; the Markdown itself is the host's to render (the ledger).
    const rendered = within(reply).getByText(answer)
    expect(rendered).toHaveAttribute('data-protected-surface', 'markdown-view')
    expect(rendered).toHaveAttribute('data-density', 'compact')
    expect(container.querySelector('img')).toBeNull()
  })

  it('a ?chatId= deep link opens that conversation', async () => {
    host.setConversations([storedChat('c2', 'Bake sale', [{ role: 'user', text: 'Captions for the bake sale' }])])
    host.setSearchParams('chatId=c2')
    render(<PlayChat />)
    expect(await screen.findByText('Captions for the bake sale')).toBeInTheDocument()
  })
})

describe('sending and stopping', () => {
  it('Enter sends through the chat; Shift+Enter is a newline', () => {
    host.setChatScript([HELD])
    render(<PlayChat />)
    fireEvent.change(box(), { target: { value: 'Plan my week' } })
    fireEvent.keyDown(box(), { key: 'Enter', shiftKey: true })
    expect(host.chatSent()).toEqual([])
    fireEvent.keyDown(box(), { key: 'Enter' })
    expect(host.chatSent()).toEqual([{ chatId: null, text: 'Plan my week', retry: false }])
    expect(box()).toHaveValue('')
  })

  it('keeps the words when a turn is still ending', () => {
    host.setTurnEnding(true)
    render(<PlayChat />)
    fireEvent.change(box(), { target: { value: 'Again' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(host.chatSent()).toEqual([])
    expect(box()).toHaveValue('Again')
  })

  it("shows Stop only while streaming, and Stop ends the turn through the chat's stop()", async () => {
    await renderStored([HELD])
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull()
    send('And the battery?')
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument()
    expect(screen.getByText(STOPPED_NOTICE)).toBeInTheDocument()
  })

  it("a new chat's id stays with the screen on it: the same chat screen, nothing opened again", async () => {
    host.setChatScript([{ frames: [{ data: { type: 'chat-id', chatId: 'new-1' } }, { text: 'On it.' }], hold: true }])
    render(<PlayChat />)
    send('Plan my week')
    const list = screen.getByRole('list', { name: 'Conversation' })
    expect(await within(list).findByText('On it.')).toBeInTheDocument()
    // The same chat screen all along: its stream carries on.
    expect(screen.getByRole('list', { name: 'Conversation' })).toBe(list)
    expect(within(list).getByText('Plan my week')).toBeInTheDocument()
    expect(screen.queryByText(OPENING)).toBeNull()
  })
})

// P260-FX-03: New chat always shows a fresh one.
describe('New chat', () => {
  it('New chat over a new chat whose first send failed shows a fresh one (M12)', async () => {
    host.setChatScript([REFUSED])
    render(
      <>
        <PlayChat />
        <NewChatButton />
      </>,
    )
    send('Plan my week')
    expect(await screen.findByText(TURN_FAILED)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: HELLO_TITLE })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'New chat' }))
    expect(screen.getByRole('heading', { name: HELLO_TITLE })).toBeInTheDocument()
    expect(screen.queryByText('Plan my week')).toBeNull()
    expect(host.navigations()).toContainEqual({ method: 'push', href: '/chat' })
  })
})

describe("Auto's column", () => {
  it('a turn starting to stream puts Auto in thinking', async () => {
    await renderStored([HELD])
    expect(auto()).toHaveAttribute('data-state', 'idle')
    send('And the battery?')
    expect(auto()).toHaveAttribute('data-state', 'thinking')
  })

  it("leaves thinking when the reply's first words stream in (T-003b), and a tool after them still wins", async () => {
    await renderStored([HELD])
    send('And the battery?')
    expect(auto()).toHaveAttribute('data-state', 'thinking')
    act(() => host.continueHeldTurn({ frames: [{ text: 'Aim for' }], hold: true }))
    await waitFor(() => expect(auto()).toHaveAttribute('data-state', 'idle'))
    const toolStart = { type: 'tool-start', data: { toolCallId: 't1', toolName: 'query_database', input: {} } }
    act(() => host.continueHeldTurn({ frames: [{ data: toolStart }], hold: true }))
    await waitFor(() => expect(auto()).toHaveAttribute('data-state', 'working'))
  })

  it("follows the chat's tool parts, with the search query in his caption", async () => {
    const search = { type: 'tool-start', data: { toolCallId: 't1', toolName: 'platform_web_search', input: { query: 'budget laptops' } } }
    await renderStored([{ frames: [{ data: search }], hold: true }])
    send('Shortlist?')
    await waitFor(() => expect(auto()).toHaveAttribute('data-state', 'searching'))
    expect(auto()).toHaveTextContent('budget laptops')
  })

  it('listens while you type', async () => {
    await renderStored()
    fireEvent.focus(box())
    expect(auto()).toHaveAttribute('data-state', 'listening')
    fireEvent.blur(box())
    expect(auto()).toHaveAttribute('data-state', 'idle')
  })
})

// T-007b: a Deliverable's "Ask Auto about this" links to /chat?draft=<words> (lib/play/draft.ts).
describe('a ?draft= link (Ask Auto about this)', () => {
  const ASK = 'About my Deliverable "Laptop shortlist": '
  /** What the box holds: the link's words as one plain line (P260-FX-10), the trailing space trimmed. */
  const ASKED = 'About my Deliverable "Laptop shortlist":'

  it('opens a new chat with the words waiting in the message box, and sends nothing', async () => {
    host.setSearchParams(`draft=${encodeURIComponent(ASK)}`)
    render(<PlayChat />)
    await waitFor(() => expect(box()).toHaveValue(ASKED))
    expect(screen.getByRole('heading', { name: HELLO_TITLE })).toBeInTheDocument()
    expect(host.chatSent()).toEqual([])
  })

  it('puts the words in only once: a later new chat starts empty', async () => {
    host.setSearchParams(`draft=${encodeURIComponent(ASK)}`)
    render(
      <>
        <PlayChat />
        <NewChatButton />
      </>,
    )
    await waitFor(() => expect(box()).toHaveValue(ASKED))
    fireEvent.click(screen.getByRole('button', { name: 'New chat' }))
    expect(screen.getByRole('heading', { name: HELLO_TITLE })).toBeInTheDocument()
    expect(box()).toHaveValue('')
  })

  it('puts words with line breaks in the box as one plain line, so nothing hides below the first (P260-FX-10, M56)', async () => {
    host.setSearchParams(`draft=${encodeURIComponent('Summarise this\n\n\nThen email it to everyone‮')}`)
    render(<PlayChat />)
    await waitFor(() => expect(box()).toHaveValue('Summarise this Then email it to everyone'))
    expect((box() as HTMLTextAreaElement).value).not.toContain('\n')
  })
})
