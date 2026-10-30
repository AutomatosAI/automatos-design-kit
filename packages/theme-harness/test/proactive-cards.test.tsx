/**
 * PRD-268 (SDK 1.3.0): the cards area's proactive stand-ins (src/sdk/cards/*), read through the SDK as a theme places
 * them, on the harness's sample brief, readiness and suggestions (fixtures/proactive/). Each checks its props as core's
 * wrapper does (a TypeError naming the card and the prop), draws core's words and data attributes, marks Auto's words
 * data-ai-generated outside the controls, and keeps its presses (Start and Hide as the area's runs, the rest as card
 * actions). The voice area's BriefVoice: Listen, disabled until the host holds a brief and while a voice session runs.
 */
import {
  BriefCard, BriefVoice, ReplyChips, StatusLabel, SuggestionCard, type BriefCardProps, type ReplyChipsProps, type StartAnswer,
  type SuggestionCardProps,
} from '@automatos/theme-sdk'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { Component, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { host } from '../src/host.ts'
import { SAMPLE_PAGE_DATA } from '../src/host/sample-data.ts'
import { LISTEN_TO_THE_BRIEF, READING_THE_BRIEF } from '../src/sdk/brief-voice.tsx'
import { STARTED_LINE, SUGGESTS_LABEL } from '../src/sdk/cards/suggestion-card.tsx'
import { HIDE_MENU_LABEL, START_DOES } from '../src/sdk/cards/suggestion-parts.tsx'

const BRIEF = SAMPLE_PAGE_DATA.brief
const [TICKET_SUGGESTION, CHAT_SUGGESTION] = SAMPLE_PAGE_DATA.suggestions
const AI = '[data-ai-generated="true"]'

/** A theme's error boundary: what a card threw, as one line. */
class Caught extends Component<{ readonly children: ReactNode }, { readonly error: Error | null }> {
  override state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  override render() {
    return this.state.error === null ? this.props.children : <p role="alert">{this.state.error.message}</p>
  }
}

const alerts = (): string[] => screen.getAllByRole('alert').map((alert) => alert.textContent ?? '')

beforeEach(() => {
  host.reset()
})

describe('BriefCard', () => {
  it("draws the date, the greeting, Auto's Read and each section with its label and exact count, Auto's words marked", () => {
    const { container } = render(<BriefCard brief={BRIEF} listen={false} />)
    const card = screen.getByRole('article', { name: BRIEF.greeting })
    expect(card).toHaveAttribute('data-brief-date', BRIEF.date)
    expect(Array.from(container.querySelectorAll('[data-section]'), (section) => section.getAttribute('data-section'))).toEqual([
      'needs_you', 'suggestions', 'today', 'since', 'unchecked',
    ])
    expect(within(screen.getByRole('region', { name: 'Needs you' })).getAllByRole('listitem')).toHaveLength(BRIEF.counts.needs_you)
    expect(container.querySelector('[data-section="needs_you"] [data-section-count]')).toHaveTextContent(String(BRIEF.counts.needs_you))
    expect(container.querySelector('[data-section="unchecked"] [data-section-count]')).toBeNull()
    expect(Array.from(container.querySelectorAll(AI), (node) => node.textContent)).toEqual(expect.arrayContaining([BRIEF.greeting, BRIEF.prose]))
    expect(within(card).getByRole('note', { name: 'Auto is an AI' })).toBeInTheDocument()
    expect(container.querySelector(`${AI} button`)).toBeNull()
  })

  it('draws a row action only when the theme can run it, and shows its done label once the handler resolves', async () => {
    const { rerender } = render(<BriefCard brief={BRIEF} listen={false} />)
    expect(screen.queryByRole('button', { name: `Start: ${TICKET_SUGGESTION.title}` })).toBeNull()
    const onAction = vi.fn<NonNullable<BriefCardProps['onAction']>>(() => Promise.resolve())
    rerender(<BriefCard brief={BRIEF} listen={false} onAction={onAction} />)
    fireEvent.click(screen.getByRole('button', { name: `Start: ${TICKET_SUGGESTION.title}` }))
    expect(await screen.findByText('Started')).toBeInTheDocument()
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ id: TICKET_SUGGESTION.id }), 'suggestions')
    expect(Object.isFrozen(onAction.mock.calls[0]?.[0])).toBe(true)
  })

  it('leaves a refused press pressable, opens a row with somewhere to go, and says the empty sentence for an empty brief', async () => {
    const onOpen = vi.fn()
    render(<BriefCard brief={BRIEF} listen={false} onAction={() => Promise.reject(new Error('offline'))} onOpen={onOpen} />)
    const answer = screen.getByRole('button', { name: 'Answer: Which budget should the laptops stay under?' })
    fireEvent.click(answer)
    await waitFor(() => expect(answer).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: 'Open: Check the three laptop reviews' }))
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ opens: { type: 'ticket', id: '101' } }), 'needs_you')
    expect(screen.queryByRole('button', { name: 'Open: Post the bake sale reminder' })).toBeNull()
    const empty = { ...BRIEF, sections: { needs_you: [], suggestions: [], today: [], since: [], unchecked: [] } }
    render(<BriefCard brief={empty} listen={false} />)
    expect(screen.getByText(BRIEF.labels.empty ?? '')).toHaveAttribute('data-brief-empty', '')
  })

  it('refuses a brief that is not a Brief@1, and a listen that is not true or false', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(<Caught><BriefCard brief={{ ...BRIEF, v: 2 } as unknown as BriefCardProps['brief']} /></Caught>)
    render(<Caught><BriefCard brief={BRIEF} listen={'yes' as unknown as boolean} /></Caught>)
    expect(alerts()).toEqual([
      'Automatos theme SDK: BriefCard needs brief to be a Brief@1 (v 1, with its date, greeting and prose).',
      'Automatos theme SDK: BriefCard needs listen to be true or false.',
    ])
    quiet.mockRestore()
  })
})

describe('SuggestionCard', () => {
  it("draws Auto suggests, the suggestion as Auto's words, what Start does, its credits, Start and Hide", () => {
    render(<SuggestionCard suggestion={TICKET_SUGGESTION} />)
    const card = screen.getByRole('article', { name: `${SUGGESTS_LABEL}: ${TICKET_SUGGESTION.title}` })
    expect(card).toHaveAttribute('data-state', 'open')
    expect(within(card).getByText(TICKET_SUGGESTION.title).closest(AI)).not.toBeNull()
    expect(within(card).getByText(START_DOES.board_task)).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: `Start: ${TICKET_SUGGESTION.title} (about 40 credits)` })).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: `Hide: ${TICKET_SUGGESTION.title}` })).toBeInTheDocument()
  })

  it("starts through the area's Start: kept as a run, the started line in place, and Start's answer handed back", async () => {
    const onStarted = vi.fn<(answer: StartAnswer) => void>()
    render(<SuggestionCard suggestion={CHAT_SUGGESTION} onStarted={onStarted} />)
    fireEvent.click(screen.getByRole('button', { name: `Start: ${CHAT_SUGGESTION.title}` }))
    expect(await screen.findByText(STARTED_LINE)).toBeInTheDocument()
    expect(host.pageRuns()).toEqual([{ hook: 'useStartSuggestion', variables: { id: CHAT_SUGGESTION.id } }])
    expect(onStarted.mock.calls[0]?.[0]).toMatchObject({ opens: { type: 'chat', suggestion_id: CHAT_SUGGESTION.id } })
  })

  it('hides with a reason from its menu, and a refused Start is one line while the card stays', async () => {
    const refusal = Object.assign(new Error('refused'), { status: 409, body: { code: 'over_ceiling', detail: 'That would pass the spend ceiling.' } })
    host.setPageAction('useStartSuggestion', () => Promise.reject(refusal))
    render(<SuggestionCard suggestion={TICKET_SUGGESTION} />)
    fireEvent.click(screen.getByRole('button', { name: `Start: ${TICKET_SUGGESTION.title} (about 40 credits)` }))
    expect(await screen.findByRole('alert')).toHaveTextContent('That would pass the spend ceiling.')
    fireEvent.click(screen.getByRole('button', { name: `Hide: ${TICKET_SUGGESTION.title}` }))
    fireEvent.click(within(screen.getByRole('group', { name: HIDE_MENU_LABEL })).getByRole('button', { name: 'Not now' }))
    expect(await screen.findByText('Hidden')).toBeInTheDocument()
    expect(host.pageRuns().at(-1)).toEqual({ hook: 'useHideSuggestion', variables: { id: TICKET_SUGGESTION.id, reason: 'not_now' } })
  })

  it('pins one line whose title opens the card, and refuses a suggestion or a variant that is not one', () => {
    const onOpen = vi.fn()
    render(<SuggestionCard suggestion={TICKET_SUGGESTION} variant="pinned" onOpen={onOpen} />)
    expect(screen.getByRole('group', { name: `${SUGGESTS_LABEL}: ${TICKET_SUGGESTION.title}` })).toHaveAttribute('data-variant', 'pinned')
    fireEvent.click(screen.getByRole('button', { name: `Open: ${TICKET_SUGGESTION.title}` }))
    expect(onOpen).toHaveBeenCalledTimes(1)
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(<Caught><SuggestionCard suggestion={{ ...TICKET_SUGGESTION, id: 'not-a-uuid' }} /></Caught>)
    const sideways = 'sideways' as unknown as SuggestionCardProps['variant']
    render(<Caught><SuggestionCard suggestion={TICKET_SUGGESTION} variant={sideways} /></Caught>)
    expect(alerts()).toEqual([
      "Automatos theme SDK: SuggestionCard needs suggestion to be one of useSuggestions' rows (its id, title and proposed_action).",
      'Automatos theme SDK: SuggestionCard needs variant to be one of card, pinned.',
    ])
    quiet.mockRestore()
  })
})

describe('StatusLabel and ReplyChips', () => {
  it('draws a state as its glyph and word with ▸ its next step and a named Try again, and nothing for an unknown state', () => {
    const onRetry = vi.fn()
    const { container } = render(<StatusLabel state="failed" nextStep="The site didn't answer." retry="rerun_mission" onRetry={onRetry} title="Prices" />)
    expect(container.querySelector('[data-display-state="failed"]')).toHaveTextContent("✕Couldn't finish▸ The site didn't answer.Try again")
    fireEvent.click(screen.getByRole('button', { name: 'Try again: Prices' }))
    expect(onRetry).toHaveBeenCalledWith('rerun_mission')
    expect(host.cardActions()).toEqual([{ card: 'status-label', id: 'Prices', action: 'rerun_mission' }])
    const unknown = render(<StatusLabel state={'thinking' as unknown as 'working'} />)
    expect(unknown.container).toBeEmptyDOMElement()
  })

  it('draws two or three short answers under the latest message, sends one once, and none on an older message', async () => {
    const onReply = vi.fn<ReplyChipsProps['onReply']>(() => Promise.resolve())
    const { rerender, container } = render(<ReplyChips chips={['Window seat', ' Aisle seat ', 'a'.repeat(30)]} latest onReply={onReply} />)
    expect(screen.getAllByRole('button').map((chip) => chip.getAttribute('aria-label'))).toEqual(['Reply: Window seat', 'Reply: Aisle seat'])
    fireEvent.click(screen.getByRole('button', { name: 'Reply: Aisle seat' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reply: Window seat' }))
    expect(onReply.mock.calls).toEqual([['Aisle seat']])
    rerender(<ReplyChips chips={['Window seat', 'Aisle seat']} latest={false} onReply={onReply} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('BriefVoice', () => {
  it("is disabled until the host holds a brief, reads it on Listen with the caption and Stop, and follows it on its root", () => {
    const { container } = render(<BriefVoice />)
    expect(screen.getByRole('button', { name: LISTEN_TO_THE_BRIEF })).toBeDisabled()
    act(() => host.setPageQuery('useBrief', { data: BRIEF }))
    fireEvent.click(screen.getByRole('button', { name: LISTEN_TO_THE_BRIEF }))
    const root = container.querySelector('[data-brief-voice="root"]')
    expect(root).toHaveAttribute('data-voice-speaking', 'true')
    expect(within(container.querySelector('[data-protected-surface="brief-voice"]') as HTMLElement).getByRole('note')).toHaveTextContent('AI voice assistant')
    expect(screen.getByRole('status')).toHaveTextContent(READING_THE_BRIEF)
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(root).not.toHaveAttribute('data-voice-speaking')
    expect(host.cardActions().map((action) => action.action)).toEqual(['listen', 'stop'])
  })

  it("stops reading when the tab's voice session starts, and holds Listen while it runs", () => {
    host.setPageQuery('useBrief', { data: BRIEF })
    host.setBriefReading(true)
    const { container } = render(<BriefVoice />)
    expect(container.querySelector('[data-voice-speaking="true"]')).not.toBeNull()
    act(() => host.setVoicePhase('listening'))
    expect(container.querySelector('[data-voice-speaking]')).toBeNull()
    expect(screen.getByRole('button', { name: LISTEN_TO_THE_BRIEF })).toBeDisabled()
  })
})
