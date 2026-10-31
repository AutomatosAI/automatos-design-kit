// Play 1.3.0 (PRD-268 §6.12.4, US-K01) — the newest open suggestion pinned above Play's message box, on the harness's
// fake proactive area (host.setPageQuery('useSuggestions', …)). The card is the host's SuggestionCard (the harness's
// stand-in: its pinned line is a group named "Auto suggests: <title>", its full card an article of that name). The
// turn's Mission suggestion comes from a recorded mission-suggestion part (host.setChatScript), and a Mission being
// planned from host.setPlanningMissionId. Auto himself is a stand-in that shows his state.
import { writeThemeState } from '@automatos/theme-sdk'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AutoMascotProps } from '../../src/components/mascot/auto-mascot.tsx'
import { PLACEHOLDER } from '../../src/components/play/chat/message-box.tsx'
import { MISSION_CREATED_LABEL, SUGGESTION_LABEL } from '../../src/components/play/chat/mission-suggestion.tsx'
import { PlayChat } from '../../src/components/play/chat/play-chat.tsx'
import { HELLO_KEY, HELLO_STATE } from '../../src/lib/mascot/session.ts'
import { host } from '@automatos/theme-harness/host'
import { BRIEF, LISTED, NEWER, SUGGESTIONS } from '../support/proactive.ts'
import { PHONE_WIDTH, resetWindowWidth, setWindowWidth } from '../support/window-width.ts'

vi.mock('../../src/components/mascot/auto-mascot.tsx', async () => {
  const { createElement } = await import('react')
  return {
    AutoMascot: ({ state }: Pick<AutoMascotProps, 'state'>) => createElement('div', { 'data-testid': 'auto', 'data-state': state }),
  }
})

type Turn = Parameters<typeof host.setChatScript>[0][number]
type Frame = Turn['frames'][number]

const UPDATED = '2026-10-14T09:00:00+00:00'
const QUESTION = 'Plan the bake sale?'
const TRIAL_BANNER = 'trial-exhausted-banner'
const suggests = (title: string): string => `Auto suggests: ${title}`
const pinned = (title: string = NEWER.title) => screen.queryByRole('group', { name: suggests(title) })
const box = () => screen.getByRole('textbox', { name: PLACEHOLDER })
const dataPart = (type: string, data: unknown): Frame => ({ data: { type, data } })
const MISSION_TURN: Turn = { frames: [dataPart('mission-suggestion', { goal: 'Run the whole bake sale', complexity: 'organ' }), { text: 'That is a big one.' }] }

/** True when `first` comes before `second` in the document. */
function before(first: Element, second: Element): boolean {
  return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)
}

/** The stored conversation c1 on screen, its messages listed, with the turns its next sends take. */
async function renderConversation(turns: readonly Turn[] = []) {
  host.setConversations([{ id: 'c1', title: 'Bake sale', updatedAt: UPDATED, preview: null, messages: [{ role: 'user', text: QUESTION }] }])
  host.setSearchParams('chatId=c1')
  host.setChatScript(turns)
  render(<PlayChat />)
  await screen.findByRole('list', { name: 'Conversation' })
}

function ask(text: string) {
  fireEvent.change(box(), { target: { value: text } })
  fireEvent.keyDown(box(), { key: 'Enter' })
}

beforeEach(() => {
  host.reset()
  writeThemeState(HELLO_KEY, true, HELLO_STATE)
  host.setPageQuery('useSuggestions', { data: SUGGESTIONS })
})

afterEach(() => {
  resetWindowWidth()
})

describe('the pinned suggestion, at 1440', () => {
  it('pins the newest open suggestion as one line between the trial banner and the message box', async () => {
    host.setTrial({ state: 'exhausted', grantedUsd: 1, spentUsd: 1 })
    await renderConversation()
    const line = pinned()
    expect(line).not.toBeNull()
    const banner = screen.getByRole('alert')
    expect(banner).toHaveAttribute('data-protected-surface', TRIAL_BANNER)
    expect(before(banner, line as HTMLElement)).toBe(true)
    expect(before(line as HTMLElement, box())).toBe(true)
    expect(pinned(LISTED.title)).toBeNull()
  })

  it("marks the suggestion's words as Auto's, and keeps Start and Hide outside the mark", async () => {
    await renderConversation()
    const line = pinned() as HTMLElement
    expect(within(line).getByText(NEWER.title).closest('[data-ai-generated]')).not.toBeNull()
    expect(within(line).getByRole('button', { name: `Start: ${NEWER.title}` }).closest('[data-ai-generated]')).toBeNull()
    expect(within(line).getByRole('button', { name: `Hide: ${NEWER.title}` }).closest('[data-ai-generated]')).toBeNull()
  })

  it('opens the full card from its title in the same place, and folds back on Escape', async () => {
    await renderConversation()
    fireEvent.click(screen.getByRole('button', { name: `Open: ${NEWER.title}` }))
    const card = screen.getByRole('article', { name: suggests(NEWER.title) })
    expect(within(card).getByText(NEWER.detail)).toBeInTheDocument()
    expect(before(card, box())).toBe(true)
    fireEvent.keyDown(card, { key: 'Escape' })
    expect(screen.queryByRole('article', { name: suggests(NEWER.title) })).toBeNull()
    expect(pinned()).not.toBeNull()
  })

  it('draws nothing when no suggestion is open', async () => {
    host.setPageQuery('useSuggestions', { data: [] })
    await renderConversation()
    expect(document.querySelector('[data-pinned-suggestion]')).toBeNull()
  })
})

describe('one suggestion surface', () => {
  it("steps aside while the turn's Mission suggestion is unanswered, and comes back once a Mission is planned", async () => {
    await renderConversation([MISSION_TURN])
    expect(pinned()).not.toBeNull()
    ask(QUESTION)
    await waitFor(() => expect(screen.getByRole('region', { name: SUGGESTION_LABEL })).toBeInTheDocument())
    expect(pinned()).toBeNull()
    act(() => host.setPlanningMissionId('mission-1'))
    expect(screen.getByRole('region', { name: MISSION_CREATED_LABEL })).toBeInTheDocument()
    expect(pinned()).not.toBeNull()
  })

  it('never pins a suggestion the brief on screen lists with its own Start: the newest one it does not list', () => {
    host.setPageQuery('useBrief', { data: BRIEF })
    host.setPageQuery('useSuggestions', { data: [LISTED] })
    const view = render(<PlayChat />)
    expect(pinned(LISTED.title)).toBeNull()
    view.unmount()
    host.setPageQuery('useSuggestions', { data: SUGGESTIONS })
    render(<PlayChat />)
    expect(pinned()).not.toBeNull()
    expect(pinned(LISTED.title)).toBeNull()
  })
})

describe('the pinned suggestion, on the phone (below 1024 px)', () => {
  it('sits above the message box, under Auto standing over it', async () => {
    setWindowWidth(PHONE_WIDTH)
    host.setMinWidth(360)
    host.setWidth(PHONE_WIDTH)
    await renderConversation()
    const line = pinned() as HTMLElement
    expect(line).not.toBeNull()
    expect(screen.queryByRole('complementary', { name: 'Auto' })).toBeNull()
    expect(before(screen.getByTestId('auto'), line)).toBe(true)
    expect(before(line, box())).toBe(true)
  })
})
