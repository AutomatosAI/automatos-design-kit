'use client'

import { type Dispatch, useEffect, useMemo } from 'react'
import { type Brief, type Calibration, useBrief, useCalibration } from '@automatos/theme-sdk'

import type { MascotEvent } from '@automatos/mascot/types'

/**
 * Play 1.3.0 (PRD-268 §6.12.4) — what Auto has for the person, as Play's chat reads it from the SDK's proactive area:
 * the day's brief (useBrief: once the host has opened it; reading it never builds one) and his calibration on day one
 * (useCalibration: only while the server offers it). No brief is a normal day: the workspace's proactive mode is off
 * (the host's open was refused quietly) or the brief is still on its way, and useBrief answers no data; Play then
 * draws the chat as it was. A read that failed is drawn the same way: the chat never shows an error for a brief.
 *
 * Auto says hello for his calibration (§6.12.4: Play's calibration bubbles with the mascot `hello`), once per
 * calibration while it shows, whether or not the session's first hello has played.
 */

export interface PlayProactive {
  readonly brief: Brief | null
  /** The calibration the server offers; null while it offers none. */
  readonly calibration: Calibration | null
}

export function usePlayProactive(): PlayProactive {
  const brief = useBrief().data
  const offered = useCalibration()
  const calibration = offered.available ? offered.data : null
  return useMemo(() => ({ brief, calibration }), [brief, calibration])
}

/** Hello (`app-open`) each time a calibration starts showing (`calibrationId`, null while none shows). */
export function useCalibrationHello(dispatch: Dispatch<MascotEvent>, calibrationId: string | null): void {
  useEffect(() => {
    if (calibrationId !== null) dispatch({ type: 'app-open' })
  }, [calibrationId, dispatch])
}
