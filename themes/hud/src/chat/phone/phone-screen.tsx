import type { ReactNode, RefObject } from 'react'
import { FirstRunNudge } from '@automatos/theme-sdk'

import { THEME_HEADING } from '../../theme'
import styles from './phone.module.css'

/**
 * The core screen on a phone ("Automatos Command HUD.dc.html"'s phone, 390 by 844), under the frame's phone bar: the
 * line naming who is at work with its time (status-line.tsx), the 290 px core with Auto, the state chip and Pause Auto
 * beside it (voice-core.tsx, as on the desktop), the last exchange (phone-transcript.tsx), and at the foot the dock:
 * the host's credits banner, the message box once TYPE opens it, the design's waveform (src/voice/waveform.tsx) and the
 * control row with the host's voice button (phone-controls.tsx). The screen scrolls as one when the window is too
 * short for it, the dock pinned to its foot, so the voice button stays where it is while the words above it grow. The conversation's title is
 * its h1, for a screen reader and the host's focus, and isn't drawn: the design's phone has none. The host's first-run
 * nudge sits under the line, its pill over the top of the core, clear of the dock.
 */

export interface PhoneScreenProps {
  /** The conversation's title. */
  readonly title: string
  /** The top line. */
  readonly line: ReactNode
  /** The voice core. */
  readonly core: ReactNode
  /** The last exchange. */
  readonly transcript?: ReactNode
  /** The dock at the foot: the banner, the message box, the waveform and the controls. */
  readonly dock?: ReactNode
  /** The screen's element, the one that scrolls (use-follow-end.ts). */
  readonly scrollRef?: RefObject<HTMLDivElement | null>
}

export function PhoneScreen({ title, line, core, transcript, dock, scrollRef }: PhoneScreenProps) {
  return (
    <div ref={scrollRef} className={styles.screen} data-layout="phone">
      <h1 className={styles.title} tabIndex={-1} {...THEME_HEADING}>
        {title}
      </h1>
      {line}
      <FirstRunNudge />
      <div className={styles.coreSlot}>{core}</div>
      {transcript}
      {dock !== undefined && <div className={styles.dock}>{dock}</div>}
    </div>
  )
}
