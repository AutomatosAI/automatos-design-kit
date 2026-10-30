'use client'

import { type Calibration, CalibrationCard, useAnswerCalibration } from '@automatos/theme-sdk'

import { SPEAKER } from '../chat/auto-reply'
import chat from '../chat/chat.module.css'
import styles from './proactive.module.css'

/**
 * Play 1.3.0 (PRD-268 §6.11.5, §6.12.4) — day one: what Auto thinks he knows, as one of his Ember bubbles on the empty
 * chat (his "Auto" label over the host's CalibrationCard), while he says hello (play-chat-view.tsx). The card is the
 * host's: up to three lines, each with its source count and Reject, the three offers, Sounds right and Something's off,
 * and every state (rejected, accepted, empty). Its lines are Auto's words and it marks them. Sounds right and Reject
 * are the proactive area's answer (useAnswerCalibration); Something's off hands the person the message box, to say
 * what is wrong in their own words. Drawn only while the server offers calibration (useCalibration's `available`).
 */

/** The bubble's name: Auto introducing what he knows. */
export const CALIBRATION_LABEL = 'Auto says hello'

export interface PlayCalibrationProps {
  readonly calibration: Calibration
  /** Something's off: the message box takes the focus. */
  readonly onSomethingOff: () => void
}

export function PlayCalibration({ calibration, onSomethingOff }: PlayCalibrationProps) {
  const answer = useAnswerCalibration()
  return (
    <article className={chat.reply} aria-label={CALIBRATION_LABEL}>
      <h2 className={chat.speaker}>{SPEAKER}</h2>
      <CalibrationCard
        calibration={calibration}
        onAnswer={answer.available ? answer.runAsync : undefined}
        onSomethingOff={onSomethingOff}
        className={styles.card}
      />
    </article>
  )
}
