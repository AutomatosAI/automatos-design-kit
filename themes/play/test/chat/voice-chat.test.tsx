// Play 1.2.0 — talking to Auto by voice in Play's chat, on the kit's harness (its stand-ins for the SDK's voice area:
// VoiceButton, useVoice and readVoiceLevels, driven through host.setVoicePhase and the rest). The host's voice button
// stands in the message box beside Send, held to talk (press hold), Live when the workspace has it else quick-ask
// (mode auto), with the Space hotkey; its presses reach the host, and while the session is its own core's caption and
// stop control show under it. Typing stays: the box and Send work while voice runs. Auto follows the session: he
// listens while the microphone is open, thinks, then speaks (his calm clip, his ring following his voice), and goes
// back to the chat's state when it ends. The words it heard and spoke are the conversation's last two messages while it
// runs, as core's chat (and the harness) adds them, so Play draws them once, as your message and Auto's reply, and
// nothing of its own over the message box. On a
// phone (Play 1.2.0's phone layout, a 390 px window through test/support/window-width.ts) the button has no hotkey,
// and Auto stands at his small size beside his caption over the message box, where the desktop gives him a column.
// Auto himself is a stand-in that shows his state, his size, his caption and whether he speaks. Roles, attributes
// and text only.
import { type VoiceButtonProps, writeThemeState } from '@automatos/theme-sdk'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AutoMascotProps } from '../../src/components/mascot/auto-mascot.tsx'
import { PLACEHOLDER, VOICE_HOTKEY } from '../../src/components/play/chat/message-box.tsx'
import { PlayChat } from '../../src/components/play/chat/play-chat.tsx'
import { HELLO_KEY, HELLO_STATE } from '../../src/lib/mascot/session.ts'
import { CONNECTING_CAPTION, SPEAKING_CAPTION } from '../../src/lib/voice/voice-pose.ts'
import { host } from '@automatos/theme-harness/host'
import { PHONE_WIDTH, resetWindowWidth, setWindowWidth } from '../support/window-width.ts'

/** Every VoiceButton Play renders, by its props, as it hands them to the SDK. */
const voiceButtons = vi.hoisted(() => ({ props: [] as unknown[] }))

vi.mock('@automatos/theme-sdk', async (importOriginal) => {
  const sdk = await importOriginal<typeof import('@automatos/theme-sdk')>()
  const { createElement } = await import('react')
  return {
    ...sdk,
    VoiceButton: (props: VoiceButtonProps) => {
      voiceButtons.props.push(props)
      return createElement(sdk.VoiceButton, props)
    },
  }
})

// Auto as his state, his size, his caption and whether he speaks.
vi.mock('../../src/components/mascot/auto-mascot.tsx', async () => {
  const { createElement } = await import('react')
  type Shown = Pick<AutoMascotProps, 'state' | 'caption' | 'detail' | 'speaking' | 'size'>
  return {
    AutoMascot: ({ state, caption, detail, speaking, size }: Shown) =>
      createElement(
        'div',
        { 'data-testid': 'auto', 'data-state': state, 'data-size': size ?? 'regular', 'data-speaking': String(speaking ?? false) },
        caption,
        ' ',
        detail,
      ),
  }
})

const HOLD_TO_TALK = 'Hold to talk'
const ROOT = '[data-voice-button="root"]'
const AI_VOICE_CAPTION = 'AI voice assistant'
const HEARD = 'What is on the board today'
const REPLY = 'Three cards wait for you'

const auto = () => screen.getByTestId('auto')
const box = () => screen.getByRole('textbox', { name: PLACEHOLDER })
const press = () => screen.getByRole('button', { name: HOLD_TO_TALK })
const rootOf = (element: HTMLElement): Element | null => element.closest(ROOT)
const lastProps = (): unknown => voiceButtons.props[voiceButtons.props.length - 1]

/** The stored conversation c1 on screen through its ?chatId= link, its messages listed. */
async function renderConversation() {
  host.setConversations([
    {
      id: 'c1',
      title: 'Laptop for uni',
      updatedAt: '2026-10-14T09:00:00+00:00',
      preview: null,
      messages: [
        { role: 'user', text: 'What should I look for in a laptop?' },
        { role: 'assistant', text: 'Aim for **16 GB of memory**.' },
      ],
    },
  ])
  host.setSearchParams('chatId=c1')
  render(<PlayChat />)
  await screen.findByRole('list', { name: 'Conversation' })
}

beforeEach(() => {
  host.reset()
  voiceButtons.props.length = 0
  writeThemeState(HELLO_KEY, true, HELLO_STATE) // hello already played this session
})

afterEach(() => {
  resetWindowWidth()
})

describe('the voice button in the message box', () => {
  it('stands in the box, after the words and before Send', () => {
    render(<PlayChat />)
    const form = box().closest('form')
    if (form === null) throw new Error('The message box is not a form.')
    const voice = within(form).getByRole('button', { name: HOLD_TO_TALK })
    const send = within(form).getByRole('button', { name: 'Send' })
    expect(box().compareDocumentPosition(voice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(voice.compareDocumentPosition(send) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('is mode auto, held to talk, with the Space hotkey, at its middle size, talking into the conversation on screen', () => {
    render(<PlayChat />)
    expect(VOICE_HOTKEY).toBe('Space')
    expect(lastProps()).toEqual({ mode: 'auto', press: 'hold', hotkey: 'Space', size: 'md' })
    expect(rootOf(press())).toHaveAttribute('data-voice-press', 'hold')
  })

  it('starts Live where the workspace has it, else quick-ask, as mode auto does', () => {
    render(<PlayChat />)
    expect(rootOf(press())).toHaveAttribute('data-voice-mode', 'quick')
    act(() => host.setVoiceAvailable({ live: true, reason: null }))
    expect(rootOf(press())).toHaveAttribute('data-voice-mode', 'live')
  })

  it("reaches the host when held, and shows core's caption and stop control while the session is its own", () => {
    render(<PlayChat />)
    fireEvent.pointerDown(press())
    expect(host.voicePresses()).toEqual([{ action: 'start', mode: 'quick', chatId: null }])
    expect(rootOf(press())).toHaveAttribute('data-voice-mic', 'open')
    expect(screen.getByRole('note', { name: AI_VOICE_CAPTION })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(host.voiceStops()).toBe(1)
    expect(screen.queryByRole('note', { name: AI_VOICE_CAPTION })).toBeNull()
  })

  it('stays on, as do the words and Send: no AI label locks the chat, and Send with no host label sends nothing', () => {
    host.setAiLabelShown(false)
    render(<PlayChat />)
    expect(box()).toBeEnabled()
    fireEvent.change(box(), { target: { value: 'Plan my week' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(host.chatSent()).toEqual([])
    expect(box()).toHaveValue('Plan my week')
    expect(press()).toBeEnabled()
    fireEvent.pointerDown(press())
    expect(host.voicePresses()).toHaveLength(1)
  })

  it('locks nothing: the words and Send work while the microphone is open', () => {
    host.setChatScript([{ frames: [], hold: true }])
    render(<PlayChat />)
    act(() => host.setVoicePhase('listening'))
    expect(box()).toBeEnabled()
    fireEvent.change(box(), { target: { value: 'Plan my week' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(host.chatSent()).toEqual([{ chatId: null, text: 'Plan my week', retry: false }])
  })
})

describe('Auto following the voice session', () => {
  it('listens while the microphone is open, thinks, speaks with his ring following his voice, then is the chat\'s again', async () => {
    await renderConversation()
    expect(auto()).toHaveAttribute('data-state', 'idle')
    act(() => host.setVoicePhase('listening'))
    expect([auto().dataset.state, auto().dataset.speaking]).toEqual(['listening', 'false'])
    expect(auto()).toHaveTextContent('Listening')
    act(() => host.setVoicePhase('thinking'))
    expect([auto().dataset.state, auto().dataset.speaking]).toEqual(['thinking', 'false'])
    expect(auto()).toHaveTextContent('Thinking')
    act(() => host.setVoicePhase('speaking'))
    expect([auto().dataset.state, auto().dataset.speaking]).toEqual(['idle', 'true'])
    expect(auto()).toHaveTextContent(SPEAKING_CAPTION)
    act(() => host.setVoicePhase('idle'))
    expect([auto().dataset.state, auto().dataset.speaking]).toEqual(['idle', 'false'])
    expect(auto()).toHaveTextContent('Ready when you are')
  })

  it('waits for the microphone while connecting, and listens once it is open', async () => {
    await renderConversation()
    act(() => host.setVoice({ phase: 'connecting', mode: 'quick', micOpen: false }))
    expect(auto()).toHaveAttribute('data-state', 'loading')
    expect(auto()).toHaveTextContent(CONNECTING_CAPTION)
    act(() => host.setVoiceMic(true))
    expect(auto()).toHaveAttribute('data-state', 'listening')
  })

  it("follows the phase on a Live call, whose microphone is open all along, and is his oops when it fails", async () => {
    await renderConversation()
    act(() => host.setVoicePhase('speaking', 'live'))
    expect([auto().dataset.state, auto().dataset.speaking]).toEqual(['idle', 'true'])
    act(() => host.setVoicePhase('thinking', 'live'))
    expect(auto()).toHaveAttribute('data-state', 'thinking')
    act(() => host.setVoiceError('The microphone stopped.'))
    expect(auto()).toHaveAttribute('data-state', 'oops')
    act(() => host.setVoicePhase('ended', 'live'))
    expect(auto()).toHaveAttribute('data-state', 'idle')
  })

  it("follows the session on the first open too, with his caption showing over the headline's silence", () => {
    render(<PlayChat />)
    act(() => host.setVoicePhase('listening'))
    expect(auto()).toHaveAttribute('data-state', 'listening')
    act(() => host.setVoicePhase('speaking'))
    expect(auto()).toHaveAttribute('data-speaking', 'true')
  })
})

describe("the session's words in the conversation", () => {
  const conversation = () => screen.getByRole('list', { name: 'Conversation' })
  const lastItems = () => within(conversation()).getAllByRole('listitem').slice(-2)
  /** How many times `text` is drawn on the page: the words show once, never twice. */
  const timesShown = (text: string): number => screen.queryAllByText(text, { exact: false }).length

  /** The session on the stored conversation c1 in `phase`, with what the member said and Auto's reply so far. */
  function talk(phase: 'listening' | 'speaking', reply = ''): void {
    act(() => {
      host.setVoice({ chatId: 'c1', heard: HEARD, reply })
      host.setVoicePhase(phase)
    })
  }

  it('are its last messages while the session runs: yours as your message is drawn, then his as his reply, once', async () => {
    await renderConversation()
    talk('listening')
    const items = within(conversation()).getAllByRole('listitem')
    expect(items[items.length - 1]).toHaveTextContent(HEARD)
    expect(timesShown(HEARD)).toBe(1)
    talk('speaking', REPLY)
    const [yours, his] = lastItems()
    expect(yours).toHaveTextContent(HEARD)
    expect(his).toHaveTextContent(REPLY)
    expect(within(his).getByRole('article', { name: 'Auto said' })).toBeInTheDocument()
    expect(within(conversation()).getByText(REPLY).closest('[data-ai-generated]')).toHaveAttribute('data-ai-generated', 'true')
    expect([timesShown(HEARD), timesShown(REPLY)]).toEqual([1, 1])
  })

  it('draw nothing over the message box: the box follows the conversation, and the words are in it', async () => {
    await renderConversation()
    talk('speaking', REPLY)
    const reply = within(conversation()).getByText(REPLY)
    expect(reply.compareDocumentPosition(box()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByRole('group', { name: 'Voice' })).toBeNull()
  })

  it('go once the session ends or its turn is saved', async () => {
    await renderConversation()
    talk('speaking', REPLY)
    act(() => host.setVoicePhase('idle'))
    expect([timesShown(HEARD), timesShown(REPLY)]).toEqual([0, 0])
    talk('speaking', REPLY)
    act(() => host.voiceTurnSaved('c1'))
    expect([timesShown(HEARD), timesShown(REPLY)]).toEqual([0, 0])
    // The saved reply is the conversation's own again (the harness's MarkdownView shows its source).
    expect(lastItems()[1]).toHaveTextContent('Aim for **16 GB of memory**.')
  })
})

describe('on a phone', () => {
  beforeEach(() => {
    setWindowWidth(PHONE_WIDTH)
    host.setMinWidth(360)
    host.setWidth(PHONE_WIDTH)
  })

  it('gives the voice button no hotkey, there being no keyboard to hold, and keeps it beside Send', () => {
    render(<PlayChat />)
    expect(lastProps()).toEqual({ mode: 'auto', press: 'hold', hotkey: null, size: 'md' })
    const form = box().closest('form')
    if (form === null) throw new Error('The message box is not a form.')
    expect(within(form).getAllByRole('button').map((button) => button.getAttribute('aria-label') ?? button.textContent)).toEqual([
      HOLD_TO_TALK,
      'Send',
    ])
  })

  it('draws Auto at his small size beside his caption over the message box, with no mascot column', async () => {
    await renderConversation()
    expect(screen.queryByRole('complementary', { name: 'Auto' })).toBeNull()
    expect(screen.getAllByTestId('auto')).toHaveLength(1)
    expect(auto()).toHaveAttribute('data-size', 'small')
    expect(auto().compareDocumentPosition(box()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByRole('list', { name: 'Conversation' }).compareDocumentPosition(auto()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('has Auto there follow the voice session, as in his column', async () => {
    await renderConversation()
    act(() => host.setVoicePhase('listening'))
    expect(auto()).toHaveAttribute('data-state', 'listening')
    act(() => host.setVoicePhase('speaking'))
    expect([auto().dataset.state, auto().dataset.speaking, auto().dataset.size]).toEqual(['idle', 'true', 'small'])
  })
})
