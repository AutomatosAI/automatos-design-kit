// HUD's core screen on a phone: below the desktop width (src/lib/phone-layout.ts, through the stand-in matchMedia of
// test/support/window-width.ts) /chat is the design's phone screen on the harness's fake chat: the line naming who is
// at work (a running Mission's agent and its time, else Auto and his state), the core at the phone's size with the
// state chip and Pause Auto beside it, the last exchange (your words in quotes, Auto's reply), and the control row:
// TYPE opens the message box (focused, sending as on the desktop, keeping its words when shut), STOP stops a reply
// and is disabled while nothing runs, and the voice button's place between them draws nothing: no microphone, no
// waveform, no MIC LIVE. From 1024 px up the screen is the desktop's, and a window crossing the width keeps the
// conversation. Roles, names and attributes only; every value is made up.
import type { ActivityFeed } from '@automatos/theme-sdk'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { host } from '@automatos/theme-harness/host'
import { STOPPED_NOTICE } from '../../src/chat/auto-reply.tsx'
import { PLACEHOLDER } from '../../src/chat/composer.tsx'
import { EMPTY_LINE, STARTERS, STARTERS_LABEL } from '../../src/chat/empty-chat.tsx'
import { HudChatPage } from '../../src/chat/hud-chat.tsx'
import { AGENTS_TITLE } from '../../src/chat/panels/agents-panel.tsx'
import { RUNNING_MISSION } from '../../src/chat/panels/mission-panel.tsx'
import { CONTROLS_LABEL, STOP_LABEL, TYPE_LABEL } from '../../src/chat/phone/phone-controls.tsx'
import { LAST_EXCHANGE_LABEL } from '../../src/chat/phone/phone-transcript.tsx'
import { VoiceSlot } from '../../src/chat/phone/voice-slot.tsx'
import { CONVERSATION_LABEL } from '../../src/chat/transcript.tsx'
import { DESKTOP_WIDTH, PHONE_WIDTH, resetWindowWidth, setWindowWidth } from '../support/window-width.ts'
import { ASKED, core, HELD, openChat, QUESTION, stubClips, type StoredMessage, type Turn, words } from './support.tsx'

const exchange = (): HTMLElement => screen.getByRole('region', { name: LAST_EXCHANGE_LABEL })
const controls = (): HTMLElement => screen.getByRole('group', { name: CONTROLS_LABEL })
const typeButton = (): HTMLElement => within(controls()).getByRole('button', { name: TYPE_LABEL })
const stopButton = (): HTMLElement => within(controls()).getByRole('button', { name: STOP_LABEL })
const box = (): HTMLElement => screen.getByRole('textbox', { name: PLACEHOLDER })
const nudge = (): HTMLElement | null => document.querySelector<HTMLElement>('[data-protected-surface="first-run-nudge"]')
const chipOf = (): HTMLElement | null => core().querySelector<HTMLElement>('[aria-live="polite"]')

/** The stored conversation on a phone's screen, with the turns its next sends take, once your words show. */
async function renderPhoneChat(turns: readonly Turn[] = [], messages?: readonly StoredMessage[]) {
  setWindowWidth(PHONE_WIDTH)
  openChat(messages)
  host.setChatScript(turns)
  const view = render(<HudChatPage />)
  await screen.findByRole('article', { name: 'You said' })
  return view
}

/** Opens the box with TYPE and sends `text` with Enter. */
function typeAndSend(text: string): void {
  fireEvent.click(typeButton())
  fireEvent.change(box(), { target: { value: text } })
  fireEvent.keyDown(box(), { key: 'Enter' })
}

/** A Mission running now, as the activity feed lists it, its agent named and started `secondsAgo` before now. */
function runningMission(agentName: string, secondsAgo: number): ActivityFeed {
  return {
    items: [{
      id: 'run-1', type: 'mission', name: 'Laptop shortlist', status: 'running',
      started_at: new Date(Date.now() - secondsAgo * 1000).toISOString(), completed_at: null, duration_seconds: null,
      agent: { id: 7, name: agentName, avatar_url: null }, agents: [], summary: '', source_id: 'm-7', source_url: null,
      trigger: null, error_message: null,
    }],
    total: 1, limit: 1, offset: 0,
  }
}

beforeEach(() => {
  host.reset()
  stubClips()
})

afterEach(() => {
  resetWindowWidth()
})

describe('the phone core screen', () => {
  it("draws the design's phone: the line, the core at the phone's size, the last exchange and the controls, no panels", async () => {
    await renderPhoneChat()
    expect(screen.getByText('Auto · Ready')).toBeInTheDocument()
    expect(core()).toHaveAttribute('data-size', 'small')
    expect(within(exchange()).getByRole('article', { name: 'You said' })).toBeInTheDocument()
    expect(within(controls()).getAllByRole('button').map((button) => button.textContent)).toEqual([TYPE_LABEL, STOP_LABEL])
    expect(screen.queryByRole('region', { name: AGENTS_TITLE })).toBeNull()
    expect(screen.queryByRole('list', { name: CONVERSATION_LABEL })).toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: 'Laptop for uni' })).toHaveAttribute('data-theme-heading', 'true')
  })

  it("shows the last exchange: your newest words in quotes, then Auto's reply with the AI mark, not what came before", async () => {
    await renderPhoneChat([], [
      { role: 'user', text: 'Which shops first?' },
      { role: 'assistant', text: 'Two shops in town.' },
      { role: 'user', text: QUESTION },
      { role: 'assistant', text: 'Three laptops, compared.' },
    ])
    const you = within(exchange()).getByRole('article', { name: 'You said' })
    expect(you).toHaveTextContent(`“${QUESTION}”`)
    const auto = within(exchange()).getByRole('article', { name: 'Auto said' })
    expect(auto).toHaveTextContent('Three laptops, compared.')
    expect(auto).toHaveAttribute('data-ai-generated', 'true')
    expect(you.compareDocumentPosition(auto) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByText('Which shops first?')).toBeNull()
    expect(screen.queryByText('Two shops in town.')).toBeNull()
  })

  it("keeps Pause Auto beside the state chip, in the core, as on the desktop", async () => {
    await renderPhoneChat()
    const pause = within(core()).getByRole('button', { name: 'Pause Auto' })
    expect(pause.parentElement).toBe(chipOf()?.parentElement)
  })

  it("puts the host's first-run nudge under the line, over the core, clear of the controls", async () => {
    await renderPhoneChat()
    const anchor = nudge()
    if (anchor === null) throw new Error('No first-run nudge on the local edition.')
    expect(anchor.previousElementSibling).toHaveTextContent('Auto · Ready')
    expect(anchor.nextElementSibling).toContainElement(core())
    expect(controls().parentElement).not.toContainElement(anchor)
  })

  it("loads in the phone's core while the conversation opens, with nothing to type in", () => {
    setWindowWidth(PHONE_WIDTH)
    host.setChatOpening(true)
    render(<HudChatPage />)
    expect(core()).toHaveAttribute('data-state', 'loading')
    expect(core()).toHaveAttribute('data-size', 'small')
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('group', { name: CONTROLS_LABEL })).toBeNull()
  })
})

describe('TYPE', () => {
  it('opens the message box and puts the focus in it, and the words you send go out and show', async () => {
    await renderPhoneChat([{ frames: [words('Here you go.')], hold: true }])
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(typeButton()).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(typeButton())
    expect(typeButton()).toHaveAttribute('aria-expanded', 'true')
    expect(box()).toHaveFocus()
    expect(document.getElementById(typeButton().getAttribute('aria-controls') ?? '')).toContainElement(box())
    fireEvent.change(box(), { target: { value: ASKED } })
    fireEvent.keyDown(box(), { key: 'Enter' })
    expect(host.chatSent()).toEqual([{ chatId: 'c1', text: ASKED, retry: false }])
    expect(within(exchange()).getByRole('article', { name: 'You said' })).toHaveTextContent(`“${ASKED}”`)
    await waitFor(() => expect(within(exchange()).getByRole('article', { name: 'Auto said' })).toHaveTextContent('Here you go.'))
  })

  it('shuts the box again, keeping its words for when it opens next', async () => {
    await renderPhoneChat()
    fireEvent.click(typeButton())
    fireEvent.change(box(), { target: { value: 'Half a thought' } })
    fireEvent.click(typeButton())
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(typeButton()).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(typeButton())
    expect(box()).toHaveValue('Half a thought')
  })

  it("opens with a new chat's starter in it: the chat says how to start, and a starter fills the box", async () => {
    setWindowWidth(PHONE_WIDTH)
    render(<HudChatPage />)
    expect(await screen.findByText(EMPTY_LINE)).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).toBeNull()
    host.setChatScript([HELD])
    fireEvent.click(within(screen.getByRole('list', { name: STARTERS_LABEL })).getByRole('button', { name: STARTERS[0] }))
    expect(box()).toHaveValue(STARTERS[0])
    expect(box()).toHaveFocus()
    fireEvent.keyDown(box(), { key: 'Enter' })
    expect(host.chatSent()).toEqual([{ chatId: null, text: STARTERS[0], retry: false }])
  })
})

describe('STOP', () => {
  it('is disabled while nothing runs, stops the reply, keeping what Auto wrote, and hands the focus to TYPE', async () => {
    await renderPhoneChat([{ frames: [words('I am still writing')], hold: true }])
    expect(stopButton()).toBeDisabled()
    typeAndSend(ASKED)
    await waitFor(() => expect(within(exchange()).getByRole('article', { name: 'Auto said' })).toHaveTextContent('I am still writing'))
    fireEvent.click(typeButton())
    expect(stopButton()).toBeEnabled()
    fireEvent.click(stopButton())
    const auto = within(exchange()).getByRole('article', { name: 'Auto said' })
    expect(within(auto).getByText(STOPPED_NOTICE)).toBeInTheDocument()
    expect(auto).toHaveTextContent('I am still writing')
    expect(stopButton()).toBeDisabled()
    expect(typeButton()).toHaveFocus()
  })
})

describe('the line', () => {
  it("asks for the Mission running now, and names its agent, working, with the time since it started", async () => {
    await renderPhoneChat()
    expect(host.pageAsks()).toContainEqual({ hook: 'useActivityFeed', args: [RUNNING_MISSION] })
    expect(screen.getByText('Auto · Ready')).toBeInTheDocument()
    act(() => host.setPageQuery('useActivityFeed', { data: runningMission('Researcher', 134) }))
    const line = screen.getByText('Researcher · Working').parentElement
    const time = line?.querySelector('time')
    expect(time?.textContent).toMatch(/^02:1\d$/)
    expect(time?.getAttribute('dateTime')).toMatch(/^PT\d+S$/)
  })
})

describe('the voice controls', () => {
  it("are not drawn: the voice button's place renders nothing", () => {
    const { container } = render(<VoiceSlot />)
    expect(container).toBeEmptyDOMElement()
  })

  it('leave TYPE and STOP alone in the row, with no talk or mic control, no waveform and no MIC LIVE', async () => {
    await renderPhoneChat()
    const row = controls()
    expect(within(row).getAllByRole('button')).toHaveLength(2)
    expect(row.firstElementChild).toBe(typeButton())
    expect(row.lastElementChild).toBe(stopButton())
    expect(screen.queryByRole('button', { name: /talk|mic|voice|speak/i })).toBeNull()
    expect(screen.queryByText(/mic live|hold to talk/i)).toBeNull()
  })
})

describe('the desktop', () => {
  it("is the core screen from 1024 px up, untouched, and a window crossing the width keeps the conversation", async () => {
    setWindowWidth(DESKTOP_WIDTH)
    openChat()
    render(<HudChatPage />)
    await screen.findByRole('list', { name: CONVERSATION_LABEL })
    expect(screen.getByRole('region', { name: AGENTS_TITLE })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: CONTROLS_LABEL })).toBeNull()
    expect(core()).toHaveAttribute('data-size', 'large')
    act(() => setWindowWidth(PHONE_WIDTH))
    expect(within(exchange()).getByRole('article', { name: 'You said' })).toHaveTextContent(`“${QUESTION}”`)
    expect(screen.queryByRole('region', { name: AGENTS_TITLE })).toBeNull()
    act(() => setWindowWidth(DESKTOP_WIDTH))
    expect(screen.getByRole('list', { name: CONVERSATION_LABEL })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: CONTROLS_LABEL })).toBeNull()
  })
})
