// A voice session's words on HUD's core screen, on the kit's harness, which adds them as core's chat does: while the
// session runs on the conversation, what was heard and what Auto is saying are its last two messages (voice-live-user
// and voice-live-assistant). HUD draws them as any others, once each: on the desktop the transcript's newest YOU and
// AUTO rows, Auto's with the AI-generated mark; on the phone the last exchange, your words in quotes, sitting at the foot
// over the waveform while the session runs (HUD 1.1.1). They go once the session ends or the turn is saved, and the
// stored exchange is the newest again. Roles, names and attributes only;
// every word is made up.
import { act, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { host } from '@automatos/theme-harness/host'
import { HudChatPage } from '../../src/chat/hud-chat.tsx'
import { LAST_EXCHANGE_LABEL } from '../../src/chat/phone/phone-transcript.tsx'
import { CONVERSATION_LABEL } from '../../src/chat/transcript.tsx'
import { openChat, QUESTION, renderChat, reply, stubClips, yourRow } from '../chat/support.tsx'
import { PHONE_WIDTH, resetWindowWidth, setWindowWidth } from '../support/window-width.ts'

const HEARD = 'What needs me on the board today?'
const REPLY = 'Two cards are waiting for your approval.'

/** The session on the stored conversation c1 in `phase`, with what the member said and Auto's reply so far. */
function talk(phase: 'listening' | 'speaking', reply = ''): void {
  act(() => {
    host.setVoice({ chatId: 'c1', heard: HEARD, reply })
    host.setVoicePhase(phase)
  })
}

/** How many times `text` is drawn on the page: the words must show once, never twice. */
const timesShown = (text: string): number => screen.queryAllByText(text, { exact: false }).length

beforeEach(() => {
  host.reset()
  stubClips()
})

afterEach(() => {
  resetWindowWidth()
})

describe('on the desktop', () => {
  it("draws what was heard as the transcript's newest YOU row, once, and nothing before a word", async () => {
    await renderChat()
    act(() => {
      host.setVoice({ chatId: 'c1' })
      host.setVoicePhase('listening')
    })
    expect(yourRow()).toHaveTextContent(QUESTION)
    talk('listening')
    const list = screen.getByRole('list', { name: CONVERSATION_LABEL })
    expect(within(list).getAllByRole('article', { name: 'You said' }).map((row) => row.textContent)).toEqual([
      `You${QUESTION}`,
      `You${HEARD}`,
    ])
    expect(yourRow()).toHaveAttribute('data-recent', 'true')
    expect(timesShown(HEARD)).toBe(1)
  })

  it("draws Auto's spoken reply as the newest AUTO row, with the AI-generated mark, once", async () => {
    await renderChat()
    talk('speaking', REPLY)
    expect(reply()).toHaveTextContent(REPLY)
    expect(reply()).toHaveAttribute('data-ai-generated', 'true')
    expect(reply()).toHaveAttribute('data-recent', 'true')
    expect(reply()).toHaveAttribute('aria-busy', 'false')
    expect([timesShown(HEARD), timesShown(REPLY)]).toEqual([1, 1])
  })

  it('gives the rows back once the session ends, or once its turn is saved', async () => {
    await renderChat()
    talk('speaking', REPLY)
    act(() => host.setVoicePhase('idle'))
    expect([timesShown(HEARD), timesShown(REPLY)]).toEqual([0, 0])
    expect(yourRow()).toHaveTextContent(QUESTION)
    expect(yourRow()).toHaveAttribute('data-recent', 'true')
    talk('speaking', REPLY)
    expect(timesShown(REPLY)).toBe(1)
    act(() => host.voiceTurnSaved('c1'))
    expect([timesShown(HEARD), timesShown(REPLY)]).toEqual([0, 0])
  })
})

describe('on the phone', () => {
  it('makes the spoken exchange the last exchange, your words in quotes, and gives it back after', async () => {
    setWindowWidth(PHONE_WIDTH)
    openChat()
    render(<HudChatPage />)
    await screen.findByRole('article', { name: 'You said' })
    const exchange = screen.getByRole('region', { name: LAST_EXCHANGE_LABEL })
    talk('speaking', REPLY)
    expect(within(exchange).getByRole('article', { name: 'You said' })).toHaveTextContent(`“${HEARD}”`)
    const auto = within(exchange).getByRole('article', { name: 'Auto said' })
    expect(auto).toHaveTextContent(REPLY)
    expect(auto).toHaveAttribute('data-layout', 'phone')
    expect(auto).toHaveAttribute('data-ai-generated', 'true')
    expect(within(exchange).queryByText(QUESTION, { exact: false })).toBeNull()
    expect([timesShown(HEARD), timesShown(REPLY)]).toEqual([1, 1])
    act(() => host.setVoicePhase('idle'))
    expect(within(exchange).getByRole('article', { name: 'You said' })).toHaveTextContent(`“${QUESTION}”`)
    expect(timesShown(HEARD)).toBe(0)
  })

  it('sits the last exchange at the foot, over the waveform, while the session runs, and centres it again after (1.1.1)', async () => {
    setWindowWidth(PHONE_WIDTH)
    openChat()
    render(<HudChatPage />)
    await screen.findByRole('article', { name: 'You said' })
    const exchange = screen.getByRole('region', { name: LAST_EXCHANGE_LABEL })
    expect(exchange).not.toHaveAttribute('data-voice')
    talk('listening')
    expect(exchange).toHaveAttribute('data-voice', 'true')
    expect(within(exchange).getByRole('article', { name: 'You said' })).toHaveTextContent(`“${HEARD}”`)
    act(() => host.setVoicePhase('idle'))
    expect(exchange).not.toHaveAttribute('data-voice')
  })
})
