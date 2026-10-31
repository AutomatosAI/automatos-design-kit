import { useState } from 'react'

import styles from './thread.module.css'

/**
 * HUD 1.3.0 (PRD-268, SDK 1.4.0): the reply chips under Auto's last message (its reply_chips@1 part, the answers he
 * offered when he asked you to choose), as HUD's SAY chips: `SAY` in the readable accent, then each answer in quotes
 * as a square outline chip in mono capitals, the words a person can say to Auto, and a button to tap too. A tap sends
 * the chip's words as your own message, through the chat's send, and then nothing can be tapped again; a send the chat
 * refuses (a turn still running) leaves them as they were. Each is named "Reply: <chip>", its words those it shows, as
 * the host names its own chips; the words are Auto's (data-ai-generated). They are drawn only under the conversation's
 * newest message while it is Auto's (thread/message-parts.ts latestReplyChips), so a newer message, yours or his,
 * takes them away. Never spoken: HUD calls no speech API, and the chips are in no live region.
 */

export const REPLIES_LABEL = 'Replies'
export const SAY_WORD = 'Say'
export const REPLY_PREFIX = 'Reply: '

export interface SayRepliesProps {
  /** The answers Auto offered, as the host checked them (two or three, each at most 24 characters). */
  readonly chips: readonly string[]
  /** Sends the words as your message; false when nothing was sent. */
  readonly onReply: (text: string) => boolean
  /** A turn is running: a tap couldn't send, so none is offered. */
  readonly busy?: boolean
}

export function SayReplies({ chips, onReply, busy = false }: SayRepliesProps) {
  const [sent, setSent] = useState(false)
  if (chips.length === 0) return null
  const reply = (chip: string): void => {
    if (sent || busy) return
    if (onReply(chip)) setSent(true)
  }
  return (
    <div className={styles.replies} role="group" aria-label={REPLIES_LABEL} data-thread-part="reply_chips@1">
      <span className={styles.sayWord} aria-hidden="true">
        {SAY_WORD}
      </span>
      {chips.map((chip) => (
        <button
          key={chip}
          type="button"
          className={styles.reply}
          aria-label={`${REPLY_PREFIX}${chip}`}
          disabled={sent || busy}
          onClick={() => reply(chip)}
        >
          <span data-ai-generated="true">{`“${chip}”`}</span>
        </button>
      ))}
    </div>
  )
}
