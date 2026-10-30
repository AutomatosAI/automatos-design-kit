// Candy's /chat on the harness's scripted chat (a frame per tick) and its card stand-ins (protected surfaces that keep
// their clicks), after themes/arcade/test/chat.test.tsx (Arcade 1.0.0). A turn plays: your words in a bubble, what
// Auto did as chips, his reply through the host's Markdown, a Deliverable as a row that opens it, "Auto is writing"
// before his words; Send, Stop, Enter, Shift+Enter and Esc; the voice button outside the AI label fence; the host's
// approval card placed; the stage's state word following the turn and the voice session; Pause; your conversations
// newest first with the one on screen marked; the phone's stack. Every value is made up. Roles, names and text only.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { host } from '@automatos/theme-harness/host'

import { ChatPage } from '../src/chat/chat-page.tsx'
import { CHOICE_WAITING } from '../src/chat/cards.tsx'
import { PLACEHOLDER, SEND, STOP } from '../src/chat/composer.tsx'
import { CONVERSATIONS } from '../src/chat/conversations.tsx'
import { AUTO_SAID, DELIVERABLE_LABEL, STOPPED, WRITING, YOU_SAID } from '../src/chat/entries.tsx'
import { RAIL_LABEL } from '../src/chat/chat-view.tsx'
import { AUTO_NAME, CONVERSATIONS_BUTTON } from '../src/chat/stage.tsx'
import { THREAD_LABEL } from '../src/chat/thread.tsx'
import { PAUSE_SHORT } from '../src/motion/pause-toggle.tsx'

type Turn = Parameters<typeof host.setChatScript>[0][number]
type Frame = Turn['frames'][number]

const words = (text: string): Frame => ({ text })
const part = (type: string, data: unknown): Frame => ({ data: { type, data } })
const toolData = (data: unknown): Frame => part('tool-data', data)
const TOOL_APPROVAL = { grant_id: 42, action: 'platform_post_instagram', message: 'Post to Instagram?', requires_approval: true }
const MADE = { generated_document: { deliverable_id: 'd-42', title: 'Spring launch post', format: 'pdf' } }
const STORED = { id: 'c-1', title: 'Weekly digest ideas', updatedAt: '2026-10-29T09:00:00Z', preview: null }

/** A turn that searched, wrote a Deliverable and answered in Markdown. */
const LAUNCH_TURN: Turn = {
  frames: [
    part('tool-start', { toolCallId: 't1', toolName: 'platform_search_knowledge', input: { query: 'spring lookbook' } }),
    part('tool-end', { toolCallId: 't1', toolName: 'platform_search_knowledge', success: true, summary: 'Searched Knowledge · spring lookbook' }),
    part('tool-start', { toolCallId: 't2', toolName: 'platform_post_draft' }),
    part('tool-end', { toolCallId: 't2', toolName: 'platform_post_draft', success: false, error: 'the draft was too long' }),
    toolData(MADE),
    words('Love it. **Here** is the first draft.'),
  ],
}

// --- A window of a chosen width (jsdom has none: a wide one), after Arcade's test/support/window-width.ts. ---------
const PHONE_WIDTH = 390
const MAX_WIDTH = /\(max-width:\s*(\d+(?:\.\d+)?)px\)/

function setWindowWidth(width: number): void {
  const matchMedia = (media: string): MediaQueryList => {
    const max = MAX_WIDTH.exec(media)
    return {
      media,
      matches: max !== null && width <= Number(max[1]),
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => true,
    } as unknown as MediaQueryList
  }
  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: matchMedia })
}

function resetWindowWidth(): void {
  Reflect.deleteProperty(window, 'matchMedia')
}

// --- Helpers -------------------------------------------------------------------------------------------------------
const box = (): HTMLElement => screen.getByRole('textbox', { name: PLACEHOLDER })
const thread = (): HTMLElement => screen.getByRole('region', { name: THREAD_LABEL })
const rail = (): HTMLElement => screen.getByRole('complementary', { name: RAIL_LABEL })
const statePill = (): HTMLElement => within(rail()).getByRole('status')

function ask(text: string): void {
  fireEvent.change(box(), { target: { value: text } })
  fireEvent.keyDown(box(), { key: 'Enter' })
}

async function renderChat(turns: readonly Turn[] = []): Promise<void> {
  host.setChatScript(turns)
  render(<ChatPage />)
  await screen.findByRole('textbox', { name: PLACEHOLDER })
}

beforeEach(() => {
  host.reset()
})

afterEach(() => {
  resetWindowWidth()
})

describe('a turn', () => {
  it("plays: your bubble, Auto's chips, his reply through the host's Markdown and the Deliverable he made", async () => {
    await renderChat([LAUNCH_TURN])
    ask('Write the spring launch post\nfor Instagram')
    const yours = within(thread()).getByRole('article', { name: YOU_SAID })
    expect(yours).toHaveTextContent('Write the spring launch postfor Instagram')
    expect(yours.querySelectorAll('br')).toHaveLength(1)
    const reply = await within(thread()).findByRole('article', { name: AUTO_SAID })
    await waitFor(() => expect(reply).toHaveTextContent('Love it.'))
    expect(reply).toHaveTextContent('✓ Searched Knowledge · spring lookbook')
    expect(reply).toHaveTextContent('✕ platform post draft: the draft was too long')
    expect(host.markdownViews().some((view) => view.skipHtml === true && view.children === 'Love it. **Here** is the first draft.')).toBe(true)
    const made = within(reply).getByRole('group', { name: `${DELIVERABLE_LABEL} Spring launch post` })
    expect(made).toHaveTextContent('Document · made in this chat')
    expect(within(made).getByRole('link', { name: 'Open Spring launch post' })).toHaveAttribute('href', '/deliverables?deliverable=d-42')
    expect(host.chatSent().map((sent) => sent.text)).toEqual(['Write the spring launch post\nfor Instagram'])
  })

  it('says "Auto is writing" while his reply has no words, with the dots moving only while motion is on', async () => {
    await renderChat([{ frames: [], hold: true }])
    ask('Plan the week')
    const writing = await within(thread()).findByText(WRITING)
    expect(writing).toHaveAttribute('data-moving', 'true')
    act(() => host.setReducedMotion(true))
    expect(within(thread()).getByText(WRITING)).not.toHaveAttribute('data-moving')
  })
})

describe('the message box', () => {
  it('sends on Send and on Enter, never on Shift+Enter or with nothing in it', async () => {
    await renderChat([{ frames: [words('One.')] }, { frames: [words('Two.')] }])
    const send = screen.getByRole('button', { name: SEND })
    expect(send).toBeDisabled()
    fireEvent.change(box(), { target: { value: 'First' } })
    fireEvent.keyDown(box(), { key: 'Enter', shiftKey: true })
    expect(host.chatSent()).toEqual([])
    fireEvent.click(send)
    await waitFor(() => expect(within(thread()).getByRole('article', { name: AUTO_SAID })).toHaveTextContent('One.'))
    ask('Second')
    expect(host.chatSent().map((sent) => sent.text)).toEqual(['First', 'Second'])
    expect(box()).toHaveValue('')
  })

  it('turns Send into Stop while Auto answers; Stop and Esc both stop him', async () => {
    await renderChat([{ frames: [words('Still going')], hold: true }, { frames: [words('Again')], hold: true }])
    ask('Go')
    fireEvent.click(await screen.findByRole('button', { name: STOP }))
    expect(await within(thread()).findByText(STOPPED)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: SEND })).toBeInTheDocument()
    ask('Once more')
    await screen.findByRole('button', { name: STOP })
    fireEvent.keyDown(box(), { key: 'Escape' })
    await waitFor(() => expect(screen.getByRole('button', { name: SEND })).toBeInTheDocument())
  })

  it("keeps the host's voice button beside the box, outside the fenced form", async () => {
    await renderChat()
    const form = box().closest('form')
    const voice = screen.getByRole('button', { name: 'Hold to talk' })
    expect(form).not.toBeNull()
    expect(form?.contains(voice)).toBe(false)
    expect(form?.parentElement?.contains(voice)).toBe(false)
  })
})

describe("the host's cards", () => {
  it('places the approval card a reply raised, its buttons the host\'s own', async () => {
    await renderChat([{ frames: [words('Shall I post it?'), toolData({ tool_approval: TOOL_APPROVAL })], hold: true }])
    ask('Post it')
    const choice = await within(thread()).findByRole('region', { name: CHOICE_WAITING })
    const surface = within(choice).getByRole('region', { name: 'Action approval needed' })
    expect(surface).toHaveAttribute('data-protected-surface', 'tool-approval')
    fireEvent.click(within(surface).getByRole('button', { name: /approve & run/i }))
    expect(host.cardActions()).toEqual([{ card: 'tool-approval', id: '42', action: 'approved' }])
  })
})

describe("Auto's stage", () => {
  it('says hello on a new chat', async () => {
    await renderChat()
    expect(statePill()).toHaveTextContent('● Hello')
    expect(within(rail()).getByRole('img', { name: "Auto, Hi, I'm Auto." })).toBeInTheDocument()
  })

  it('follows the turn, thinking once you send, and the voice session over it', async () => {
    host.setConversations([{ ...STORED, messages: [{ role: 'user', text: 'Hi' }, { role: 'assistant', text: 'Hello there.' }] }])
    host.setSearchParams(`chatId=${STORED.id}`)
    await renderChat([{ frames: [], hold: true }])
    await waitFor(() => expect(statePill()).toHaveTextContent('○ Ready'))
    ask('Think about it')
    await waitFor(() => expect(statePill()).toHaveTextContent('● Thinking'))
    expect(within(rail()).getByRole('img', { name: 'Auto, Thinking' })).toBeInTheDocument()
    act(() => host.setVoicePhase('listening'))
    expect(statePill()).toHaveTextContent('● Listening')
    act(() => host.setVoicePhase('speaking'))
    expect(statePill()).toHaveTextContent('● Speaking')
  })

  it('pauses the motion with a toggle', async () => {
    await renderChat()
    const pause = within(rail()).getByRole('button', { name: PAUSE_SHORT })
    expect(pause).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(pause)
    await waitFor(() => expect(within(rail()).getByRole('button', { name: PAUSE_SHORT })).toHaveAttribute('aria-pressed', 'true'))
  })
})

describe('the conversations', () => {
  it('lists them newest first, the one on screen marked', async () => {
    host.setConversations([
      { id: 'c-old', title: 'Holiday campaign', updatedAt: '2026-10-20T09:00:00Z', preview: null },
      { id: 'c-now', title: 'Spring launch post', updatedAt: '2026-10-30T09:00:00Z', preview: null },
      { id: 'c-mid', title: 'Supplier follow-ups', updatedAt: '2026-10-28T09:00:00Z', preview: null },
    ])
    host.setSearchParams('chatId=c-now')
    await renderChat()
    const list = within(rail()).getByRole('region', { name: CONVERSATIONS })
    const links = await within(list).findAllByRole('link')
    expect(links.map((link) => link.textContent?.replace(/(Now|\d+ (min|h)|Yesterday|[A-Z][a-z]{2}( \d+)?)$/, ''))).toEqual([
      'Spring launch post',
      'Supplier follow-ups',
      'Holiday campaign',
    ])
    expect(links[0]).toHaveAttribute('href', '/chat?chatId=c-now')
    expect(links[0]).toHaveAttribute('aria-current', 'page')
    expect(links[1]).not.toHaveAttribute('aria-current')
  })
})

describe('the phone', () => {
  it('stacks the stage strip over the thread and the box, with no rail', async () => {
    setWindowWidth(PHONE_WIDTH)
    await renderChat()
    expect(screen.queryByRole('complementary', { name: RAIL_LABEL })).toBeNull()
    const stage = screen.getByRole('region', { name: AUTO_NAME })
    expect(within(stage).getByRole('heading', { level: 1 })).toHaveTextContent('New chat')
    expect(within(stage).getByRole('status')).toBeInTheDocument()
    expect(stage.compareDocumentPosition(thread()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(thread().compareDocumentPosition(box()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const voice = screen.getByRole('button', { name: 'Hold to talk' })
    expect(box().closest('form')?.contains(voice)).toBe(false)
  })

  it('shows your conversations under the stage when asked', async () => {
    setWindowWidth(PHONE_WIDTH)
    await renderChat()
    const toggle = screen.getByRole('button', { name: CONVERSATIONS_BUTTON })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('region', { name: CONVERSATIONS })).toBeNull()
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('region', { name: CONVERSATIONS })).toHaveAttribute('id', toggle.getAttribute('aria-controls'))
  })
})
