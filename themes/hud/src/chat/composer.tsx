import { type FormEvent, Fragment, type KeyboardEvent, type RefObject, useCallback, useEffect, useId, useState } from 'react'
import { AiLabelFence, type HostChatDraft } from '@automatos/theme-sdk'

import styles from './composer.module.css'

/**
 * The message box under the transcript. The Command design talks first and types second ("or type"); HUD types:
 * the SDK offers a theme no voice, so there is no microphone to draw, and the box is the way in. Enter sends,
 * Shift+Enter adds a line (an IME composition is never cut short), and Send becomes Stop while Auto answers, which
 * Esc in the box presses too. The keys are said under the box, and the box names them as its description. The
 * host's AI label fence (the SDK's AiLabelFence) disables the box while a theme hides the host's AI label; it
 * fences the box only, never the conversation, so the approval cards stay clickable. The ref is the textarea:
 * Send, Stop and Try again put the focus back in it. Words handed in as a fill (an empty chat's starter) take the
 * box's place and the focus, once per serial, for you to send or change.
 */

export const PLACEHOLDER = 'Message Auto'
export const SEND = 'Send'
export const STOP = 'Stop'
export const KEYS_HINT = 'Enter to send · Shift + Enter for a new line · Esc to stop'
const HINT_SEPARATOR = ' · '
/** The hint's phrases, each kept on one line, so a narrow column wraps between them, never inside one. */
const HINT_PARTS: readonly string[] = KEYS_HINT.split(HINT_SEPARATOR)

export interface ComposerProps {
  readonly boxRef: RefObject<HTMLTextAreaElement | null>
  /** Auto is answering: Stop instead of Send. */
  readonly streaming: boolean
  /** False when nothing went out (a turn still ending): the words stay. */
  readonly onSend: (text: string) => boolean
  readonly onStop: () => void
  /** Focus the box as it appears (a new chat). */
  readonly autoFocus?: boolean
  /** Words to put in the box: each new serial replaces what is there and focuses it. */
  readonly fill?: HostChatDraft | null
}

export interface BoxFill {
  readonly fill: HostChatDraft | null
  /** Puts these words in the message box, as a new fill. */
  readonly fillBox: (text: string) => void
}

/** The words a page puts in the message box (an empty chat's starter), each with a new serial. */
export function useBoxFill(): BoxFill {
  const [fill, setFill] = useState<HostChatDraft | null>(null)
  const fillBox = useCallback((text: string) => setFill((last) => ({ text, serial: (last?.serial ?? 0) + 1 })), [])
  return { fill, fillBox }
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

export function Composer({ boxRef, streaming, onSend, onStop, autoFocus = false, fill = null }: ComposerProps) {
  const { draft, setDraft, ready, onSubmit, onKeyDown } = useDraft(streaming, onSend, onStop)
  const hintId = useId()
  useEffect(() => {
    if (fill === null) return
    setDraft(fill.text)
    boxRef.current?.focus()
  }, [fill, boxRef, setDraft])
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
        {HINT_PARTS.map((part, index) => (
          <Fragment key={part}>
            {index > 0 ? HINT_SEPARATOR : null}
            <span className={styles.hintPart}>{part}</span>
          </Fragment>
        ))}
      </p>
    </div>
  )
}
