import { useVoice } from '@automatos/theme-sdk'

import styles from './mic-live.module.css'
import { micWords } from './session'

/**
 * MIC LIVE in the top bar ("Automatos Command HUD.dc.html": "● MIC LIVE" on the desktop's bar and the phone's), shown
 * whenever the host's voice session has the microphone open (useVoice().micOpen), the design's rule: the mic never
 * opens without a press, and MIC LIVE is always visible while it is open. On a muted Live call it says MIC MUTED. A
 * glyph and a word, never colour alone. Its words go to a polite status that is always in the page, empty while the
 * microphone is shut, so a screen reader hears it open and shut; the visible chip is that status drawn, hidden from
 * assistive technology so it is heard once. On the desktop it is the design's outlined chip; on the phone, where it
 * takes the status's place, the accent words alone.
 */

export interface MicLiveProps {
  /** The phone's bar: the accent words with no outline, pushed to the bar's end. */
  readonly phone?: boolean
}

export function MicLive({ phone = false }: MicLiveProps) {
  const words = micWords(useVoice())
  return (
    <>
      <span className={styles.said} role="status">
        {words ?? ''}
      </span>
      {words !== null && (
        <span className={styles.mic} data-layout={phone ? 'phone' : 'desktop'} aria-hidden="true">
          <span className={styles.glyph}>●</span>
          {words}
        </span>
      )}
    </>
  )
}
