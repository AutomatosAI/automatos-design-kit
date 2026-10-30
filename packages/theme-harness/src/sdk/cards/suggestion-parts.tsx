/**
 * PRD-268 (SDK 1.3.0): the suggestion stand-in's parts, after core's frontend/components/proactive/suggestion-parts.tsx
 * (at 1a8956c874dc42cff05b96f431c50b7d722a71aa): what Start does, its credits once known, Start (the view's one ink
 * primary) and Hide with its reason menu (Escape closes it and puts focus back on Hide), each named by the suggestion,
 * and the one line of a decided card. The suggestion's title is model-written: drawn as text only.
 */
import type { HideReason, ProposedAction, Suggestion } from '@automatos/theme-sdk'
import { type KeyboardEvent, type ReactElement, useEffect, useId, useRef, useState } from 'react'
import { HIDE_REASONS } from '../../internal/proactive/wire.ts'
import { AiCaption } from './proactive-parts.tsx'
import { LINE, PRIMARY_BUTTON, QUIET_BUTTON, SMALL_MUTED } from './proactive-styles.ts'

/** suggestion-parts.tsx START_DOES: what Start does, per kind of proposed action. */
export const START_DOES: Readonly<Record<ProposedAction['kind'], string>> = Object.freeze({
  board_task: 'Start does: files a ticket on the Board for an agent to work.',
  chat: 'Start does: opens a chat with Auto about this.',
  mission: 'Start does: plans a Mission.',
  playbook_run: 'Start does: runs a Playbook.',
})
export const HIDE_REASON_LABELS: Readonly<Record<HideReason, string>> = Object.freeze({
  not_now: 'Not now', not_useful: 'Not useful', wrong_agent: 'Wrong agent',
})
export const HIDE_WITHOUT_REASON = 'Just hide'
export const HIDE_MENU_LABEL = 'Why hide it?'
export const START = 'Start'
export const HIDE = 'Hide'
export const CLOSED_WORDS = Object.freeze({ started: 'Started', hidden: 'Hidden', expired: 'Expired' })
export type ClosedPhase = keyof typeof CLOSED_WORDS

export function startDoesOf(action: ProposedAction | null | undefined): string | null {
  const kind = action?.kind
  return typeof kind === 'string' && Object.prototype.hasOwnProperty.call(START_DOES, kind) ? START_DOES[kind] : null
}

/** suggestion-parts.tsx creditsOf: "about N credits", once the cost is known; null until then. */
export function creditsOf(estCredits: number | null | undefined): string | null {
  if (typeof estCredits !== 'number' || !Number.isFinite(estCredits) || estCredits < 0) return null
  const credits = Math.round(estCredits)
  return `about ${credits} credit${credits === 1 ? '' : 's'}`
}

function HideMenu({ id, busy, onHide }: { readonly id: string; readonly busy: boolean; readonly onHide: (reason?: HideReason) => void }) {
  const first = useRef<HTMLButtonElement>(null)
  useEffect(() => first.current?.focus(), [])
  return (
    <div id={id} role="group" aria-label={HIDE_MENU_LABEL} style={{ ...LINE, flexBasis: '100%' }}>
      {HIDE_REASONS.map((reason, index) => (
        <button key={reason} ref={index === 0 ? first : undefined} type="button" disabled={busy} style={QUIET_BUTTON} onClick={() => onHide(reason)}>
          {HIDE_REASON_LABELS[reason]}
        </button>
      ))}
      <button type="button" disabled={busy} style={QUIET_BUTTON} onClick={() => onHide()}>{HIDE_WITHOUT_REASON}</button>
    </div>
  )
}

export interface SuggestionActionsProps {
  readonly suggestion: Suggestion
  readonly starting: boolean
  readonly busy: boolean
  readonly onStart: () => void
  readonly onHide: (reason?: HideReason) => void
}

/** suggestion-parts.tsx SuggestionActions: Start (with its credits when known) and Hide with its reason menu. */
export function SuggestionActions({ suggestion, starting, busy, onStart, onHide }: SuggestionActionsProps): ReactElement {
  const [menuOpen, setMenuOpen] = useState(false)
  const hideButton = useRef<HTMLButtonElement>(null)
  const menuId = useId()
  const credits = creditsOf(suggestion.est_credits)
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Escape' || !menuOpen) return
    event.preventDefault()
    setMenuOpen(false)
    hideButton.current?.focus()
  }
  return (
    <div style={LINE} onKeyDown={onKeyDown}>
      <button
        type="button" aria-label={`${START}: ${suggestion.title}${credits ? ` (${credits})` : ''}`} aria-busy={starting} disabled={busy}
        style={PRIMARY_BUTTON} onClick={onStart}
      >
        {START}
        {credits ? <span>({credits})</span> : null}
      </button>
      <button
        ref={hideButton} type="button" aria-label={`${HIDE}: ${suggestion.title}`} aria-expanded={menuOpen} aria-controls={menuOpen ? menuId : undefined}
        disabled={busy} style={QUIET_BUTTON} onClick={() => setMenuOpen((open) => !open)}
      >
        {HIDE}
      </button>
      {menuOpen ? <HideMenu id={menuId} busy={busy} onHide={onHide} /> : null}
    </div>
  )
}

/** suggestion-parts.tsx ClosedLine: the title, what became of it, and the caption. */
export function ClosedLine({ suggestion, phase }: { readonly suggestion: Suggestion; readonly phase: ClosedPhase }): ReactElement {
  return (
    <div data-suggestion-id={suggestion.id} data-state={phase} style={{ ...LINE, ...SMALL_MUTED }}>
      <span data-ai-generated="true">{suggestion.title}</span>
      <span aria-hidden="true">·</span>
      <span>{CLOSED_WORDS[phase]}</span>
      <AiCaption />
    </div>
  )
}
