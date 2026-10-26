import { useVoice, VoiceButton, type VoiceButtonProps } from '@automatos/theme-sdk'

import styles from './phone.module.css'

/**
 * The middle of the phone's control row, the Command design's HOLD TO TALK between TYPE and STOP: the host's voice
 * button (the SDK's VoiceButton: core draws the press, the microphone prompt, the "AI voice assistant" caption and the
 * stop control; HUD places it and styles it through its data attributes and --voice-button-* properties) as the
 * design's 84 px circle in the accent, with the design's words, HOLD TO TALK, under it at rest. The words are HUD's,
 * hidden from assistive technology, since the button's own name says them; while a session runs they give way to the
 * host's control, which opens under the press in the same strip, so the press never moves under the finger. Hold to
 * talk, in Auto Live where it can start and quick-ask otherwise (mode auto); no key on a phone (hotkey null).
 */

/** The phone's voice button: hold to talk, Live where it can start, no key, the large size. */
export const PHONE_VOICE_BUTTON: VoiceButtonProps = Object.freeze({ mode: 'auto', press: 'hold', hotkey: null, size: 'lg' })
/** The design's words under the circle. */
export const HOLD_WORDS = 'Hold to talk'

export function VoiceSlot() {
  const atRest = useVoice().phase === 'idle'
  return (
    <div className={styles.voice}>
      <VoiceButton {...PHONE_VOICE_BUTTON} />
      {atRest && (
        <span className={styles.holdWords} aria-hidden="true">
          {HOLD_WORDS}
        </span>
      )}
    </div>
  )
}
