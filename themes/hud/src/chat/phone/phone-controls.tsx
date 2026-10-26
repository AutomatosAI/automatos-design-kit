import type { RefObject } from 'react'

import styles from './phone.module.css'
import { VoiceSlot } from './voice-slot'

/**
 * The phone core screen's control row (the design's TYPE · HOLD TO TALK · STOP): TYPE opens and shuts the message box,
 * saying which (aria-expanded) and naming it (aria-controls); the host's voice button in the middle (voice-slot.tsx);
 * STOP cancels the turn, as the design's STOP does: it stops Auto's reply, as the message box's Stop does, and ends
 * the voice session while one runs, and is disabled while nothing runs. Typing stays: voice is beside it, never
 * instead of it.
 */

export const CONTROLS_LABEL = 'Controls'
export const TYPE_LABEL = 'Type'
export const STOP_LABEL = 'Stop'

export interface PhoneControlsProps {
  /** The message box is open. */
  readonly typing: boolean
  /** The message box's element, which TYPE opens. */
  readonly composerId: string
  readonly onType: () => void
  /** Something STOP can stop runs: Auto is answering, or a voice session. */
  readonly stoppable: boolean
  readonly onStop: () => void
  /** TYPE, which takes the focus when STOP stops a reply with the box shut. */
  readonly typeRef: RefObject<HTMLButtonElement | null>
}

export function PhoneControls({ typing, composerId, onType, stoppable, onStop, typeRef }: PhoneControlsProps) {
  return (
    <div className={styles.controls} role="group" aria-label={CONTROLS_LABEL}>
      <button ref={typeRef} type="button" className={styles.type} aria-expanded={typing} aria-controls={composerId} onClick={onType}>
        {TYPE_LABEL}
      </button>
      <VoiceSlot />
      <button type="button" className={styles.stop} disabled={!stoppable} onClick={onStop}>
        {STOP_LABEL}
      </button>
    </div>
  )
}
