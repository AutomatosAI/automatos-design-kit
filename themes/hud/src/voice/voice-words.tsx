import { useMemo } from 'react'
import { type HostVoiceState, useVoice } from '@automatos/theme-sdk'

import { SPEAKER } from '../chat/auto-reply'
import phoneStyles from '../chat/phone/phone.module.css'
import reply from '../chat/reply.module.css'
import { YOU } from '../chat/transcript'
import rows from '../chat/transcript.module.css'
import { isVoiceRunning } from './session'
import styles from './voice-words.module.css'

/**
 * What was said aloud while a voice session runs (useVoice().heard and .reply): the design's YOU row with the member's
 * words as the host hears them, then the AUTO row with his reply as far as he has spoken it, with the design's blinking
 * block cursor while he answers. Host voice sends the words as a chat turn of its own and the conversation on screen
 * gets the saved messages once that turn lands, so until then these rows are the only place the exchange shows. They
 * are HUD's transcript rows in its type: on the desktop under the transcript at the newest exchange's sizes (17 px and
 * 20 px), on the phone in the last exchange's place (your words in quotes at 15 px, Auto's at 19 px). Auto's row
 * carries data-ai-generated="true", as every reply of his does. Nothing shows at rest, or before a word is heard.
 */

export const VOICE_WORDS_LABEL = 'Said aloud'

export interface VoiceWordsState {
  /** The member's words, as recognised so far. */
  readonly heard: string
  /** Auto's reply, as far as he has spoken it. */
  readonly reply: string
  /** Auto is answering: thinking on the reply or speaking it. */
  readonly answering: boolean
}

/** The words to show for the session now; null while none runs or nothing is said yet. Pure. */
export function voiceWordsOf(voice: Pick<HostVoiceState, 'phase' | 'heard' | 'reply'>): VoiceWordsState | null {
  if (!isVoiceRunning(voice.phase)) return null
  const answering = voice.phase === 'thinking' || voice.phase === 'speaking'
  if (!voice.heard && !voice.reply && !answering) return null
  return { heard: voice.heard, reply: voice.reply, answering }
}

/** The words of the host's voice session now (voiceWordsOf). */
export function useVoiceWords(): VoiceWordsState | null {
  const { phase, heard, reply: replied } = useVoice()
  return useMemo(() => voiceWordsOf({ phase, heard, reply: replied }), [phase, heard, replied])
}

function HeardRow({ heard, phone }: { readonly heard: string; readonly phone: boolean }) {
  if (phone) {
    return (
      <article className={phoneStyles.you} aria-label={`${YOU} said`} data-speaker="you">
        <h2 className={phoneStyles.srOnly}>{YOU}</h2>
        <p className={phoneStyles.quote}>{`“${heard}”`}</p>
      </article>
    )
  }
  return (
    <article className={rows.row} aria-label={`${YOU} said`} data-speaker="you" data-recent="true">
      <h2 className={rows.speaker}>{YOU}</h2>
      <p className={rows.you}>{heard}</p>
    </article>
  )
}

function ReplyRow({ words, phone }: { readonly words: VoiceWordsState; readonly phone: boolean }) {
  return (
    <article
      className={rows.row}
      aria-label={`${SPEAKER} said`}
      aria-busy={words.answering}
      data-ai-generated="true"
      data-speaker="auto"
      data-recent="true"
      data-layout={phone ? 'phone' : undefined}
    >
      <h2 className={rows.speaker}>{SPEAKER}</h2>
      <p className={`${reply.answer} ${styles.reply}`}>
        {words.reply}
        {words.answering && <span className={reply.cursor} data-hud-loop="" aria-hidden="true" />}
      </p>
    </article>
  )
}

export interface VoiceWordsProps {
  readonly words: VoiceWordsState
  /** In the phone's last exchange. */
  readonly phone?: boolean
}

export function VoiceWords({ words, phone = false }: VoiceWordsProps) {
  return (
    <section className={styles.words} data-layout={phone ? 'phone' : 'desktop'} aria-label={VOICE_WORDS_LABEL}>
      {words.heard && <HeardRow heard={words.heard} phone={phone} />}
      {(words.reply || words.answering) && <ReplyRow words={words} phone={phone} />}
    </section>
  )
}
