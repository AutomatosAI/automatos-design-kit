'use client'

import type { VoiceWords as Words } from '../../../lib/voice/voice-pose'

import styles from './composer.module.css'

/**
 * Play 1.2.0 — what the host's voice session heard and what Auto has said so far, over the message box while the
 * session runs: your words as your message is drawn (on the right, outlined, the outline dashed since they are
 * still spoken words), Auto's as his answer is. Once the session ends the conversation holds them, so they go. Not a live region:
 * the voice button tells a screen reader the session's state, and Auto's caption says what he is doing, so the
 * words, which change as they are recognised and spoken, are not read out each time.
 */

export const VOICE_WORDS_LABEL = 'Voice'
export const HEARD_LABEL = 'You'
export const REPLY_LABEL = 'Auto'

export function VoiceWords({ words }: { readonly words: Words | null }) {
  if (words === null) return null
  return (
    <div className={styles.words} role="group" aria-label={VOICE_WORDS_LABEL}>
      {words.heard !== '' && (
        <p className={styles.heard}>
          <span className={styles.who}>{HEARD_LABEL}</span>
          {words.heard}
        </p>
      )}
      {words.reply !== '' && (
        <p className={styles.reply}>
          <span className={styles.who}>{REPLY_LABEL}</span>
          {words.reply}
        </p>
      )}
    </div>
  )
}
