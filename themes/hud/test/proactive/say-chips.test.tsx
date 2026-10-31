// HUD 1.3.0 (PRD-268, SDK 1.4.0): Auto's reply chips (a reply_chips@1 part) as HUD's SAY chips, on the harness's fake
// chat, whose stored messages carry the parts core keeps. Under Auto's last message only, never an earlier one; a tap
// sends the chip's words as your message, and then they are gone, a newer message existing; a refused send leaves them;
// each named "Reply: <chip>", its words Auto's; never spoken. At three, two and one columns in the transcript (not
// while BRIEFING stands in its slot), and on the phone in the last exchange. Roles, names and attributes only.
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { host } from '@automatos/theme-harness/host'
import { HudChatPage } from '../../src/chat/hud-chat.tsx'
import { LAST_EXCHANGE_LABEL } from '../../src/chat/phone/phone-transcript.tsx'
import { REPLIES_LABEL, REPLY_PREFIX } from '../../src/chat/thread/say-replies.tsx'
import { CONVERSATION_LABEL } from '../../src/chat/transcript.tsx'
import { HELD, openChat, renderChat, reply, stubClips, yourRow } from '../chat/support.tsx'
import { PHONE_WIDTH, resetWindowWidth, setWindowWidth } from '../support/window-width.ts'
import { ANSWER, chipsReply, CHIPS, CHIPS_THREAD } from './parts.ts'
import { BRIEF, ONE_COLUMN, screenWidth, THREE_COLUMNS, TWO_COLUMNS } from './support.ts'

const replies = (): HTMLElement | null => screen.queryByRole('group', { name: REPLIES_LABEL })
const chip = (words: string): HTMLElement => screen.getByRole('button', { name: `${REPLY_PREFIX}${words}` })
const conversation = (): HTMLElement => screen.getByRole('list', { name: CONVERSATION_LABEL })

beforeEach(() => {
  host.reset()
  stubClips()
})

afterEach(() => {
  resetWindowWidth()
})

describe('where the chips are', () => {
  it("sit under Auto's last message, the last thing in its row, after his words", async () => {
    await renderChat([], CHIPS_THREAD)
    const group = replies() as HTMLElement
    expect(reply()).toContainElement(group)
    expect(reply()).toHaveTextContent(ANSWER)
    const body = group.parentElement as HTMLElement
    expect(body.lastElementChild).toBe(group)
    expect(within(group).getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual(
      CHIPS.map((words) => `${REPLY_PREFIX}${words}`),
    )
  })

  it('are drawn on no earlier message, and not at all while your message is the newest', async () => {
    const earlier = chipsReply()
    await renderChat([], [{ role: 'user', text: 'First' }, earlier, { role: 'user', text: 'Never mind' }])
    expect(replies()).toBeNull()
    expect(screen.queryByRole('button', { name: `${REPLY_PREFIX}${CHIPS[0]}` })).toBeNull()
  })

  it.each<[string, number]>([
    ['three', THREE_COLUMNS],
    ['two', TWO_COLUMNS],
    ['one', ONE_COLUMN],
  ])('sit in the transcript at %s columns', async (columns, width) => {
    screenWidth(width)
    await renderChat([], CHIPS_THREAD)
    expect(document.querySelector('[data-columns]')).toHaveAttribute('data-columns', columns)
    expect(conversation()).toContainElement(replies())
  })

  it("are hidden with the transcript while BRIEFING stands in its slot at one column, and back once it folds", async () => {
    screenWidth(ONE_COLUMN)
    await renderChat([], CHIPS_THREAD)
    act(() => host.setPageQuery('useBrief', { data: BRIEF }))
    expect(replies()).toBeNull()
    fireEvent.pointerDown(document.body)
    expect(conversation()).toContainElement(replies())
  })

  it('sit in the last exchange on the phone, under Auto\'s reply', async () => {
    setWindowWidth(PHONE_WIDTH)
    openChat(CHIPS_THREAD)
    render(<HudChatPage />)
    await screen.findByRole('article', { name: 'You said' })
    const exchange = screen.getByRole('region', { name: LAST_EXCHANGE_LABEL })
    expect(within(exchange).getByRole('group', { name: REPLIES_LABEL })).toBeInTheDocument()
    expect(reply()).toContainElement(replies())
  })
})

describe('a tap', () => {
  it("sends the chip's words as your message, and then the chips are gone: a newer message exists", async () => {
    await renderChat([HELD], CHIPS_THREAD)
    fireEvent.click(chip(CHIPS[1]))
    expect(host.chatSent()).toEqual([{ chatId: 'c1', text: CHIPS[1], retry: false }])
    expect(yourRow()).toHaveTextContent(CHIPS[1])
    expect(replies()).toBeNull()
  })

  it('sends once for a double press, the same chip or the other one', async () => {
    await renderChat([HELD], CHIPS_THREAD)
    fireEvent.click(chip(CHIPS[0]))
    const again = screen.queryByRole('button', { name: `${REPLY_PREFIX}${CHIPS[0]}` })
    const other = screen.queryByRole('button', { name: `${REPLY_PREFIX}${CHIPS[1]}` })
    if (again) fireEvent.click(again)
    if (other) fireEvent.click(other)
    expect(host.chatSent()).toHaveLength(1)
    expect(host.chatSent()).toEqual([{ chatId: 'c1', text: CHIPS[0], retry: false }])
  })

  it('sends them on the phone too, where the newer message takes them away the same', async () => {
    setWindowWidth(PHONE_WIDTH)
    openChat(CHIPS_THREAD)
    host.setChatScript([HELD])
    render(<HudChatPage />)
    await screen.findByRole('article', { name: 'You said' })
    fireEvent.click(chip(CHIPS[0]))
    expect(host.chatSent()).toEqual([{ chatId: 'c1', text: CHIPS[0], retry: false }])
    expect(replies()).toBeNull()
  })

  it('leaves them as they were when the chat refuses the send', async () => {
    await renderChat([HELD], CHIPS_THREAD)
    act(() => host.setAiLabelShown(false))
    fireEvent.click(chip(CHIPS[0]))
    expect(host.chatSent()).toEqual([])
    expect(chip(CHIPS[0])).toBeEnabled()
    expect(chip(CHIPS[1])).toBeEnabled()
  })
})

describe('the chips', () => {
  it('are named "Reply: <chip>", show those words in quotes, and mark them as Auto\'s', async () => {
    await renderChat([], CHIPS_THREAD)
    for (const words of CHIPS) {
      const button = chip(words)
      expect(button).toHaveTextContent(`“${words}”`)
      expect(button.querySelector('[data-ai-generated="true"]')).toHaveTextContent(words)
    }
    expect(replies()).toHaveTextContent(/^Say/)
  })

  it('are never spoken: in no live region, and nothing asked of the host\'s voice when one is tapped', async () => {
    await renderChat([HELD], CHIPS_THREAD)
    const group = replies() as HTMLElement
    expect(group.closest('[aria-live], [role="status"], [role="alert"], [role="log"]')).toBeNull()
    expect(group.querySelector('[aria-live], [role="status"], [role="alert"]')).toBeNull()
    fireEvent.click(chip(CHIPS[0]))
    expect(host.voicePresses()).toEqual([])
    expect(host.voiceStops()).toBe(0)
  })
})
