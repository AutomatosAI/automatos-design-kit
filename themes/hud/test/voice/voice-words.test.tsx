// What a voice session said aloud, on HUD's core screen on the kit's harness: once the host hears a word, the design's
// YOU row with it; while Auto answers, the AUTO row with his reply as far as he has spoken it, the design's block cursor
// and the AI-generated mark; nothing at rest, before a word is heard, or once the session ends (the turn lands in the
// conversation then). On the desktop the rows sit under the transcript, over the voice deck; on the phone they take the
// last exchange's place and give it back. Roles, names and attributes only; every word is made up.
import { act, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { host } from '@automatos/theme-harness/host'
import { HudChatPage } from '../../src/chat/hud-chat.tsx'
import { LAST_EXCHANGE_LABEL } from '../../src/chat/phone/phone-transcript.tsx'
import { CONVERSATION_LABEL } from '../../src/chat/transcript.tsx'
import { VOICE_DECK_LABEL } from '../../src/voice/voice-deck.tsx'
import { VOICE_WORDS_LABEL } from '../../src/voice/voice-words.tsx'
import { openChat, QUESTION, renderChat, stubClips } from '../chat/support.tsx'
import { PHONE_WIDTH, resetWindowWidth, setWindowWidth } from '../support/window-width.ts'

const HEARD = 'What needs me on the board today?'
const REPLY = 'Two cards are waiting for your approval.'

const aloud = (): HTMLElement | null => screen.queryByRole('region', { name: VOICE_WORDS_LABEL })

function said(): HTMLElement {
  const region = aloud()
  if (region === null) throw new Error('Nothing said aloud is shown.')
  return region
}

const following = (first: Node, second: Node): boolean => (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0

beforeEach(() => {
  host.reset()
  stubClips()
})

afterEach(() => {
  resetWindowWidth()
})

describe('on the desktop', () => {
  it('shows nothing at rest or before a word is heard, then what was heard as your row, under the transcript', async () => {
    await renderChat()
    expect(aloud()).toBeNull()
    act(() => host.setVoicePhase('listening'))
    expect(aloud()).toBeNull()
    act(() => host.setVoiceWords({ heard: HEARD }))
    const you = within(said()).getByRole('article', { name: 'You said' })
    expect(you).toHaveTextContent(HEARD)
    expect(you).toHaveAttribute('data-recent', 'true')
    expect(following(screen.getByRole('list', { name: CONVERSATION_LABEL }), said())).toBe(true)
    expect(following(said(), screen.getByRole('group', { name: VOICE_DECK_LABEL }))).toBe(true)
  })

  it("shows Auto's reply as far as he has spoken it, with the cursor while he answers and the AI-generated mark", async () => {
    await renderChat()
    act(() => {
      host.setVoiceWords({ heard: HEARD })
      host.setVoicePhase('thinking')
    })
    const thinking = within(said()).getByRole('article', { name: 'Auto said' })
    expect(thinking).toHaveAttribute('aria-busy', 'true')
    expect(thinking.querySelector('[data-hud-loop]')).toHaveAttribute('aria-hidden', 'true')
    act(() => {
      host.setVoicePhase('speaking')
      host.setVoiceWords({ reply: REPLY })
    })
    const auto = within(said()).getByRole('article', { name: 'Auto said' })
    expect(auto).toHaveTextContent(REPLY)
    expect(auto).toHaveAttribute('data-ai-generated', 'true')
    expect(within(said()).getByRole('article', { name: 'You said' })).toHaveTextContent(HEARD)
  })

  it('goes once the session ends, whatever words it kept: the turn lands in the conversation', async () => {
    await renderChat()
    act(() => {
      host.setVoicePhase('speaking')
      host.setVoiceWords({ heard: HEARD, reply: REPLY })
    })
    expect(aloud()).not.toBeNull()
    act(() => host.setVoicePhase('idle'))
    expect(aloud()).toBeNull()
  })
})

describe('on the phone', () => {
  it("takes the last exchange's place while the session has words, your words in quotes, and gives it back after", async () => {
    setWindowWidth(PHONE_WIDTH)
    openChat()
    render(<HudChatPage />)
    await screen.findByRole('article', { name: 'You said' })
    const exchange = screen.getByRole('region', { name: LAST_EXCHANGE_LABEL })
    act(() => {
      host.setVoicePhase('speaking')
      host.setVoiceWords({ heard: HEARD, reply: REPLY })
    })
    expect(exchange).toContainElement(said())
    expect(within(exchange).getByRole('article', { name: 'You said' })).toHaveTextContent(`“${HEARD}”`)
    expect(within(exchange).getByRole('article', { name: 'Auto said' })).toHaveAttribute('data-layout', 'phone')
    expect(within(exchange).queryByText(QUESTION, { exact: false })).toBeNull()
    act(() => host.setVoicePhase('idle'))
    expect(aloud()).toBeNull()
    expect(within(exchange).getByRole('article', { name: 'You said' })).toHaveTextContent(`“${QUESTION}”`)
  })
})
