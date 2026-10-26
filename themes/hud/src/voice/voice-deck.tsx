import { Fragment } from 'react'
import { useVoice, VoiceButton, type VoiceButtonProps } from '@automatos/theme-sdk'

import { DESKTOP_BARS } from './wave'
import { Waveform } from './waveform'
import styles from './voice-deck.module.css'

/**
 * The desktop's voice, over the message box ("Automatos Command HUD.dc.html": the waveform at the foot of the
 * conversation's column, HOLD SPACE TO TALK · OR TYPE · "AUTO, STOP" TO CANCEL under it). The host's voice button (the
 * SDK's VoiceButton: core draws the press, the microphone prompt, the "AI voice assistant" caption and the stop
 * control; HUD places it and styles it through its data attributes and --voice-button-* properties) stands in the
 * middle of the design's 72-bar waveform, half on each side, the newest level entering beside it. Under them is a strip
 * the design's hint holds at rest and the host's own control holds while the session is the button's, so it never
 * covers them; the strip keeps its height either way, so the press never moves under a held pointer. Hold to talk, in
 * Auto Live where it can start and quick-ask otherwise (mode auto), with Space as its key anywhere but a field you type
 * in (core's hotkey rule). It sits outside the message box's AI label fence: nothing locks it. Text stays: the message
 * box is under it, as before.
 */

export const VOICE_DECK_LABEL = 'Voice'
/** The desktop's voice button: hold to talk, Live where it can start, Space as its key. */
export const DESKTOP_VOICE_BUTTON: VoiceButtonProps = Object.freeze({ mode: 'auto', press: 'hold', hotkey: 'Space', size: 'md' })
/** The design's hint, the key in a box: what holding does, that typing still works, and the stop phrase. */
export const VOICE_HINT = 'Hold Space to talk · or type · “Auto, stop” to cancel'
const HINT_SEPARATOR = ' · '
const KEY_WORD = 'Space'
/** The hint's phrases, each kept on one line, so a narrow column wraps between them, never inside one. */
const HINT_PARTS: readonly string[] = VOICE_HINT.split(HINT_SEPARATOR)

/** A phrase of the hint, its key (Space) drawn as one. */
function HintPart({ part }: { readonly part: string }) {
  if (!part.includes(KEY_WORD)) return <span className={styles.hintPart}>{part}</span>
  const [before, after] = part.split(KEY_WORD)
  return (
    <span className={styles.hintPart}>
      {before}
      <kbd className={styles.key}>{KEY_WORD}</kbd>
      {after}
    </span>
  )
}

function Hint() {
  return (
    <p className={styles.hint}>
      {HINT_PARTS.map((part, index) => (
        <Fragment key={part}>
          {index > 0 ? HINT_SEPARATOR : null}
          <HintPart part={part} />
        </Fragment>
      ))}
    </p>
  )
}

export function VoiceDeck() {
  const atRest = useVoice().phase === 'idle'
  const half = DESKTOP_BARS / 2
  return (
    <div className={styles.deck} role="group" aria-label={VOICE_DECK_LABEL}>
      <div className={styles.waveStart}>
        <Waveform bars={half} entry="end" size="large" />
      </div>
      <div className={styles.press}>
        <VoiceButton {...DESKTOP_VOICE_BUTTON} />
      </div>
      <div className={styles.waveEnd}>
        <Waveform bars={half} first={half} entry="start" size="large" />
      </div>
      {atRest && <Hint />}
    </div>
  )
}
