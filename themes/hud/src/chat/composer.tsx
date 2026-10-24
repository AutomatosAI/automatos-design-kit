import { type FormEvent, type KeyboardEvent, type RefObject, useId, useState } from 'react'
import { AiLabelFence } from '@automatos/theme-sdk'

import styles from './composer.module.css'

/**
 * The message box under the transcript. The Command design talks first and types second ("or type"); HUD types:
 * the SDK offers a theme no voice, so there is no microphone to draw, and the box is the way in. Enter sends,
 * Shift+Enter adds a line (an IME composition is never cut short), and Send becomes Stop while Auto answers, which
 * Esc in the box presses too. The keys are said under the box, and the box names them as its description. The
 * host's AI label fence (the SDK's AiLabelFence) disables the box while a theme hides the host's AI label; it
 * fences the box only, never the conversation, so the approval cards stay clickable. The ref is the textarea:
 * Send, Stop and Try again put the focus back in it.
 */

export const PLACEHOLDER = 'Message Auto'
export const SEND = 'Send'
export const STOP = 'Stop'
export const KEYS_HINT = 'Enter to send · Shift + Enter for a new line · Esc to stop'

export interface ComposerProps {
  readonly boxRef: RefObject<HTMLTextAreaElement | null>
  /** Auto is answering: Stop instead of Send. */
  readonly streaming: boolean
  /** False when nothing went out (a turn still ending): the words stay. */
  readonly onSend: (text: string) => boolean
  readonly onStop: () => void
  /** Focus the box as it appears (a new chat). */
  readonly autoFocus?: boolean
}

function SendOrStop({ streaming, ready, onStop }: { readonly streaming: boolean; readonly ready: boolean; readonly onStop: () => void }) {
  if (streaming) {
    return (
      <button type="button" className={styles.stop} onClick={() => onStop()}>
        <span className={styles.stopIcon} aria-hidden="true" />
        {STOP}
      </button>
    )
  }
  return (
    <button type="submit" className={styles.send} disabled={!ready}>
      {SEND}
    </button>
  )
}

/** The box's words, and what Enter, Shift+Enter, Esc and the form's submit do with them. */
function useDraft(streaming: boolean, onSend: (text: string) => boolean, onStop: () => void) {
  const [draft, setDraft] = useState('')
  const ready = draft.trim().length > 0
  const submit = (): void => {
    if (streaming || !ready) return
    if (onSend(draft)) setDraft('')
  }
  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    submit()
  }
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Escape' && streaming) {
      event.preventDefault()
      onStop()
      return
    }
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    submit()
  }
  return { draft, setDraft, ready, onSubmit, onKeyDown }
}

export function Composer({ boxRef, streaming, onSend, onStop, autoFocus = false }: ComposerProps) {
  const { draft, setDraft, ready, onSubmit, onKeyDown } = useDraft(streaming, onSend, onStop)
  const hintId = useId()
  return (
    <div className={styles.composer}>
      <AiLabelFence>
        <form className={styles.box} onSubmit={onSubmit}>
          <span className={styles.prompt} aria-hidden="true">
            ▸
          </span>
          <textarea
            ref={boxRef}
            className={styles.input}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={PLACEHOLDER}
            aria-label={PLACEHOLDER}
            aria-describedby={hintId}
            autoFocus={autoFocus}
            rows={1}
          />
          <SendOrStop streaming={streaming} ready={ready} onStop={onStop} />
        </form>
      </AiLabelFence>
      <p id={hintId} className={styles.hint}>
        {KEYS_HINT}
      </p>
    </div>
  )
}
