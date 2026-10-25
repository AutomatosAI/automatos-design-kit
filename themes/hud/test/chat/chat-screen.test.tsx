// The core screen's own parts around the conversation, on the harness: the host's first-run nudge (the local
// edition's) heads the conversation's column, above its title, and never sits with the message box; a new chat says
// how to start in one line, with three starters that put their words in the box, and no transcript list until
// something is said. Roles, names, the host's surface marks and the document's order only.
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { host } from '@automatos/theme-harness/host'
import { EMPTY_LINE, STARTERS, STARTERS_LABEL } from '../../src/chat/empty-chat.tsx'
import { HudChatPage } from '../../src/chat/hud-chat.tsx'
import { CONVERSATION_LABEL } from '../../src/chat/transcript.tsx'
import { box, HELD, renderChat, stubClips } from './support.tsx'

/** The host's first-run nudge: its protected surface, as the harness's stand-in marks it. */
const nudgeIn = (): HTMLElement | null => document.querySelector<HTMLElement>('[data-protected-surface="first-run-nudge"]')

const title = (): HTMLElement => screen.getByRole('heading', { level: 1 })

beforeEach(() => {
  host.reset()
  stubClips()
})

describe("the host's first-run nudge", () => {
  it("heads the conversation's column, above its title, apart from the message box", async () => {
    await renderChat()
    const nudge = nudgeIn()
    if (nudge === null) throw new Error('No first-run nudge on the local edition.')
    const column = nudge.parentElement
    expect(column?.firstElementChild).toBe(nudge)
    expect(column).toContainElement(title())
    expect(nudge.compareDocumentPosition(title()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const footer = column?.lastElementChild ?? null
    expect(footer).toContainElement(box())
    expect(footer).not.toContainElement(nudge)
  })

  it('is not drawn on the hosted edition', async () => {
    host.setEdition('saas')
    await renderChat()
    expect(nudgeIn()).toBeNull()
  })
})

describe('a new chat', () => {
  const starters = (): HTMLElement => screen.getByRole('list', { name: STARTERS_LABEL })

  it('says how to start in one line, over three starters, with no transcript list yet', async () => {
    render(<HudChatPage />)
    expect(await screen.findByText(EMPTY_LINE)).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: CONVERSATION_LABEL })).toBeNull()
    expect(within(starters()).getAllByRole('button').map((button) => button.textContent)).toEqual([...STARTERS])
  })

  it('puts a starter in the message box and focuses it, sending nothing until you do', async () => {
    render(<HudChatPage />)
    await screen.findByText(EMPTY_LINE)
    host.setChatScript([HELD])
    fireEvent.click(within(starters()).getByRole('button', { name: STARTERS[1] }))
    expect(box()).toHaveValue(STARTERS[1])
    expect(box()).toHaveFocus()
    expect(host.chatSent()).toEqual([])
    fireEvent.keyDown(box(), { key: 'Enter' })
    expect(host.chatSent()).toEqual([{ chatId: null, text: STARTERS[1], retry: false }])
    expect(screen.queryByRole('list', { name: STARTERS_LABEL })).toBeNull()
    expect(screen.getByRole('list', { name: CONVERSATION_LABEL })).toBeInTheDocument()
  })

  it('shows no starters once the conversation has words', async () => {
    await renderChat()
    expect(screen.queryByText(EMPTY_LINE)).toBeNull()
    expect(screen.queryByRole('list', { name: STARTERS_LABEL })).toBeNull()
  })
})
