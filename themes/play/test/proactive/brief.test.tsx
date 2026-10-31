// Play 1.3.0 (PRD-268 §6.12.4, US-K01) — the day's brief in Play's chat, on the harness's fake proactive area: the
// brief a test sets (host.setPageQuery('useBrief', …)), 'idle' for a day without one (the workspace's proactive mode
// off: core's open answers brief_off and the host stays quiet), loading until a test sets it. The card is the host's
// BriefCard (the harness's stand-in, which marks Auto's words data-ai-generated); its row presses run through the
// fake area's Start (host.pageRuns()) and the fake router (host.navigations()). Auto himself is a stand-in that
// shows his state.
import { removeThemeState, ticketHref, writeThemeState } from '@automatos/theme-sdk'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AutoMascotProps } from '../../src/components/mascot/auto-mascot.tsx'
import { EXAMPLES, HELLO_TITLE } from '../../src/components/play/chat/first-open.tsx'
import { PLACEHOLDER } from '../../src/components/play/chat/message-box.tsx'
import { PlayChat } from '../../src/components/play/chat/play-chat.tsx'
import { BRIEF_LABEL } from '../../src/components/play/proactive/play-brief.tsx'
import { HELLO_KEY, HELLO_STATE } from '../../src/lib/mascot/session.ts'
import { host } from '@automatos/theme-harness/host'
import { BRIEF, LISTED_ID, SUGGESTION_ROW, TICKET_ROW } from '../support/proactive.ts'
import { PHONE_WIDTH, resetWindowWidth, setWindowWidth } from '../support/window-width.ts'

vi.mock('../../src/components/mascot/auto-mascot.tsx', async () => {
  const { createElement } = await import('react')
  return {
    AutoMascot: ({ state }: Pick<AutoMascotProps, 'state'>) => createElement('div', { 'data-testid': 'auto', 'data-state': state }),
  }
})

type StoredChat = Parameters<typeof host.setConversations>[0][number]
type StoredMessage = NonNullable<StoredChat['messages']>[number]

const UPDATED = '2026-10-14T09:00:00+00:00'
const BACKGROUND = 'Auto · background'
const brief = () => screen.getByRole('region', { name: BRIEF_LABEL })
const box = () => screen.getByRole('textbox', { name: PLACEHOLDER })
const mascotColumn = () => screen.queryByRole('complementary', { name: 'Auto' })

/** The stored conversation c1 on screen through its ?chatId= link, its messages listed. */
async function openStored(messages: readonly StoredMessage[]) {
  const chat: StoredChat = { id: 'c1', title: 'Auto', updatedAt: UPDATED, preview: null, messages }
  host.setConversations([chat])
  host.setSearchParams('chatId=c1')
  render(<PlayChat />)
  return screen.findByRole('list', { name: 'Conversation' })
}

/** True when `first` comes before `second` in the document. */
function before(first: Element, second: Element): boolean {
  return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)
}

beforeEach(() => {
  host.reset()
  writeThemeState(HELLO_KEY, true, HELLO_STATE) // hello already played this session
})

afterEach(() => {
  resetWindowWidth()
})

describe("an empty chat with the day's brief, at 1440", () => {
  it("draws the brief in the first open's place, with the page header and Auto in the mascot column", () => {
    host.setPageQuery('useBrief', { data: BRIEF })
    render(<PlayChat />)
    expect(within(brief()).getByRole('article', { name: BRIEF.greeting })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: HELLO_TITLE })).toBeNull()
    expect(screen.queryByRole('list', { name: 'Examples to try' })).toBeNull()
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    const column = mascotColumn()
    expect(column).not.toBeNull()
    expect(within(column as HTMLElement).getByTestId('auto')).toBeInTheDocument()
    expect(before(brief(), box())).toBe(true)
  })

  it("says hello beside it on the session's first empty chat, as the first open does", () => {
    removeThemeState(HELLO_KEY, HELLO_STATE)
    host.setPageQuery('useBrief', { data: BRIEF })
    render(<PlayChat />)
    expect(screen.getByTestId('auto')).toHaveAttribute('data-state', 'hello')
  })

  it("marks Auto's words data-ai-generated, and leaves the card's controls outside the mark", () => {
    host.setPageQuery('useBrief', { data: BRIEF })
    render(<PlayChat />)
    const region = brief()
    expect(within(region).getByRole('heading', { name: BRIEF.greeting })).toHaveAttribute('data-ai-generated', 'true')
    expect(within(region).getByText(BRIEF.prose).closest('[data-ai-generated]')).not.toBeNull()
    expect(within(region).getByText(TICKET_ROW.title).closest('[data-ai-generated]')).not.toBeNull()
    expect(region.closest('[data-ai-generated]')).toBeNull()
    const start = within(region).getByRole('button', { name: `Start: ${SUGGESTION_ROW.title}` })
    expect(start.closest('[data-ai-generated]')).toBeNull()
  })
})

describe("an empty chat with the day's brief, on the phone (below 1024 px)", () => {
  it('draws the brief with no mascot column, Auto standing over the message box', () => {
    setWindowWidth(PHONE_WIDTH)
    host.setMinWidth(360)
    host.setWidth(PHONE_WIDTH)
    host.setPageQuery('useBrief', { data: BRIEF })
    render(<PlayChat />)
    expect(within(brief()).getByRole('article', { name: BRIEF.greeting })).toBeInTheDocument()
    expect(mascotColumn()).toBeNull()
    const figures = screen.getAllByTestId('auto')
    expect(figures).toHaveLength(1)
    expect(before(brief(), figures[0])).toBe(true)
    expect(before(figures[0], box())).toBe(true)
  })
})

/** How useBrief answers on a day with no brief to draw. */
type NoBrief = 'idle' | 'loading' | { readonly error: string }
const NO_BRIEF: ReadonlyArray<readonly [string, NoBrief]> = [
  ['idle: the workspace has no brief today', 'idle'],
  ['loading: the host has not opened it yet', 'loading'],
  ['a read that failed', { error: 'Something went wrong.' }],
]

describe('no brief is a normal day', () => {
  it.each(NO_BRIEF)("draws today's empty chat (%s): the first open, its examples, no brief and no error", (_name, answer) => {
    host.setPageQuery('useBrief', answer)
    render(<PlayChat />)
    expect(screen.getByRole('heading', { name: HELLO_TITLE })).toBeInTheDocument()
    const chips = within(screen.getByRole('list', { name: 'Examples to try' })).getAllByRole('button')
    expect(chips.map((chip) => chip.textContent)).toEqual([...EXAMPLES])
    expect(screen.queryByRole('region', { name: BRIEF_LABEL })).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(mascotColumn()).toBeNull()
  })
})

describe("the brief's message in a conversation", () => {
  const MESSAGES: readonly StoredMessage[] = [
    { role: 'user', text: 'Good morning' },
    { role: 'assistant', text: BRIEF.prose, provenance: BACKGROUND },
    { role: 'assistant', text: 'Here is the outline you asked for.' },
  ]

  it('draws as the card in its place, its prose drawn once, inside the card', async () => {
    host.setPageQuery('useBrief', { data: BRIEF })
    const list = await openStored(MESSAGES)
    const card = within(list).getByRole('region', { name: BRIEF_LABEL })
    expect(card.closest('article')).toHaveAccessibleName('Auto said')
    expect(within(list).getAllByText(BRIEF.prose)).toHaveLength(1)
    expect(within(card).getByText(BRIEF.prose)).toBeInTheDocument()
    expect(within(list).getByText(BACKGROUND)).toBeInTheDocument()
    expect(within(list).getByText('Here is the outline you asked for.')).toBeInTheDocument()
  })

  it("stays Auto's words without the day's brief (another day's, or none): no card", async () => {
    host.setPageQuery('useBrief', 'idle')
    const list = await openStored(MESSAGES)
    expect(within(list).queryByRole('region', { name: BRIEF_LABEL })).toBeNull()
    expect(within(list).getByText(BRIEF.prose)).toBeInTheDocument()
  })
})

describe("a brief row's action", () => {
  it('Start runs the suggestion it names, then says what it did in place', async () => {
    host.setPageQuery('useBrief', { data: BRIEF })
    render(<PlayChat />)
    fireEvent.click(within(brief()).getByRole('button', { name: `Start: ${SUGGESTION_ROW.title}` }))
    expect(await within(brief()).findByText('Started')).toHaveAttribute('role', 'status')
    expect(host.pageRuns()).toContainEqual({ hook: 'useStartSuggestion', variables: { id: LISTED_ID } })
  })

  it("Open goes where the row opens, on the SDK's path", async () => {
    host.setPageQuery('useBrief', { data: BRIEF })
    render(<PlayChat />)
    fireEvent.click(within(brief()).getByRole('button', { name: `Open: ${TICKET_ROW.title}` }))
    await waitFor(() => expect(host.navigations()).toContainEqual({ method: 'push', href: ticketHref('41') }))
  })
})
