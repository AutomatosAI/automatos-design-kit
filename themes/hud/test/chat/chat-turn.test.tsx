// A turn on HUD's core screen, on the harness's fake chat controller (recorded turns, a frame per tick): your words
// go out and show as a YOU row, Auto's reply streams into an AUTO row with the design's block cursor, Stop (the
// button, or Esc in the box) keeps what he wrote and says so, his reply carries the host's AI-generated mark, the
// message box keeps the keyboard rules (Enter sends, Shift+Enter is a new line, a composition is never cut short,
// an empty box sends nothing), and the screen names its parts for a screen reader. No microphone is drawn: the SDK
// offers a theme no voice. Roles, names and attributes only.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { host } from '@automatos/theme-harness/host'
import { STOPPED_NOTICE } from '../../src/chat/auto-reply.tsx'
import { KEYS_HINT, SEND, STOP } from '../../src/chat/composer.tsx'
import { HudChatPage } from '../../src/chat/hud-chat.tsx'
import { EMPTY_LINE } from '../../src/chat/empty-chat.tsx'
import { CONVERSATION_LABEL } from '../../src/chat/transcript.tsx'
import {
  ASKED, ask, box, core, HELD, QUESTION, renderChat, reply, streamEnds, stubClips, words, yourRow,
} from './support.tsx'

const HERE = 'Here is your'
const SHORTLIST = ' shortlist.'
const cursorOf = (row: HTMLElement): Element | null => row.querySelector('[data-hud-loop]')

beforeEach(() => {
  host.reset()
  stubClips()
})

describe('a turn', () => {
  it("sends your words, shows them as your row, then streams Auto's reply with the cursor until it ends", async () => {
    await renderChat([{ frames: [words(HERE)], hold: true }])
    ask()
    expect(host.chatSent()).toEqual([{ chatId: 'c1', text: ASKED, retry: false }])
    expect(yourRow()).toHaveTextContent(ASKED)
    await waitFor(() => expect(reply()).toHaveTextContent(HERE))
    expect(reply()).toHaveAttribute('aria-busy', 'true')
    expect(cursorOf(reply())).not.toBeNull()
    expect(screen.getByRole('button', { name: STOP })).toBeInTheDocument()

    act(() => host.continueHeldTurn({ frames: [words(SHORTLIST)] }))
    await screen.findByRole('button', { name: SEND })
    expect(reply()).toHaveTextContent(`${HERE}${SHORTLIST}`)
    expect(reply()).toHaveAttribute('aria-busy', 'false')
    expect(cursorOf(reply())).toBeNull()
  })

  it('opens a new chat that says how to start, with no transcript list until something is said, and focuses the box', async () => {
    render(<HudChatPage />)
    expect(await screen.findByText(EMPTY_LINE)).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: CONVERSATION_LABEL })).toBeNull()
    expect(box()).toHaveFocus()
    host.setChatScript([HELD])
    ask(QUESTION)
    expect(host.chatSent()).toEqual([{ chatId: null, text: QUESTION, retry: false }])
    expect(screen.queryByText(EMPTY_LINE)).toBeNull()
    expect(screen.getByRole('list', { name: CONVERSATION_LABEL })).toBeInTheDocument()
  })

  it('holds the board lane open while the page is on screen, as the Studio chat does', async () => {
    const view = await renderChat()
    expect(host.boardStreams()).toBe(1)
    view.unmount()
    expect(host.boardStreams()).toBe(0)
  })
})

describe('Stop', () => {
  it("keeps what Auto wrote, says you stopped it, gives Send back and puts the focus in the box", async () => {
    await renderChat([{ frames: [words('I am still writing')], hold: true }])
    ask()
    await waitFor(() => expect(reply()).toHaveTextContent('I am still writing'))
    fireEvent.click(screen.getByRole('button', { name: STOP }))
    expect(within(reply()).getByText(STOPPED_NOTICE)).toBeInTheDocument()
    expect(reply()).toHaveTextContent('I am still writing')
    expect(screen.getByRole('button', { name: SEND })).toBeInTheDocument()
    expect(box()).toHaveFocus()
  })

  it('is Esc in the box while Auto answers, and Esc does nothing once he is done', async () => {
    await renderChat([{ frames: [words('Half an answer')], hold: true }])
    ask()
    await waitFor(() => expect(reply()).toHaveTextContent('Half an answer'))
    fireEvent.keyDown(box(), { key: 'Escape' })
    expect(within(reply()).getByText(STOPPED_NOTICE)).toBeInTheDocument()
    fireEvent.keyDown(box(), { key: 'Escape' })
    expect(screen.getAllByText(STOPPED_NOTICE)).toHaveLength(1)
  })
})

describe("the host's AI-generated mark", () => {
  it('is on every reply of Auto, while it streams and once it is done, and never on your row', async () => {
    await renderChat([{ frames: [words(HERE)], hold: true }], [
      { role: 'user', text: QUESTION },
      { role: 'assistant', text: 'Three laptops, compared.' },
    ])
    expect(reply()).toHaveAttribute('data-ai-generated', 'true')
    ask()
    await waitFor(() => expect(reply()).toHaveTextContent(HERE))
    expect(reply()).toHaveAttribute('data-ai-generated', 'true')
    expect(screen.getAllByRole('article', { name: 'Auto said' }).every((row) => row.getAttribute('data-ai-generated') === 'true')).toBe(true)
    expect(yourRow()).not.toHaveAttribute('data-ai-generated')
  })
})

describe('the message box', () => {
  it('sends on Enter, adds a line on Shift+Enter, and never cuts a composition short', async () => {
    await renderChat([HELD])
    fireEvent.change(box(), { target: { value: 'Two lines' } })
    fireEvent.keyDown(box(), { key: 'Enter', shiftKey: true })
    fireEvent.keyDown(box(), { key: 'Enter', isComposing: true })
    expect(host.chatSent()).toEqual([])
    fireEvent.keyDown(box(), { key: 'Enter' })
    expect(host.chatSent().map((sent) => sent.text)).toEqual(['Two lines'])
    expect(box()).toHaveValue('')
  })

  it('sends nothing while empty: Send is disabled and Enter does nothing', async () => {
    await renderChat([HELD])
    expect(screen.getByRole('button', { name: SEND })).toBeDisabled()
    fireEvent.change(box(), { target: { value: '   ' } })
    fireEvent.keyDown(box(), { key: 'Enter' })
    expect(host.chatSent()).toEqual([])
  })

  it('keeps your words when the chat sends nothing (a turn still ending)', async () => {
    await renderChat([HELD])
    host.setTurnEnding(true)
    ask()
    expect(host.chatSent()).toEqual([])
    expect(box()).toHaveValue(ASKED)
  })

  it('sends with the Send button too, and the focus goes back to the box', async () => {
    await renderChat([HELD])
    fireEvent.change(box(), { target: { value: ASKED } })
    fireEvent.click(screen.getByRole('button', { name: SEND }))
    expect(host.chatSent().map((sent) => sent.text)).toEqual([ASKED])
    expect(box()).toHaveFocus()
  })
})

describe('for a screen reader', () => {
  it('names the transcript, its rows, the core, the chip, the box and its keys, and the heading the host focuses', async () => {
    await renderChat()
    expect(screen.getByRole('list', { name: CONVERSATION_LABEL })).toBeInTheDocument()
    expect(yourRow()).toHaveTextContent(QUESTION)
    expect(within(core()).getByText('Ready when you are')).toHaveAttribute('aria-live', 'polite')
    expect(within(core()).getByRole('img', { name: 'Auto: Ready when you are' })).toBeInTheDocument()
    expect(box()).toHaveAccessibleDescription(KEYS_HINT)
    const hint = document.getElementById(box().getAttribute('aria-describedby') ?? '')
    const parts = [...(hint?.querySelectorAll('span') ?? [])].map((part) => part.textContent)
    expect(parts).toEqual(KEYS_HINT.split(' · '))
    expect(screen.getByRole('heading', { level: 1, name: 'Laptop for uni' })).toHaveAttribute('data-theme-heading', 'true')
  })

  it('draws no microphone: no talk or mic control, and no MIC LIVE', async () => {
    await renderChat()
    expect(screen.queryByRole('button', { name: /talk|mic|voice|speak/i })).toBeNull()
    expect(screen.queryByText(/mic live|hold to talk/i)).toBeNull()
  })

  it('hides the rings from assistive technology and marks every loop for the motion knob', async () => {
    await renderChat()
    const rings = core().querySelectorAll('[data-hud-loop]')
    expect(rings.length).toBe(6)
    rings.forEach((ring) => expect(ring.closest('[aria-hidden="true"]')).not.toBeNull())
  })
})

describe('the turn ending', () => {
  it('goes back to Send a tick after the last frame', async () => {
    await renderChat([{ frames: [words('Done.')] }])
    ask()
    await waitFor(() => expect(reply()).toHaveTextContent('Done.'))
    await streamEnds()
    expect(screen.getByRole('button', { name: SEND })).toBeInTheDocument()
  })
})
