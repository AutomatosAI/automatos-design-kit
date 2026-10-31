// HUD 1.3.0 (PRD-268, SDK 1.4.0): the brief and the suggestions Auto posts into the conversation, from his messages'
// knownParts on the harness's fake chat. A brief@1 message is the brief in his row, in place of his words: its day, its
// greeting, his Read once (never a second time as the message's text), its sections numbered across the brief, Start on
// a suggestion's row. A suggestion@1 part is a card in his row while that suggestion is open and the viewer's (from
// useSuggestions, never from the thread): its title and detail as Auto's words, START and HIDE as SAY chips through the
// SDK, "Started" for a moment, nothing once it isn't open. The `▸ NEXT` line skips any suggestion the conversation or
// BRIEFING shows, on the desktop and on the phone. Roles, names and attributes only; every value is made up.
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { host } from '@automatos/theme-harness/host'
import { HudChatPage } from '../../src/chat/hud-chat.tsx'
import { NEXT_LABEL, SAY_HIDE, SAY_START, STARTED_LINE } from '../../src/chat/next/next-line.tsx'
import { STARTED_MS } from '../../src/chat/next/use-next.ts'
import { THREAD_BRIEF_TITLE } from '../../src/chat/thread/thread-brief.tsx'
import { SUGGESTS_TITLE } from '../../src/chat/thread/thread-suggestion.tsx'
import { CONVERSATION_LABEL } from '../../src/chat/transcript.tsx'
import { openChat, renderChat, reply, stubClips } from '../chat/support.tsx'
import { PHONE_WIDTH, resetWindowWidth, setWindowWidth } from '../support/window-width.ts'
import { autoMessage, BRIEF_ASK, BRIEF_POST, chipsReply } from './parts.ts'
import { BRIEF, ONE_COLUMN, OTHER_SUGGESTION_ID, screenWidth, SUGGESTION_ID, SUGGESTIONS } from './support.ts'

const FIRST = SUGGESTIONS[0].title
const SECOND = SUGGESTIONS[1].title
const giveSuggestions = (): void => act(() => host.setPageQuery('useSuggestions', { data: SUGGESTIONS }))
const threadBrief = (): HTMLElement => screen.getByRole('region', { name: THREAD_BRIEF_TITLE })
const card = (id: string): HTMLElement | null => document.querySelector<HTMLElement>(`[data-thread-part="suggestion@1"][data-suggestion-id="${id}"]`)
const next = (): HTMLElement | null => screen.queryByRole('group', { name: NEXT_LABEL })
const nextId = (): string | null => next()?.getAttribute('data-suggestion-id') ?? null
const postsSuggestion = (id: string) => [{ role: 'user' as const, text: 'Anything?' }, autoMessage('One idea.', [{ type: 'suggestion@1', suggestion_id: id }])]

beforeEach(() => {
  host.reset()
  stubClips()
})

afterEach(() => {
  vi.useRealTimers()
  resetWindowWidth()
})

describe('the brief as a message', () => {
  it("draws the brief in Auto's row, his Read in it once, its day as its value and its rows numbered across it", async () => {
    await renderChat([], [BRIEF_POST])
    const brief = threadBrief()
    expect(screen.getAllByRole('article', { name: 'Auto said' })[0]).toContainElement(brief)
    expect(brief).toHaveTextContent('Wed 14 Oct')
    expect(within(brief).getByText(BRIEF.greeting)).toHaveAttribute('data-ai-generated', 'true')
    expect(screen.getAllByText(BRIEF.prose)).toHaveLength(1)
    expect(within(brief).getByText(BRIEF.prose).closest('[data-ai-generated="true"]')).not.toBeNull()
    const rows = within(brief).getAllByRole('listitem')
    expect(rows.map((row) => row.getAttribute('value'))).toEqual(['1', '2', '3', '4'])
    const labels = within(brief).getAllByRole('heading', { level: 4 }).map((heading) => heading.textContent)
    expect(labels).toEqual(['Needs you 7', 'Suggested 1', 'Today 1'])
  })

  it("starts a suggestion's row from the message, through the SDK", async () => {
    await renderChat([], [BRIEF_POST])
    fireEvent.click(within(threadBrief()).getByRole('button', { name: 'Start: Check the laptop prices again' }))
    expect(await within(threadBrief()).findByText('✓ Started')).toBeInTheDocument()
    expect(host.pageRuns()).toContainEqual({ hook: 'useStartSuggestion', variables: { id: SUGGESTION_ID } })
  })

  it('draws a message without a brief@1 part as words, whatever they say', async () => {
    await renderChat([], [autoMessage(BRIEF.prose)])
    expect(screen.queryByRole('region', { name: THREAD_BRIEF_TITLE })).toBeNull()
    expect(reply()).toHaveTextContent(BRIEF.prose)
  })
})

describe("a suggestion Auto posted", () => {
  it("is a card in his row while it is open, its words his, with START and HIDE as SAY chips", async () => {
    await renderChat([], postsSuggestion(SUGGESTION_ID))
    expect(card(SUGGESTION_ID)).toBeNull()
    giveSuggestions()
    const shown = card(SUGGESTION_ID) as HTMLElement
    expect(reply()).toContainElement(shown)
    expect(screen.getByRole('article', { name: `${SUGGESTS_TITLE}: ${FIRST}` })).toBe(shown)
    expect(within(shown).getByRole('heading', { name: SUGGESTS_TITLE })).toBeInTheDocument()
    expect(within(shown).getByText(FIRST)).toHaveAttribute('data-ai-generated', 'true')
    expect(within(shown).getByText(SUGGESTIONS[0].detail)).toHaveAttribute('data-ai-generated', 'true')
    expect(within(shown).getByRole('button', { name: `${SAY_HIDE}: ${FIRST}` })).toBeInTheDocument()
    expect(shown.closest('[aria-live]')).toBeNull()
  })

  it('starts through the SDK, says so for a moment in its place, and is gone after', async () => {
    await renderChat([], postsSuggestion(SUGGESTION_ID))
    giveSuggestions()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    await act(async () => {
      fireEvent.click(within(card(SUGGESTION_ID) as HTMLElement).getByRole('button', { name: `${SAY_START}: ${FIRST}` }))
    })
    expect(host.pageRuns()).toContainEqual({ hook: 'useStartSuggestion', variables: { id: SUGGESTION_ID } })
    expect(card(SUGGESTION_ID)).toHaveTextContent(STARTED_LINE)
    act(() => {
      vi.advanceTimersByTime(STARTED_MS)
    })
    expect(card(SUGGESTION_ID)).toBeNull()
  })

  it("draws nothing for a suggestion that isn't open, or isn't in the viewer's list", async () => {
    await renderChat([], postsSuggestion(SUGGESTION_ID))
    act(() => host.setPageQuery('useSuggestions', { data: [{ ...SUGGESTIONS[0], status: 'started' }, SUGGESTIONS[1]] }))
    expect(card(SUGGESTION_ID)).toBeNull()
    act(() => host.setPageQuery('useSuggestions', { data: [SUGGESTIONS[1]] }))
    expect(card(SUGGESTION_ID)).toBeNull()
    expect(reply()).toHaveTextContent('One idea.')
  })
})

describe('▸ NEXT beside the conversation', () => {
  it('skips the suggestion the conversation shows as a card, and shows the next', async () => {
    await renderChat([], postsSuggestion(SUGGESTION_ID))
    giveSuggestions()
    expect(card(SUGGESTION_ID)).not.toBeNull()
    expect(nextId()).toBe(OTHER_SUGGESTION_ID)
    expect(within(next() as HTMLElement).getByText(SECOND)).toBeInTheDocument()
  })

  it("skips the suggestions the brief in the conversation lists, and the ones BRIEFING lists", async () => {
    await renderChat([], [BRIEF_POST, { role: 'user', text: BRIEF_ASK }, chipsReply(OTHER_SUGGESTION_ID)])
    giveSuggestions()
    expect(next()).toBeNull()
    act(() => host.setPageQuery('useBrief', { data: BRIEF }))
    expect(next()).toBeNull()
  })

  it("counts the conversation's suggestions only while the transcript shows: not while BRIEFING stands in its slot", async () => {
    screenWidth(ONE_COLUMN)
    await renderChat([], postsSuggestion(SUGGESTION_ID))
    giveSuggestions()
    expect(nextId()).toBe(OTHER_SUGGESTION_ID)
    act(() => host.setPageQuery('useBrief', { data: { ...BRIEF, sections: { ...BRIEF.sections, suggestions: [] } } }))
    expect(screen.queryByRole('list', { name: CONVERSATION_LABEL })).toBeNull()
    expect(nextId()).toBe(SUGGESTION_ID)
  })

  it("skips on the phone the suggestion the last exchange shows, and counts none an earlier exchange showed", async () => {
    setWindowWidth(PHONE_WIDTH)
    openChat([BRIEF_POST, { role: 'user', text: BRIEF_ASK }, chipsReply(OTHER_SUGGESTION_ID)])
    render(<HudChatPage />)
    await screen.findByRole('article', { name: 'You said' })
    giveSuggestions()
    expect(screen.queryByRole('region', { name: THREAD_BRIEF_TITLE })).toBeNull()
    expect(card(OTHER_SUGGESTION_ID)).not.toBeNull()
    expect(nextId()).toBe(SUGGESTION_ID)
  })

  it("draws on the phone the last exchange's brief, and skips the suggestions it lists", async () => {
    setWindowWidth(PHONE_WIDTH)
    openChat([{ role: 'user', text: BRIEF_ASK }, BRIEF_POST])
    render(<HudChatPage />)
    await screen.findByRole('article', { name: 'You said' })
    giveSuggestions()
    expect(threadBrief()).toBeInTheDocument()
    expect(nextId()).toBe(OTHER_SUGGESTION_ID)
  })
})
