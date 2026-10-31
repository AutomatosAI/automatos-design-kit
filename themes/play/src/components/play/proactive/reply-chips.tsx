'use client'

import { useState } from 'react'

import styles from './proactive.module.css'

/**
 * Play 1.4.0 (PRD-268 §6.6, §6.12.3, §6.12.4) — the answers Auto offered under his last message (its `reply_chips@1`
 * part: two or three, each at most 24 characters, as the host checked them), drawn as Play's 40 px pills in the look's
 * secondary button (play-theme.css's --pl-button-2-*), 44 px targets on the phone. Each is Auto's words, so each chip
 * carries data-ai-generated, and each is named "Reply: <chip>". A tap is the person's own message: the chip's words go
 * out through the message box's own send (the chat controller's `send`), once; when nothing went out (a turn still
 * ending) the chips stay. They show under Auto's last message only (message-list.tsx), so once a newer message exists,
 * the person's included, they are gone.
 */

/** The chips' group, as the host's ReplyChips names it. */
export const REPLIES_LABEL = 'Replies'
/** Each chip's name before its words ("Reply: Window"), §6.12.3. */
export const REPLY_PREFIX = 'Reply: '

export interface PlayReplyChipsProps {
  /** The answers, as the message's part holds them; nothing draws for none. */
  readonly chips: readonly string[]
  /** Sends the words as the person's message; false when nothing went out. */
  readonly onReply: (text: string) => boolean
}

export function PlayReplyChips({ chips, onReply }: PlayReplyChipsProps) {
  const [sent, setSent] = useState(false)
  if (chips.length === 0) return null
  const reply = (chip: string): void => {
    if (!sent && onReply(chip)) setSent(true)
  }
  return (
    <div role="group" aria-label={REPLIES_LABEL} className={styles.chips} data-reply-chips="">
      {chips.map((chip) => (
        <button
          key={chip}
          type="button"
          className={styles.chip}
          aria-label={`${REPLY_PREFIX}${chip}`}
          data-ai-generated="true"
          disabled={sent}
          onClick={() => reply(chip)}
        >
          {chip}
        </button>
      ))}
    </div>
  )
}
