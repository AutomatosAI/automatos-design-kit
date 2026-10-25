'use client'

import { type ForwardedRef, type FormEvent, type KeyboardEvent, forwardRef, useCallback, useEffect, useRef, useState } from 'react'
import { AiLabelFence } from '@automatos/theme-sdk'

import styles from './composer.module.css'

/**
 * PRD-260 §4 — the message box (mocks 01 and 02), ported from Automatos Play's
 * components/chat/MessageBox.tsx. Enter sends, Shift+Enter adds a line (and an
 * IME composition is never cut short), Send becomes Stop while Auto answers.
 * Focus and blur tell Auto you're typing. The ref is the textarea: Try again
 * puts focus back in it as its snag box goes (P260-FX-22, M20). PRD-264 EUAI-11a: the host's
 * AI label fence (the SDK's `cards.AiLabelFence`) disables it while a theme hides the label.
 * It takes focus as it appears without scrolling the page: Chromium scrolls an autofocused
 * field into view, which pushed the first open's Auto off the top of a laptop's window.
 */

export const PLACEHOLDER = 'Message Auto'

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
  { streaming, onSend, onStop, onFocus, onBlur, initialDraft = '', autoFocus = false },
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
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
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
