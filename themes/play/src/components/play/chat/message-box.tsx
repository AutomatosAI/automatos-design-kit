'use client'

import { type ForwardedRef, type FormEvent, type KeyboardEvent, forwardRef, useCallback, useEffect, useRef, useState } from 'react'
import { AiLabelFence, VoiceButton } from '@automatos/theme-sdk'

import styles from './composer.module.css'

/**
 * PRD-260 §4 — the message box (mocks 01 and 02), ported from Automatos Play's
 * components/chat/MessageBox.tsx. Enter sends, Shift+Enter adds a line (and an
 * IME composition is never cut short), Send becomes Stop while Auto answers, and
 * Esc stops him then too (Play 1.1.1, as HUD's composer does).
 * Focus and blur tell Auto you're typing. The ref is the textarea: Try again
 * puts focus back in it as its snag box goes (P260-FX-22, M20). PRD-264 EUAI-11a: the host's
 * AI label fence (the SDK's `cards.AiLabelFence`) disables it while a theme hides the label.
 * It takes focus as it appears without scrolling the page: Chromium scrolls an autofocused
 * field into view, which pushed the first open's Auto off the top of a laptop's window.
 *
 * Play 1.2.0: the host's voice button (the SDK's voice.VoiceButton) stands beside Send, so a member can talk to
 * Auto as well as type: Live when the workspace has it, else quick-ask (mode auto), held to talk (press hold), and
 * held from the keyboard with Space anywhere but a field (core's hotkey; null where there is no keyboard to hold,
 * the phone). Core draws all of it: the press, the microphone prompt, the "AI voice assistant" caption and the stop
 * control while the microphone is open, a failure with Try again. Play only places it and colours it, through the
 * --voice-button-* custom properties and its data-voice-* attributes (composer.module.css). Text stays: the box
 * and Send never lock while voice runs.
 */

export const PLACEHOLDER = 'Message Auto'
/** The key that holds the voice button from anywhere but a field: core's default, named here. */
export const VOICE_HOTKEY = 'Space'

export interface MessageBoxProps {
  /** Auto is answering: Stop instead of Send. */
  readonly streaming: boolean
  /** False when nothing went out (a turn was still ending): the words come back. */
  readonly onSend: (text: string) => boolean
  readonly onStop: () => void
  readonly onFocus?: () => void
  readonly onBlur?: () => void
  readonly initialDraft?: string
  /** Focus the box as it appears (the first open, and after an example fills it). */
  readonly autoFocus?: boolean
  /** The voice button's hotkey: VOICE_HOTKEY on a desktop, null on a phone (no keyboard to hold). */
  readonly voiceHotkey?: string | null
}

/**
 * The textarea's ref, shared with whoever holds `forwarded`, and focus as the box appears when `autoFocus`
 * says so: focus({ preventScroll: true }) in place of the autofocus attribute, so the box has the focus and
 * the page stays where it is.
 */
function useBoxRef(forwarded: ForwardedRef<HTMLTextAreaElement>, autoFocus: boolean) {
  const own = useRef<HTMLTextAreaElement | null>(null)
  useEffect(() => {
    if (autoFocus) own.current?.focus({ preventScroll: true })
  }, [autoFocus])
  return useCallback(
    (node: HTMLTextAreaElement | null) => {
      own.current = node
      if (typeof forwarded === 'function') forwarded(node)
      else if (forwarded) forwarded.current = node
    },
    [forwarded],
  )
}

export const MessageBox = forwardRef<HTMLTextAreaElement, MessageBoxProps>(function MessageBox(
  { streaming, onSend, onStop, onFocus, onBlur, initialDraft = '', autoFocus = false, voiceHotkey = VOICE_HOTKEY },
  ref,
) {
  const [draft, setDraft] = useState(initialDraft)
  const boxRef = useBoxRef(ref, autoFocus)
  const ready = draft.trim().length > 0

  const submit = () => {
    if (streaming || !ready) return
    if (onSend(draft)) setDraft('')
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    submit()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Escape' && streaming) {
      event.preventDefault()
      onStop()
      return
    }
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    submit()
  }

  return (
    <AiLabelFence>
      <form className={styles.box} onSubmit={onSubmit}>
        <textarea
          ref={boxRef}
          className={styles.input}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={PLACEHOLDER}
          aria-label={PLACEHOLDER}
          rows={1}
        />
        <div className={styles.voice}>
          <VoiceButton mode="auto" press="hold" hotkey={voiceHotkey} size="md" />
        </div>
        {streaming ? (
          <button type="button" className={styles.stop} onClick={() => onStop()}>
            <span className={styles.stopIcon} aria-hidden="true" />
            Stop
          </button>
        ) : (
          <button type="submit" className={styles.send} disabled={!ready}>
            Send
          </button>
        )}
      </form>
    </AiLabelFence>
  )
})
