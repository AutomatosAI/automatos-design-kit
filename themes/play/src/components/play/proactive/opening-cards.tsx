'use client'

import type { Brief, Calibration } from '@automatos/theme-sdk'

import chat from '../chat/chat.module.css'
import { PlayBrief } from './play-brief'
import { PlayCalibration } from './play-calibration'
import styles from './proactive.module.css'

/**
 * Play 1.3.0 (PRD-268 §6.12.4) — an empty chat with something from Auto: his calibration on day one, then the day's
 * brief, in the first open's place (FirstOpenHero, play-chat-view.tsx), in the conversation's scrolling column. With
 * neither, the empty chat is the first open as before: no brief is a normal day.
 */

export interface OpeningCardsProps {
  readonly brief: Brief | null
  readonly calibration: Calibration | null
  /** Something's off on the calibration: the message box takes the focus. */
  readonly onSomethingOff: () => void
}

export function OpeningCards({ brief, calibration, onSomethingOff }: OpeningCardsProps) {
  return (
    <div className={chat.messages}>
      <div className={styles.opening}>
        {calibration ? <PlayCalibration calibration={calibration} onSomethingOff={onSomethingOff} /> : null}
        {brief ? <PlayBrief brief={brief} /> : null}
      </div>
    </div>
  )
}
