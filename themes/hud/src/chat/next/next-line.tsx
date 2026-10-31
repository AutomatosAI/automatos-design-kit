import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react'
import type { HideReason, Suggestion } from '@automatos/theme-sdk'

import { useEntrance } from '../entrance'
import styles from './next.module.css'
import { type NextSuggestion, useNextSuggestion } from './use-next'

/**
 * HUD 1.2.0 (PRD-268): the `▸ NEXT` line, HUD's one place for what Auto suggests: on the desktop between the host's
 * credits banner and the voice deck, over the message box (chat-footer.tsx); on the phone under the top line, never
 * over TYPE · HOLD TO TALK (phone/status-line.tsx). The newest open suggestion's title (Auto's words, marked
 * data-ai-generated and drawn as text), then START and HIDE as SAY chips, the words a person can say to Auto, and each
 * a button that can be tapped too, its name its words and the suggestion ("Say “start”: …", so a voice-control user
 * can say what they see). HIDE opens the reasons to pick from (or Just hide); Escape shuts them. Started, the line says
 * so, HUD's own words as a status; refused, it says why. Never spoken: HUD calls no speech API, and the suggestion's
 * words are in no live region, so a screen reader reads them only when it gets there. Nothing for no suggestion.
 */

export const NEXT_LABEL = 'Next'
export const NEXT_MARK = '▸'
export const SAY_START = 'Say “start”'
export const SAY_HIDE = 'Say “hide”'
export const STARTED_LINE = 'Started. Auto is on it.'
export const HIDE_REASONS_LABEL = 'Why hide it?'
export const JUST_HIDE = 'Just hide'
export const HIDE_REASON_WORDS: Readonly<Record<HideReason, string>> = {
  not_now: 'Not now',
  not_useful: 'Not useful',
  wrong_agent: 'Wrong agent',
}
const REASONS = Object.keys(HIDE_REASON_WORDS) as readonly HideReason[]

export type NextPlace = 'footer' | 'phone'

function HideReasons({ id, next }: { readonly id: string; readonly next: NextSuggestion }) {
  const first = useRef<HTMLButtonElement>(null)
  useEffect(() => first.current?.focus(), [])
  return (
    <div id={id} className={styles.reasons} role="group" aria-label={HIDE_REASONS_LABEL}>
      {REASONS.map((reason, index) => (
        <button
          key={reason}
          ref={index === 0 ? first : undefined}
          type="button"
          className={styles.reason}
          disabled={next.busy}
          onClick={() => next.hide(reason)}
        >
          {HIDE_REASON_WORDS[reason]}
        </button>
      ))}
      <button type="button" className={styles.reason} disabled={next.busy} onClick={() => next.hide()}>
        {JUST_HIDE}
      </button>
    </div>
  )
}

/** START and HIDE as SAY chips for `suggestion`, HIDE's reasons under them (HUD 1.3.0: the thread's card has them too). */
export function SayChips({ suggestion, next }: { readonly suggestion: Suggestion; readonly next: NextSuggestion }) {
  const [asking, setAsking] = useState(false)
  const hideRef = useRef<HTMLButtonElement>(null)
  const reasonsId = useId()
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Escape' || !asking) return
    event.preventDefault()
    setAsking(false)
    hideRef.current?.focus()
  }
  return (
    <div className={styles.chips} onKeyDown={onKeyDown}>
      <button
        type="button"
        className={styles.say}
        aria-label={`${SAY_START}: ${suggestion.title}`}
        aria-busy={next.busy}
        disabled={next.busy}
        onClick={next.start}
      >
        {SAY_START}
      </button>
      <button
        ref={hideRef}
        type="button"
        className={styles.say}
        aria-label={`${SAY_HIDE}: ${suggestion.title}`}
        aria-expanded={asking}
        aria-controls={asking ? reasonsId : undefined}
        disabled={next.busy}
        onClick={() => setAsking((open) => !open)}
      >
        {SAY_HIDE}
      </button>
      {asking && <HideReasons id={reasonsId} next={next} />}
    </div>
  )
}

export interface NextLineProps {
  readonly place: NextPlace
  /** The suggestions BRIEFING on screen lists with its own Start: the line skips them. */
  readonly listed?: readonly string[]
}

export function NextLine({ place, listed }: NextLineProps) {
  const next = useNextSuggestion(listed)
  const entrance = useEntrance()
  const { suggestion } = next
  if (next.started) {
    return (
      <p className={styles.started} role="status" data-place={place}>
        {STARTED_LINE}
      </p>
    )
  }
  if (suggestion === null) return null
  return (
    <div
      className={styles.next}
      role="group"
      aria-label={NEXT_LABEL}
      data-place={place}
      data-suggestion-id={suggestion.id}
      data-hud-enter={entrance}
    >
      <span className={styles.label}>
        <span aria-hidden="true">{NEXT_MARK}</span> {NEXT_LABEL}
      </span>
      <span className={styles.title} data-ai-generated="true">
        {suggestion.title}
      </span>
      <SayChips key={suggestion.id} suggestion={suggestion} next={next} />
      {next.refused !== null && (
        <p className={styles.refused} role="alert">
          {next.refused}
        </p>
      )}
    </div>
  )
}
