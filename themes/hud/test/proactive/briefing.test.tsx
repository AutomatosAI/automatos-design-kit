// HUD 1.2.0 (PRD-268): BRIEFING on the core screen, on the harness's fake proactive area and its BriefVoice stand-in.
// Where it stands: the right column at three columns, the column TODAY is in at two, the transcript's slot at one and
// on the phone (unless a card waits for you); TODAY and NEEDS YOU as before with no brief (the workspace's brief off,
// still loading, or failed). It folds back after 60 s, held while the host reads it, and on any press outside it, never
// on Tab or a press inside it; `▸ SPEAKING` follows the host's Listen; its rows are numbered across the brief, Auto's
// words marked; one panel glows, the one that needs you; nothing moves under reduced motion. Roles, names and
// attributes only; every value is made up.
import { QUESTIONS_HREF, readThemeState, ticketHref } from '@automatos/theme-sdk'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { host } from '@automatos/theme-harness/host'
import { BRIEFING_TITLE, SPEAKING_WORDS } from '../../src/chat/briefing/briefing-panel.tsx'
import { briefKey, FOLDED_KEY, FOLDED_STATE } from '../../src/chat/briefing/use-briefing.ts'
import { BRIEFING_MS } from '../../src/chat/briefing/use-fold.ts'
import { HudChatPage } from '../../src/chat/hud-chat.tsx'
import { AGENTS_TITLE } from '../../src/chat/panels/agents-panel.tsx'
import { MISSION_TITLE } from '../../src/chat/panels/mission-panel.tsx'
import { NEEDS_YOU_TITLE } from '../../src/chat/panels/needs-you-panel.tsx'
import { TODAY_TITLE } from '../../src/chat/panels/today-panel.tsx'
import { LAST_EXCHANGE_LABEL } from '../../src/chat/phone/phone-transcript.tsx'
import { CONVERSATION_LABEL } from '../../src/chat/transcript.tsx'
import { PHONE_WIDTH, resetWindowWidth, setWindowWidth } from '../support/window-width.ts'
import { ask, box, openChat, renderChat, stubClips, toolData } from '../chat/support.tsx'
import {
  BRIEF, columnOf, EMPTY_BRIEF, NEEDS, ONE_COLUMN, RUNNING, screenElement, screenWidth, SUGGESTION_ID, THREE_COLUMNS, TWO_COLUMNS,
} from './support.ts'

const LISTEN = 'Listen to the brief'
const TOOL_APPROVAL = {
  grant_id: 42,
  action: 'platform_send_message',
  message: 'This action (sends) requires confirmation.',
  risk_tier: 'human_in_the_loop',
  requires_approval: true,
}
const region = (name: string): HTMLElement => screen.getByRole('region', { name })
const briefing = (): HTMLElement => region(BRIEFING_TITLE)
const noBriefing = (): void => expect(screen.queryByRole('region', { name: BRIEFING_TITLE })).toBeNull()
const showBrief = (brief = BRIEF): void => act(() => host.setPageQuery('useBrief', { data: brief }))
const conversation = (): HTMLElement | null => screen.queryByRole('list', { name: CONVERSATION_LABEL })

/** The panels of the column holding `element`, by their headings, in order. */
function panelsBeside(element: HTMLElement): (string | null | undefined)[] {
  const column = columnOf(element) as HTMLElement
  return within(column).getAllByRole('region').map((panel) => panel.querySelector('h2')?.textContent)
}

/** The stored conversation on a phone's screen, once your words show. */
async function renderPhoneChat(): Promise<void> {
  setWindowWidth(PHONE_WIDTH)
  openChat()
  render(<HudChatPage />)
  await screen.findByRole('article', { name: 'You said' })
}

beforeEach(() => {
  host.reset()
  stubClips()
})

afterEach(() => {
  vi.useRealTimers()
  resetWindowWidth()
})

describe('where BRIEFING stands', () => {
  it('takes the right column at three columns, MISSION and AGENTS staying on the left and the transcript in place', async () => {
    screenWidth(THREE_COLUMNS)
    await renderChat()
    showBrief()
    expect(screenElement()).toHaveAttribute('data-columns', 'three')
    expect(columnOf(briefing())).toBe(screenElement().lastElementChild)
    expect(panelsBeside(briefing())).toEqual([BRIEFING_TITLE])
    expect(panelsBeside(region(AGENTS_TITLE))).toContain(MISSION_TITLE)
    expect(screen.queryByRole('region', { name: TODAY_TITLE })).toBeNull()
    expect(screen.queryByRole('region', { name: NEEDS_YOU_TITLE })).toBeNull()
    expect(conversation()).toBeInTheDocument()
  })

  it("takes TODAY's column at two columns, the transcript in place", async () => {
    screenWidth(TWO_COLUMNS)
    await renderChat()
    expect(panelsBeside(region(TODAY_TITLE))).toContain(AGENTS_TITLE)
    showBrief()
    expect(screenElement()).toHaveAttribute('data-columns', 'two')
    expect(columnOf(briefing())).toBe(screenElement().lastElementChild)
    expect(panelsBeside(briefing())).toEqual([BRIEFING_TITLE])
    expect(screen.queryByRole('region', { name: TODAY_TITLE })).toBeNull()
    expect(conversation()).toBeInTheDocument()
  })

  it("takes the transcript's slot at one column, under the core and over the message box, until it folds", async () => {
    screenWidth(ONE_COLUMN)
    await renderChat()
    showBrief()
    expect(screenElement()).toHaveAttribute('data-columns', 'one')
    expect(conversation()).toBeNull()
    const centre = columnOf(briefing()) as HTMLElement
    expect(centre).toContainElement(box())
    expect(briefing().compareDocumentPosition(box()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    fireEvent.pointerDown(document.body)
    noBriefing()
    expect(conversation()).toBeInTheDocument()
  })

  it("takes the last exchange's slot on the phone, over the controls", async () => {
    await renderPhoneChat()
    showBrief()
    expect(screen.queryByRole('region', { name: LAST_EXCHANGE_LABEL })).toBeNull()
    expect(briefing()).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Controls' })).not.toContainElement(briefing())
    fireEvent.keyDown(document.body, { key: 'a' })
    expect(screen.getByRole('region', { name: LAST_EXCHANGE_LABEL })).toBeInTheDocument()
  })

  it('never hides a card waiting for you on the phone: the last exchange keeps its slot', async () => {
    setWindowWidth(PHONE_WIDTH)
    openChat()
    host.setChatScript([{ frames: [toolData({ tool_approval: TOOL_APPROVAL })], hold: true }])
    render(<HudChatPage />)
    await screen.findByRole('article', { name: 'You said' })
    fireEvent.click(screen.getByRole('button', { name: 'Type' }))
    ask()
    await screen.findByRole('region', { name: 'Action approval needed' })
    showBrief()
    noBriefing()
    expect(screen.getByRole('region', { name: LAST_EXCHANGE_LABEL })).toBeInTheDocument()
  })

  it('never hides a card waiting for you: at one column the transcript keeps its slot', async () => {
    screenWidth(ONE_COLUMN)
    await renderChat([{ frames: [toolData({ tool_approval: TOOL_APPROVAL })], hold: true }])
    ask()
    await screen.findByRole('region', { name: 'Action approval needed' })
    showBrief()
    noBriefing()
    expect(conversation()).toBeInTheDocument()
  })
})

describe('a day with no brief', () => {
  it.each<[string, 'idle' | 'loading']>([
    ['the workspace has its brief off (brief_off: quiet)', 'idle'],
    ['the brief is still loading', 'loading'],
  ])('draws TODAY and NEEDS YOU as before when %s', async (_why, answer) => {
    host.setPageQuery('useBrief', answer)
    await renderChat()
    noBriefing()
    expect(region(TODAY_TITLE)).toBeInTheDocument()
    expect(region(NEEDS_YOU_TITLE)).toBeInTheDocument()
  })

  it('draws them as before, with no error, when the brief fails to load', async () => {
    host.setPageQuery('useBrief', { error: 'brief_off' })
    await renderChat()
    noBriefing()
    expect(region(TODAY_TITLE)).toBeInTheDocument()
    expect(screen.queryByText('brief_off')).toBeNull()
  })
})

describe('folding back', () => {
  it('folds back into TODAY and NEEDS YOU after 60 s, and that brief stays folded; a new one shows again', async () => {
    await renderChat()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    showBrief()
    act(() => {
      vi.advanceTimersByTime(BRIEFING_MS - 1)
    })
    expect(briefing()).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    noBriefing()
    expect(region(TODAY_TITLE)).toBeInTheDocument()
    expect(region(NEEDS_YOU_TITLE)).toBeInTheDocument()
    showBrief({ ...BRIEF })
    noBriefing()
    showBrief({ ...BRIEF, state_hash: 'brief-hash-2' })
    expect(briefing()).toBeInTheDocument()
  })

  it('never folds on Tab, a modifier or a press inside it, and folds on Escape from anywhere', async () => {
    await renderChat()
    showBrief()
    fireEvent.keyDown(document.body, { key: 'Tab' })
    fireEvent.keyDown(document.body, { key: 'Shift' })
    const listen = within(briefing()).getByRole('button', { name: LISTEN })
    fireEvent.pointerDown(listen)
    fireEvent.keyDown(within(briefing()).getByRole('link', { name: 'Open: Check the laptop reviews' }), { key: 'Enter' })
    expect(briefing()).toBeInTheDocument()
    fireEvent.keyDown(listen, { key: 'Escape' })
    noBriefing()
  })

  it("stays folded for the tab's session in this workspace when you come back to the chat", async () => {
    const { unmount } = await renderChat()
    showBrief()
    fireEvent.pointerDown(document.body)
    noBriefing()
    expect(readThemeState(FOLDED_KEY, FOLDED_STATE).value).toBe(briefKey(BRIEF))
    unmount()
    await renderChat()
    noBriefing()
    expect(region(TODAY_TITLE)).toBeInTheDocument()
  })

  it("holds the 60 s while the focus is inside it, and Escape there gives the focus to the screen's heading", async () => {
    await renderChat()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    showBrief()
    const listen = within(briefing()).getByRole('button', { name: LISTEN })
    act(() => listen.focus())
    act(() => {
      vi.advanceTimersByTime(BRIEFING_MS * 2)
    })
    expect(briefing()).toBeInTheDocument()
    fireEvent.keyDown(listen, { key: 'Escape' })
    noBriefing()
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus()
  })

  it('folds on a key pressed anywhere outside it, the message box included', async () => {
    await renderChat()
    showBrief()
    fireEvent.keyDown(box(), { key: 'h' })
    noBriefing()
    expect(region(TODAY_TITLE)).toBeInTheDocument()
  })
})

describe('▸ SPEAKING', () => {
  it("shows while the host's Listen reads the brief, holding the 60 s, and HUD speaks nothing itself", async () => {
    await renderChat()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    showBrief()
    expect(within(briefing()).queryByText(SPEAKING_WORDS)).toBeNull()
    const listen = within(briefing()).getByRole('button', { name: LISTEN })
    fireEvent.pointerDown(listen)
    await act(async () => {
      fireEvent.click(listen)
    })
    expect(within(briefing()).getByText(SPEAKING_WORDS)).toBeInTheDocument()
    expect(briefing().querySelector('[data-brief-voice="root"]')).toHaveAttribute('data-voice-speaking', 'true')
    expect(host.cardActions()).toContainEqual({ card: 'brief-voice', id: BRIEF.date, action: 'listen' })
    act(() => {
      vi.advanceTimersByTime(BRIEFING_MS * 2)
    })
    expect(briefing()).toBeInTheDocument()
    await act(async () => {
      host.setBriefReading(false)
    })
    expect(within(briefing()).queryByText(SPEAKING_WORDS)).toBeNull()
    act(() => {
      vi.advanceTimersByTime(BRIEFING_MS)
    })
    noBriefing()
    expect(host.voicePresses()).toEqual([])
  })
})

describe("BRIEFING's rows", () => {
  it('numbers every row across the sections as Listen reads them, each section its label and exact count', async () => {
    await renderChat()
    showBrief()
    const rows = within(briefing()).getAllByRole('listitem')
    expect(rows.map((row) => row.firstElementChild?.textContent)).toEqual(['01', '02', '03', '04'])
    expect(rows.map((row) => row.getAttribute('value'))).toEqual(['1', '2', '3', '4'])
    const labels = within(briefing()).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)
    expect(labels).toEqual(['Needs you 7', 'Suggested 1', 'Today 1'])
    // A folded section shows the rows the brief carries under its exact count, and offers no "Show N more" it can't open.
    expect(within(briefing()).getByRole('group', { name: 'Needs you 7' }).querySelectorAll('li')).toHaveLength(2)
    expect(within(briefing()).queryByText('Show 5 more')).toBeNull()
    expect(briefing()).toHaveTextContent('Wed 14 Oct')
  })

  it("draws each row's why, state and time, and its action named by the row, linked where it opens", async () => {
    await renderChat()
    showBrief()
    const [review, question, , today] = within(briefing()).getAllByRole('listitem')
    expect(review).toHaveTextContent('Scout is waiting for your review.')
    expect(review).toHaveTextContent('◆ NEEDS YOU')
    expect(review).toHaveAttribute('data-display-state', 'needs_you')
    expect(within(review).getByRole('link', { name: 'Open: Check the laptop reviews' })).toHaveAttribute('href', ticketHref('101'))
    expect(within(question).getByRole('link', { name: 'Answer: Which budget?' })).toHaveAttribute('href', QUESTIONS_HREF)
    expect(today.querySelector('time')).toHaveAttribute('dateTime', '2026-10-14T11:00:00+00:00')
    expect(within(today).queryByRole('link')).toBeNull()
  })

  it("starts a suggestion's row through the SDK and says it started in its place", async () => {
    await renderChat()
    showBrief()
    fireEvent.click(within(briefing()).getByRole('button', { name: 'Start: Check the laptop prices again' }))
    expect(await within(briefing()).findByText('✓ Started')).toBeInTheDocument()
    expect(host.pageRuns()).toContainEqual({ hook: 'useStartSuggestion', variables: { id: SUGGESTION_ID } })
  })

  it("marks Auto's words, the greeting, every title and every why, data-ai-generated", async () => {
    await renderChat()
    showBrief()
    expect(within(briefing()).getByText('Morning.')).toHaveAttribute('data-ai-generated', 'true')
    for (const row of [...BRIEF.sections.needs_you, ...BRIEF.sections.suggestions, ...BRIEF.sections.today]) {
      expect(within(briefing()).getByText(row.title).closest('[data-ai-generated="true"]')).not.toBeNull()
      expect(within(briefing()).getByText(row.why)).toHaveAttribute('data-ai-generated', 'true')
    }
  })

  it('says so in the brief\'s own words when the day is empty', async () => {
    await renderChat()
    showBrief(EMPTY_BRIEF)
    expect(within(briefing()).getByText(EMPTY_BRIEF.labels.empty ?? '')).toBeInTheDocument()
    expect(within(briefing()).queryAllByRole('listitem')).toEqual([])
  })
})

describe('the one live border', () => {
  it('glows on NEEDS YOU alone while anything needs you, never on MISSION while its Mission works', async () => {
    host.setPageQuery('useBrief', 'idle')
    host.setPageQuery('useNeedsYou', { data: NEEDS })
    host.setPageQuery('useActivityFeed', { data: RUNNING })
    await renderChat()
    await waitFor(() => expect(region(MISSION_TITLE)).toHaveTextContent('Laptop shortlist'))
    const live = document.querySelectorAll('[data-live="true"]')
    expect(live).toHaveLength(1)
    expect(live[0]).toBe(region(NEEDS_YOU_TITLE))
  })

  it('lights BRIEFING from what needs you now, as NEEDS YOU reads it, not from the count the brief was made with', async () => {
    host.setPageQuery('useNeedsYou', { data: NEEDS })
    await renderChat()
    showBrief(EMPTY_BRIEF)
    expect(briefing()).toHaveAttribute('data-live', 'true')
    act(() => host.setPageQuery('useNeedsYou', { data: { ...NEEDS, total: 0 } }))
    showBrief({ ...BRIEF })
    expect(briefing()).not.toHaveAttribute('data-live')
  })

  it("moves to BRIEFING while it stands in NEEDS YOU's place", async () => {
    host.setPageQuery('useNeedsYou', { data: NEEDS })
    host.setPageQuery('useActivityFeed', { data: RUNNING })
    await renderChat()
    showBrief()
    const live = document.querySelectorAll('[data-live="true"]')
    expect(live).toHaveLength(1)
    expect(live[0]).toBe(briefing())
  })
})

describe('motion', () => {
  it('enters once while motion is allowed, and not at all under reduced motion', async () => {
    const { unmount } = await renderChat()
    showBrief()
    expect(briefing().parentElement).toHaveAttribute('data-hud-enter', 'rise')
    unmount()
    host.setReducedMotion(true)
    await renderChat()
    showBrief({ ...BRIEF, state_hash: 'brief-hash-3' })
    expect(briefing().parentElement).not.toHaveAttribute('data-hud-enter')
  })
})
