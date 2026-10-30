// HUD 1.2.0 (PRD-268): the `▸ NEXT` line on the harness's fake proactive area. On the desktop between the host's
// credits banner and the voice deck, over the message box; on the phone under the top line, never over the controls.
// The newest open suggestion, its title as Auto's words, START and HIDE as SAY chips that can be tapped, each named by
// its words and the suggestion: START through the SDK, "Started. Auto is on it." for 4 s, then the next; HIDE asks why first; a refusal stays put
// with one line. Never spoken: in no live region, and nothing asked of the host's voice. Nothing without a suggestion;
// no movement under reduced motion. Roles, names and attributes only; every value is made up.
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { host } from '@automatos/theme-harness/host'
import { HudChatPage } from '../../src/chat/hud-chat.tsx'
import {
  HIDE_REASONS_LABEL, JUST_HIDE, NEXT_LABEL, SAY_HIDE, SAY_START, STARTED_LINE,
} from '../../src/chat/next/next-line.tsx'
import { STARTED_MS } from '../../src/chat/next/use-next.ts'
import { CONTROLS_LABEL } from '../../src/chat/phone/phone-controls.tsx'
import { PHONE_WIDTH, resetWindowWidth, setWindowWidth } from '../support/window-width.ts'
import { box, openChat, renderChat, stubClips } from '../chat/support.tsx'
import { BRIEF, OTHER_SUGGESTION_ID, SUGGESTION_ID, SUGGESTIONS } from './support.ts'

const FIRST = SUGGESTIONS[0].title
const SECOND = SUGGESTIONS[1].title
const next = (): HTMLElement => screen.getByRole('group', { name: NEXT_LABEL })
const startChip = (title = FIRST): HTMLElement => within(next()).getByRole('button', { name: `${SAY_START}: ${title}` })
const hideChip = (title = FIRST): HTMLElement => within(next()).getByRole('button', { name: `${SAY_HIDE}: ${title}` })
const giveSuggestions = (): void => act(() => host.setPageQuery('useSuggestions', { data: SUGGESTIONS }))

/** The footer child holding `element`. */
function footerPart(footer: HTMLElement, element: Element): number {
  return Array.from(footer.children).findIndex((child) => child.contains(element))
}

beforeEach(() => {
  host.reset()
  stubClips()
})

afterEach(() => {
  vi.useRealTimers()
  resetWindowWidth()
})

describe('where the line sits', () => {
  it('sits between the credits banner and the voice deck, over the message box, on the desktop', async () => {
    host.setTrial({ state: 'exhausted', grantedUsd: 5, spentUsd: 5 })
    await renderChat()
    giveSuggestions()
    const footer = next().parentElement as HTMLElement
    const banner = footer.querySelector('[data-protected-surface="trial-exhausted-banner"]') as HTMLElement
    const voice = footer.querySelector('[data-voice-button="root"]') as HTMLElement
    const order = [footerPart(footer, banner), footerPart(footer, next()), footerPart(footer, voice), footerPart(footer, box())]
    expect(order.every((index) => index >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(new Set(order).size).toBe(order.length)
  })

  it('sits under the top line on the phone, never over TYPE · HOLD TO TALK', async () => {
    setWindowWidth(PHONE_WIDTH)
    openChat()
    render(<HudChatPage />)
    await screen.findByRole('article', { name: 'You said' })
    giveSuggestions()
    expect(next().previousElementSibling).toHaveTextContent('Auto · Ready')
    const controls = screen.getByRole('group', { name: CONTROLS_LABEL })
    expect(controls.parentElement).not.toContainElement(next())
    expect(next().compareDocumentPosition(controls) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('draws nothing while the list loads, or with no suggestion open', async () => {
    await renderChat()
    expect(screen.queryByRole('group', { name: NEXT_LABEL })).toBeNull()
    act(() => host.setPageQuery('useSuggestions', { data: [{ ...SUGGESTIONS[0], status: 'started' }] }))
    expect(screen.queryByRole('group', { name: NEXT_LABEL })).toBeNull()
  })
})

describe('the line', () => {
  it("shows the newest open suggestion as Auto's words, with SAY chips named by their words and it", async () => {
    await renderChat()
    giveSuggestions()
    expect(within(next()).getByText(FIRST)).toHaveAttribute('data-ai-generated', 'true')
    expect(within(next()).queryByText(SECOND)).toBeNull()
    expect(startChip()).toHaveTextContent(SAY_START)
    expect(hideChip()).toHaveTextContent(SAY_HIDE)
    expect(next()).toHaveAttribute('data-suggestion-id', SUGGESTION_ID)
  })

  it('starts it through the SDK when its chip is tapped, says so for 4 s, then shows the next', async () => {
    await renderChat()
    giveSuggestions()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    await act(async () => {
      fireEvent.click(startChip())
    })
    expect(host.pageRuns()).toContainEqual({ hook: 'useStartSuggestion', variables: { id: SUGGESTION_ID } })
    expect(screen.getByText(STARTED_LINE)).toHaveAttribute('role', 'status')
    expect(screen.queryByRole('group', { name: NEXT_LABEL })).toBeNull()
    act(() => {
      vi.advanceTimersByTime(STARTED_MS)
    })
    expect(within(next()).getByText(SECOND)).toBeInTheDocument()
    expect(next()).toHaveAttribute('data-suggestion-id', OTHER_SUGGESTION_ID)
  })

  it('asks why before it hides, hides with the reason picked or none, and Escape shuts the reasons', async () => {
    await renderChat()
    giveSuggestions()
    fireEvent.click(hideChip())
    expect(hideChip()).toHaveAttribute('aria-expanded', 'true')
    const reasons = within(next()).getByRole('group', { name: HIDE_REASONS_LABEL })
    expect(within(reasons).getAllByRole('button')[0]).toHaveFocus()
    fireEvent.keyDown(reasons, { key: 'Escape' })
    expect(within(next()).queryByRole('group', { name: HIDE_REASONS_LABEL })).toBeNull()
    expect(hideChip()).toHaveFocus()
    fireEvent.click(hideChip())
    await act(async () => {
      fireEvent.click(within(next()).getByRole('button', { name: 'Not useful' }))
    })
    expect(host.pageRuns()).toContainEqual({ hook: 'useHideSuggestion', variables: { id: SUGGESTION_ID, reason: 'not_useful' } })
    expect(within(next()).getByText(SECOND)).toBeInTheDocument()
    fireEvent.click(hideChip(SECOND))
    await act(async () => {
      fireEvent.click(within(next()).getByRole('button', { name: JUST_HIDE }))
    })
    expect(host.pageRuns()).toContainEqual({ hook: 'useHideSuggestion', variables: { id: OTHER_SUGGESTION_ID } })
    expect(screen.queryByRole('group', { name: NEXT_LABEL })).toBeNull()
  })

  it('says why in one line when Start is refused, and stays put', async () => {
    host.setPageAction('useStartSuggestion', () => {
      throw new Error('The spend ceiling for today is reached.')
    })
    await renderChat()
    giveSuggestions()
    await act(async () => {
      fireEvent.click(startChip())
    })
    expect(within(next()).getByRole('alert')).toHaveTextContent('The spend ceiling for today is reached.')
    expect(within(next()).getByText(FIRST)).toBeInTheDocument()
  })
})

describe('one suggestion, shown once', () => {
  it('skips the suggestion BRIEFING lists with its own Start while BRIEFING shows, and shows it again once it folds', async () => {
    await renderChat()
    giveSuggestions()
    act(() => host.setPageQuery('useBrief', { data: BRIEF }))
    expect(BRIEF.sections.suggestions.map((row) => row.opens?.id)).toEqual([SUGGESTION_ID])
    expect(next()).toHaveAttribute('data-suggestion-id', OTHER_SUGGESTION_ID)
    expect(within(next()).queryByText(FIRST)).toBeNull()
    fireEvent.pointerDown(document.body)
    expect(next()).toHaveAttribute('data-suggestion-id', SUGGESTION_ID)
  })

  it('does the same on the phone', async () => {
    setWindowWidth(PHONE_WIDTH)
    openChat()
    render(<HudChatPage />)
    await screen.findByRole('article', { name: 'You said' })
    giveSuggestions()
    act(() => host.setPageQuery('useBrief', { data: BRIEF }))
    expect(next()).toHaveAttribute('data-suggestion-id', OTHER_SUGGESTION_ID)
  })
})

describe('never spoken', () => {
  it("sits in no live region, and START and HIDE ask nothing of the host's voice", async () => {
    await renderChat()
    giveSuggestions()
    const title = within(next()).getByText(FIRST)
    expect(title.closest('[aria-live], [role="status"], [role="alert"], [role="log"]')).toBeNull()
    fireEvent.click(hideChip())
    await act(async () => {
      fireEvent.click(startChip())
    })
    expect(host.voicePresses()).toEqual([])
    expect(host.voiceStops()).toEqual([])
    expect(host.cardActions().filter((action) => action.card === 'brief-voice')).toEqual([])
  })
})

describe('motion', () => {
  it('enters once while motion is allowed, and not at all under reduced motion', async () => {
    const { unmount } = await renderChat()
    giveSuggestions()
    expect(next()).toHaveAttribute('data-hud-enter', 'rise')
    unmount()
    host.setReducedMotion(true)
    await renderChat()
    giveSuggestions()
    expect(next()).not.toHaveAttribute('data-hud-enter')
  })
})
