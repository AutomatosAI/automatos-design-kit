// Play 1.4.0 (PRD-268 §6.5.1, §6.6, §6.12.3, §6.12.4, US-K01; SDK 1.4.0) — what a conversation's messages carry
// beside their words, on the harness's fake chat: a stored message's `parts` are its knownParts. Auto's reply chips
// (`reply_chips@1`) under his last message, sent as the person's message through the message box's own send
// (host.chatSent()); the suggestions he posted (`suggestion@1`) as the host's SuggestionCard under his message (the
// harness's stand-in: an article named "Auto suggests: <title>", its Start and Hide the fake area's, host.pageRuns()),
// and the line pinned above the message box skipping them. At 1440 and on the phone (below 1024 px). Auto himself is a
// stand-in that shows his state.
import { writeThemeState } from '@automatos/theme-sdk'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AutoMascotProps } from '../../src/components/mascot/auto-mascot.tsx'
import { PLACEHOLDER } from '../../src/components/play/chat/message-box.tsx'
import { PlayChat } from '../../src/components/play/chat/play-chat.tsx'
import { REPLIES_LABEL, REPLY_PREFIX } from '../../src/components/play/proactive/reply-chips.tsx'
import { HELLO_KEY, HELLO_STATE } from '../../src/lib/mascot/session.ts'
import { host } from '@automatos/theme-harness/host'
import { BRIEF, LISTED, NEWER, NEWER_ID, SUGGESTIONS } from '../support/proactive.ts'
import { PHONE_WIDTH, resetWindowWidth, setWindowWidth } from '../support/window-width.ts'

vi.mock('../../src/components/mascot/auto-mascot.tsx', async () => {
  const { createElement } = await import('react')
  return {
    AutoMascot: ({ state }: Pick<AutoMascotProps, 'state'>) => createElement('div', { 'data-testid': 'auto', 'data-state': state }),
  }
})

type StoredChat = Parameters<typeof host.setConversations>[0][number]
type StoredMessage = NonNullable<StoredChat['messages']>[number]
type Turn = Parameters<typeof host.setChatScript>[0][number]

const CHAT_ID = 'c1'
const UPDATED = '2026-10-14T09:00:00+00:00'
const QUESTION = 'Book me a seat on the Friday train'
const ASKED = 'Window or aisle?'
const CHIPS = ['Window', 'Aisle'] as const
const POSTED = 'Here is something I can take off your plate.'
const STARTED_LINE = 'Started. Auto is on it.'
const ANSWER_TURN: Turn = { frames: [{ text: 'Window it is.' }] }

const asked: StoredMessage = {
  role: 'assistant',
  text: ASKED,
  parts: [{ type: 'text', text: ASKED }, { type: 'reply_chips@1', replies: [...CHIPS] }],
}
const posted = (id: string = NEWER_ID): StoredMessage => ({
  role: 'assistant',
  text: POSTED,
  parts: [{ type: 'text', text: POSTED }, { type: 'suggestion@1', suggestion_id: id }],
})
const briefMessage: StoredMessage = {
  role: 'assistant',
  text: BRIEF.prose,
  parts: [{ type: 'text', text: BRIEF.prose }, { type: 'brief@1', brief: BRIEF }],
}

const suggests = (title: string): string => `Auto suggests: ${title}`
const box = () => screen.getByRole('textbox', { name: PLACEHOLDER })
const chips = () => screen.queryByRole('group', { name: REPLIES_LABEL })
const pinned = (title: string) => screen.queryByRole('group', { name: suggests(title) })
const threadCard = (title: string) => screen.queryByRole('article', { name: suggests(title) })

/** True when `first` comes before `second` in the document. */
function before(first: Element, second: Element): boolean {
  return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)
}

/** The stored conversation c1 on screen through its ?chatId= link, its messages listed, its next send answered. */
async function openStored(messages: readonly StoredMessage[]) {
  host.setConversations([{ id: CHAT_ID, title: 'Trip', updatedAt: UPDATED, preview: null, messages }])
  host.setSearchParams(`chatId=${CHAT_ID}`)
  host.setChatScript([ANSWER_TURN])
  render(<PlayChat />)
  return screen.findByRole('list', { name: 'Conversation' })
}

function onThePhone() {
  setWindowWidth(PHONE_WIDTH)
  host.setMinWidth(360)
  host.setWidth(PHONE_WIDTH)
}

/** The layouts each placement holds on: the desktop's, and the phone's. */
const LAYOUTS: ReadonlyArray<readonly [string, () => void]> = [
  ['at 1440', () => undefined],
  ['on the phone (below 1024 px)', onThePhone],
]

beforeEach(() => {
  host.reset()
  writeThemeState(HELLO_KEY, true, HELLO_STATE)
  host.setPageQuery('useSuggestions', { data: SUGGESTIONS })
})

afterEach(() => {
  resetWindowWidth()
})

describe("Auto's reply chips", () => {
  it.each(LAYOUTS)('stand under his last message, in its item, before the message box (%s)', async (_name, layout) => {
    layout()
    const list = await openStored([{ role: 'user', text: QUESTION }, asked])
    const group = chips() as HTMLElement
    expect(group).not.toBeNull()
    expect(within(list).getAllByRole('group', { name: REPLIES_LABEL })).toHaveLength(1)
    const item = group.closest('li') as HTMLElement
    const reply = within(item).getByRole('article', { name: 'Auto said' })
    expect(within(reply).getByText(ASKED)).toBeInTheDocument()
    expect(before(reply, group)).toBe(true)
    expect(before(group, box())).toBe(true)
  })

  it("are named 'Reply: <chip>', each carrying data-ai-generated", async () => {
    await openStored([{ role: 'user', text: QUESTION }, asked])
    const buttons = within(chips() as HTMLElement).getAllByRole('button')
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual(CHIPS.map((chip) => `${REPLY_PREFIX}${chip}`))
    expect(buttons.map((button) => button.getAttribute('data-ai-generated'))).toEqual(['true', 'true'])
    expect(buttons.map((button) => button.textContent)).toEqual([...CHIPS])
  })

  it.each(LAYOUTS)("send a chip's words as the person's message, then go once that newer message exists (%s)", async (_name, layout) => {
    layout()
    const list = await openStored([{ role: 'user', text: QUESTION }, asked])
    fireEvent.click(screen.getByRole('button', { name: `${REPLY_PREFIX}${CHIPS[0]}` }))
    expect(host.chatSent()).toEqual([{ chatId: CHAT_ID, text: CHIPS[0], retry: false }])
    await waitFor(() => expect(chips()).toBeNull())
    expect(within(list).getAllByText(CHIPS[0]).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: `${REPLY_PREFIX}${CHIPS[1]}` })).toBeNull()
  })

  it('send once for a double press, the same chip or the other one', async () => {
    await openStored([{ role: 'user', text: QUESTION }, asked])
    fireEvent.click(screen.getByRole('button', { name: `${REPLY_PREFIX}${CHIPS[0]}` }))
    const again = screen.queryByRole('button', { name: `${REPLY_PREFIX}${CHIPS[0]}` })
    const other = screen.queryByRole('button', { name: `${REPLY_PREFIX}${CHIPS[1]}` })
    if (again) fireEvent.click(again)
    if (other) fireEvent.click(other)
    expect(host.chatSent()).toHaveLength(1)
    expect(host.chatSent()).toEqual([{ chatId: CHAT_ID, text: CHIPS[0], retry: false }])
  })

  it('hand the focus to the message box after a tap on a desktop, so it never drops to the page', async () => {
    await openStored([{ role: 'user', text: QUESTION }, asked])
    expect(box()).not.toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: `${REPLY_PREFIX}${CHIPS[1]}` }))
    expect(box()).toHaveFocus()
  })

  it('leave the focus alone on the phone, where the box would raise the keyboard', async () => {
    onThePhone()
    await openStored([{ role: 'user', text: QUESTION }, asked])
    fireEvent.click(screen.getByRole('button', { name: `${REPLY_PREFIX}${CHIPS[1]}` }))
    expect(host.chatSent()).toEqual([{ chatId: CHAT_ID, text: CHIPS[1], retry: false }])
    expect(box()).not.toHaveFocus()
  })

  it('are gone under a message a newer one follows, the person\'s or Auto\'s', async () => {
    await openStored([{ role: 'user', text: QUESTION }, asked, { role: 'user', text: 'Either is fine' }])
    expect(chips()).toBeNull()
    expect(screen.getByText(ASKED)).toBeInTheDocument()
  })

  it('stay while nothing went out (a turn still ending), and send nothing', async () => {
    await openStored([{ role: 'user', text: QUESTION }, asked])
    act(() => host.setTurnEnding(true))
    fireEvent.click(screen.getByRole('button', { name: `${REPLY_PREFIX}${CHIPS[0]}` }))
    expect(host.chatSent()).toEqual([])
    expect(chips()).not.toBeNull()
    expect(within(chips() as HTMLElement).getAllByRole('button').every((button) => !button.hasAttribute('disabled'))).toBe(true)
  })

  it('draw nothing under a message with no chips', async () => {
    await openStored([{ role: 'user', text: QUESTION }, { role: 'assistant', text: ASKED }])
    expect(chips()).toBeNull()
  })
})

describe('a suggestion Auto posted into the conversation', () => {
  it.each(LAYOUTS)("is the host's card under his message, its words Auto's, Start and Hide outside the mark (%s)", async (_name, layout) => {
    layout()
    await openStored([{ role: 'user', text: QUESTION }, posted()])
    const card = threadCard(NEWER.title) as HTMLElement
    expect(card).not.toBeNull()
    const item = card.closest('li') as HTMLElement
    const reply = within(item).getByRole('article', { name: 'Auto said' })
    expect(within(reply).getByText(POSTED)).toBeInTheDocument()
    expect(before(reply, card)).toBe(true)
    expect(before(card, box())).toBe(true)
    expect(within(card).getByText(NEWER.title).closest('[data-ai-generated]')).not.toBeNull()
    expect(within(card).getByRole('button', { name: `Start: ${NEWER.title}` }).closest('[data-ai-generated]')).toBeNull()
  })

  it('is skipped by the pinned line, which pins the next open one, so each Start is on screen once', async () => {
    await openStored([{ role: 'user', text: QUESTION }, posted()])
    expect(pinned(NEWER.title)).toBeNull()
    expect(pinned(LISTED.title)).not.toBeNull()
    expect(screen.getAllByRole('button', { name: `Start: ${NEWER.title}` })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: `Start: ${LISTED.title}` })).toHaveLength(1)
  })

  it('pins nothing when the thread and a brief in it show every open suggestion', async () => {
    await openStored([briefMessage, { role: 'user', text: QUESTION }, posted()])
    expect(document.querySelector('[data-pinned-suggestion]')).toBeNull()
    expect(screen.getAllByRole('button', { name: `Start: ${NEWER.title}` })).toHaveLength(1)
  })

  it('starts through the proactive area, as the pinned line does, and stays saying so once the list drops it', async () => {
    await openStored([{ role: 'user', text: QUESTION }, posted()])
    fireEvent.click(within(threadCard(NEWER.title) as HTMLElement).getByRole('button', { name: `Start: ${NEWER.title}` }))
    await waitFor(() => expect(host.pageRuns()).toContainEqual({ hook: 'useStartSuggestion', variables: { id: NEWER_ID } }))
    expect(await screen.findByText(STARTED_LINE)).toBeInTheDocument()
    act(() => host.setPageQuery('useSuggestions', { data: [LISTED] }))
    expect(screen.getByText(STARTED_LINE)).toBeInTheDocument()
  })

  it('hides through the proactive area, with the reason picked from its menu', async () => {
    await openStored([{ role: 'user', text: QUESTION }, posted()])
    const card = threadCard(NEWER.title) as HTMLElement
    fireEvent.click(within(card).getByRole('button', { name: `Hide: ${NEWER.title}` }))
    await act(async () => {
      fireEvent.click(within(card).getByRole('button', { name: 'Not now' }))
    })
    expect(host.pageRuns()).toContainEqual({ hook: 'useHideSuggestion', variables: { id: NEWER_ID, reason: 'not_now' } })
    expect(host.pageRuns().some((run) => run.hook === 'useStartSuggestion')).toBe(false)
  })

  it("has no card once it is no longer open: the message's words stay", async () => {
    host.setPageQuery('useSuggestions', { data: [LISTED] })
    await openStored([{ role: 'user', text: QUESTION }, posted()])
    expect(threadCard(NEWER.title)).toBeNull()
    expect(screen.getByText(POSTED)).toBeInTheDocument()
    expect(pinned(LISTED.title)).not.toBeNull()
  })
})
