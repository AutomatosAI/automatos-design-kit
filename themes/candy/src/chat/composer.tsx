// After themes/arcade/src/chat/composer.tsx (Arcade 1.0.0), itself from HUD 1.1.2: the same keys and fence, drawn as
// Candy's pill with a round Send.
import { type FormEvent, type KeyboardEvent, type ReactNode, type RefObject, useId, useState } from 'react'
import { AiLabelFence } from '@automatos/theme-sdk'

import styles from './composer.module.css'
import ui from '../ui/ui.module.css'

/**
 * The message box at the foot of the thread (the design's W2 composer strip): a pill field, "Message Auto", with a
 * round accent Send (↑) at its end that becomes Stop (■) while Auto answers. Enter sends, Shift+Enter adds a line (an
 * IME composition is never cut short), and Esc in the box stops the answer. The keys are said to a screen reader as
 * the box's description. The SDK has no message box, so this one is Candy's, and it sits in the host's AI label
 * fence (the SDK's AiLabelFence), as the contract places it; the fence draws its children alone and disables
 * nothing. The host's voice button sits to its right, outside the fence, with room under it for the host's caption
 * and Stop. The ref is the textarea: Send, Stop and Try again put the focus back in it.
 */

export const PLACEHOLDER = 'Message Auto'
export const SEND = 'Send'
export const STOP = 'Stop'
export const KEYS_HINT = 'Enter to send, Shift and Enter for a new line, Esc to stop'

export interface ComposerProps {
  readonly boxRef: RefObject<HTMLTextAreaElement | null>
  /** Auto is answering: Stop instead of Send. */
  readonly streaming: boolean
  /** False when nothing went out (a turn still ending): the words stay. */
  readonly onSend: (text: string) => boolean
  readonly onStop: () => void
  /** Focus the box as it appears (a new chat on a desktop). */
  readonly autoFocus?: boolean
  /** Beside the box, outside the AI label fence: the host's voice button, which nothing may lock. */
  readonly voice?: ReactNode
  /** The box took or lost the focus: Auto listens while you type. */
  readonly onTyping?: (typing: boolean) => void
  /** The phone's layout (P2): the pill floats on the page in the window colour. */
  readonly phone?: boolean
}

function SendOrStop({ streaming, ready, onStop }: { readonly streaming: boolean; readonly ready: boolean; readonly onStop: () => void }) {
  if (streaming) {
    return (
      <button type="button" className={styles.round} data-kind="stop" aria-label={STOP} onClick={() => onStop()}>
        <span className={styles.stopGlyph} aria-hidden="true" />
      </button>
    )
  }
  return (
    <button type="submit" className={styles.round} data-kind="send" aria-label={SEND} disabled={!ready}>
      <span className={styles.sendGlyph} aria-hidden="true">
        ↑
      </span>
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

export function Composer(props: ComposerProps) {
  const { boxRef, streaming, onSend, onStop, autoFocus = false, voice = null, onTyping, phone = false } = props
  const { draft, setDraft, ready, onSubmit, onKeyDown } = useDraft(streaming, onSend, onStop)
  const hintId = useId()
  return (
    <div className={styles.composer} data-layout={phone ? 'phone' : 'desktop'}>
      <div className={styles.boxSlot}>
        <AiLabelFence>
          <form className={styles.box} onSubmit={onSubmit}>
            <textarea
              ref={boxRef}
              className={styles.input}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onKeyDown}
              onFocus={() => onTyping?.(true)}
              onBlur={() => onTyping?.(false)}
              placeholder={PLACEHOLDER}
              aria-label={PLACEHOLDER}
              aria-describedby={hintId}
              autoFocus={autoFocus}
              rows={1}
            />
            <SendOrStop streaming={streaming} ready={ready} onStop={onStop} />
          </form>
        </AiLabelFence>
        <p id={hintId} className={ui.srOnly}>
          {KEYS_HINT}
        </p>
      </div>
      {voice}
    </div>
  )
}
