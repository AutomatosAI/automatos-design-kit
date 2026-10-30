/**
 * PRD-261 B-02c: what the owner did on the host cards' stand-ins (src/sdk/cards/*.tsx), and what a theme handed the
 * host's markdown renderer. Not an SDK name.
 *
 * Core's cards make the host's own calls (approve or deny a grant, approve or reject a Mission, withdraw a request,
 * create a Mission); the stand-ins make none and keep each click here instead, for a test to read back
 * (cardActions). Every stand-in's root carries data-protected-surface with the card's name, so a test can find it
 * and a theme's stylesheet can be checked against it (core's components/theme-host/protected-surface.tsx:29).
 * AiLabelFence has no root: it draws its children alone, as core's does since #1365. SDK 1.3.0's proactive defaults
 * (BriefCard, SuggestionCard, StatusLabel, ReadinessList, CalibrationCard, ReplyChips) are not protected surfaces in
 * core, so their stand-ins carry core's own data attributes instead; the voice area's BriefVoice is one (`brief-voice`).
 * Their presses are kept here by the same names.
 */
import type { MarkdownViewProps } from '@automatos/theme-sdk'
import { log } from '../cell.ts'

/** core components/theme-host/protected-surface.tsx:29-30. */
export const PROTECTED_SURFACE_ATTR = 'data-protected-surface'
export const PROTECTED_SURFACE_INNER_ATTR = 'data-protected-surface-inner'

/** The name each stand-in's root carries in data-protected-surface (core's two protected cards keep theirs). */
export type CardName =
  | 'tool-approval'
  | 'mission-approval'
  | 'task-card'
  | 'withdraw-offer'
  | 'mission-suggestion'
  | 'mission-created'
  | 'file-preview'
  | 'markdown-view'
  | 'made-by'
  | 'trial-exhausted-banner'
  | 'first-run-nudge'
  | 'header-utilities'
  | 'core-page'
  | 'brief-card'
  | 'suggestion-card'
  | 'status-label'
  | 'readiness-list'
  | 'calibration-card'
  | 'reply-chips'
  | 'brief-voice'

/** One click on a card: which card, what it was about (a grant, a Mission, a chat), and what the owner chose. */
export interface CardAction {
  readonly card: CardName
  readonly id: string
  readonly action: string
}

const actions = log<CardAction>()
const markdown = log<MarkdownViewProps>()

export function recordCardAction(action: CardAction): void {
  actions.add(Object.freeze({ ...action }))
}

/** Every click on a card since the last reset, oldest first. */
export function cardActions(): readonly CardAction[] {
  return actions.all()
}

/**
 * The stand-in shows its text as it is, so the props each MarkdownView drew with (the theme's element overrides,
 * skipHtml, the text) are kept for a test to read: the host renders the markdown by them (cards.test in core).
 */
export function recordMarkdownView(props: MarkdownViewProps): void {
  markdown.add(Object.freeze({ ...props }))
}

/** Every MarkdownView render since the last reset, oldest first, with the props it was given. */
export function markdownViews(): readonly MarkdownViewProps[] {
  return markdown.all()
}

export function resetCardsLog(): void {
  actions.clear()
  markdown.clear()
}
