/**
 * PRD-268 (SDK 1.3.0): the stand-in for SDK card `SuggestionCard`. It mirrors core's
 * frontend/lib/theme-sdk/host-cards/proactive-cards.tsx SuggestionCard over components/proactive/suggestion-card.tsx
 * and use-suggestion-card.ts (at 1a8956c874dc42cff05b96f431c50b7d722a71aa): the props checked (the suggestion read as
 * the host reads one, a TypeError naming the prop), then "Auto suggests", the title and detail as Auto's words, what
 * the theme draws under them, what Start does, Start and Hide, and the caption; or the pinned line (`variant`
 * 'pinned'), whose title opens the card when the theme passes `onOpen`.
 *
 * Start and Hide run the fake area's useStartSuggestion and useHideSuggestion, so each is kept as a run with core's
 * variables (host.pageRuns()). Started, the card says "Started. Auto is on it." for STARTED_MS, then one line; Hide
 * gives one line; an expired or decided suggestion is one line too, and the pinned line goes. A refusal (the run's
 * answer throws) is one line and the card stays. `onStarted` gets a frozen copy of Start's answer: the one a test set,
 * else the suggestion started, opening its chat.
 */
import type { HideReason, StartAnswer, Suggestion } from '@automatos/theme-sdk'
import { type ReactElement, type ReactNode, useEffect, useMemo, useState } from 'react'
import { frozenCopy } from '../../internal/page-views.ts'
import { checkedSuggestion, checkedVariant, handlerOf } from '../../internal/proactive/props.ts'
import { refusedLine } from '../../internal/proactive/wire.ts'
import { useHideSuggestion, useStartSuggestion } from '../proactive.ts'
import { AiCaption, Eyebrow, RefusedLine } from './proactive-parts.tsx'
import { CARD, MUTED, PINNED, SMALL_MUTED, TEXT_BUTTON, TITLE } from './proactive-styles.ts'
import { ClosedLine, type ClosedPhase, startDoesOf, SuggestionActions } from './suggestion-parts.tsx'

type Sdk = typeof import('@automatos/theme-sdk')

export const SUGGESTS_LABEL = 'Auto suggests'
export const STARTED_LINE = 'Started. Auto is on it.'
/** use-suggestion-card.ts STARTED_MS: how long "Started. Auto is on it." shows in the card's place. */
export const STARTED_MS = 4_000
const CARD_NAME = 'SuggestionCard'

type Phase = 'open' | 'starting' | 'just_started' | ClosedPhase

interface CardState {
  readonly phase: Phase
  readonly refused: string | null
  readonly busy: boolean
  readonly start: () => void
  readonly hide: (reason?: HideReason) => void
}

/** Start's answer when a test set none: the suggestion started, opening its chat with Auto. */
function startedAnswer(suggestion: Suggestion, answer: StartAnswer | null): StartAnswer {
  return answer ?? { suggestion: { ...suggestion, status: 'started' }, opens: { type: 'chat', suggestion_id: suggestion.id } }
}

function phaseOf(status: Suggestion['status'], starting: boolean, justStarted: boolean, decided: ClosedPhase | null): Phase {
  if (justStarted) return 'just_started'
  if (decided !== null) return decided
  if (status === 'started' || status === 'hidden' || status === 'expired') return status
  return starting ? 'starting' : 'open'
}

/** The "Started. Auto is on it." line's few seconds, from a Start that went through. */
function useJustStarted(): readonly [boolean, () => void] {
  const [justStarted, setJustStarted] = useState(false)
  useEffect(() => {
    if (!justStarted) return undefined
    const timer = setTimeout(() => setJustStarted(false), STARTED_MS)
    return () => clearTimeout(timer)
  }, [justStarted])
  return [justStarted, () => setJustStarted(true)]
}

/** use-suggestion-card.ts useSuggestionCard, over the fake area's Start and Hide; a press clears the other's refusal. */
function useCardState(suggestion: Suggestion, onStarted?: (answer: StartAnswer) => void): CardState {
  const starter = useStartSuggestion()
  const hider = useHideSuggestion()
  const [decided, setDecided] = useState<ClosedPhase | null>(null)
  const [refused, setRefused] = useState<string | null>(null)
  const [justStarted, markStarted] = useJustStarted()
  const refuse = (error: unknown): void => setRefused(refusedLine(error))
  const start = (): void => {
    setRefused(null)
    starter.runAsync({ id: suggestion.id }).then((answer: StartAnswer | null) => {
      setDecided('started')
      markStarted()
      onStarted?.(frozenCopy(startedAnswer(suggestion, answer)))
    }, refuse)
  }
  const hide = (reason?: HideReason): void => {
    setRefused(null)
    hider.runAsync(reason ? { id: suggestion.id, reason } : { id: suggestion.id }).then(() => setDecided('hidden'), refuse)
  }
  return {
    phase: phaseOf(suggestion.status, starter.isRunning, justStarted, decided),
    refused,
    busy: starter.isRunning || hider.isRunning,
    start,
    hide,
  }
}

interface ShownProps {
  readonly suggestion: Suggestion
  readonly card: CardState
  readonly onOpen?: () => void
  readonly children?: ReactNode
  readonly className?: string
}

function Actions({ suggestion, card }: Pick<ShownProps, 'suggestion' | 'card'>): ReactElement {
  return (
    <>
      <SuggestionActions suggestion={suggestion} starting={card.phase === 'starting'} busy={card.busy} onStart={card.start} onHide={card.hide} />
      <RefusedLine text={card.refused} />
    </>
  )
}

function FullCard({ suggestion, card, children, className }: ShownProps): ReactElement {
  const startDoes = startDoesOf(suggestion.proposed_action)
  return (
    <article
      aria-label={`${SUGGESTS_LABEL}: ${suggestion.title}`} data-suggestion-id={suggestion.id} data-state={card.phase} className={className}
      style={CARD}
    >
      <Eyebrow>{SUGGESTS_LABEL}</Eyebrow>
      {card.phase === 'just_started' ? <p role="status" style={TITLE}>{STARTED_LINE}</p> : (
        <>
          <div data-ai-generated="true">
            <p style={TITLE}>{suggestion.title}</p>
            {suggestion.detail ? <p style={MUTED}>{suggestion.detail}</p> : null}
          </div>
          {children}
          {startDoes ? <p style={SMALL_MUTED}>{startDoes}</p> : null}
          <Actions suggestion={suggestion} card={card} />
        </>
      )}
      <AiCaption />
    </article>
  )
}

function PinnedLine({ suggestion, card, onOpen, className }: ShownProps): ReactElement {
  const words = <span data-ai-generated="true">{suggestion.title}</span>
  return (
    <div
      role="group" aria-label={`${SUGGESTS_LABEL}: ${suggestion.title}`} data-suggestion-id={suggestion.id} data-state={card.phase}
      data-variant="pinned" className={className} style={PINNED}
    >
      <Eyebrow>{SUGGESTS_LABEL}</Eyebrow>
      {card.phase === 'just_started' ? <p role="status" style={TITLE}>{STARTED_LINE}</p> : (
        <>
          {onOpen ? <button type="button" aria-label={`Open: ${suggestion.title}`} style={TEXT_BUTTON} onClick={onOpen}>{words}</button> : null}
          {onOpen ? null : <span style={TITLE}>{words}</span>}
          <Actions suggestion={suggestion} card={card} />
        </>
      )}
      <AiCaption />
    </div>
  )
}

const CLOSED: ReadonlySet<Phase> = new Set<Phase>(['started', 'hidden', 'expired'])

interface BodyProps extends ShownProps {
  readonly variant: 'card' | 'pinned'
  readonly onStarted?: (answer: StartAnswer) => void
}

function SuggestionBody({ suggestion, variant, onStarted, ...shown }: Omit<BodyProps, 'card'>): ReactElement | null {
  const card = useCardState(suggestion, onStarted)
  if (CLOSED.has(card.phase)) return variant === 'pinned' ? null : <ClosedLine suggestion={suggestion} phase={card.phase as ClosedPhase} />
  const Shown = variant === 'pinned' ? PinnedLine : FullCard
  return <Shown suggestion={suggestion} card={card} {...shown} />
}

/** cards.SuggestionCard: the card, or its line pinned above a composer, with Start and Hide. */
export const SuggestionCard: Sdk['SuggestionCard'] = function SuggestionCard({ suggestion, variant, onStarted, onOpen, children, className }) {
  const shown = useMemo(() => checkedSuggestion(suggestion), [suggestion])
  const kind = checkedVariant(variant) ?? 'card'
  const started = handlerOf(onStarted, CARD_NAME, 'onStarted')
  const open = handlerOf(onOpen, CARD_NAME, 'onOpen')
  return (
    <SuggestionBody suggestion={shown} variant={kind} onStarted={started} onOpen={open} className={className}>
      {children}
    </SuggestionBody>
  )
}
