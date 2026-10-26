'use client'

import { type RefObject, useEffect, useRef } from 'react'

import { readVoiceLevels } from '@automatos/theme-sdk'

/**
 * Play 1.2.0 — Auto's light ring following his voice while he speaks. Once a frame, inside requestAnimationFrame as
 * the SDK asks (never in a render), it reads Auto's level (readVoiceLevels().agent, 0 to 1) and writes it on his stage
 * as --pl-voice-level, which auto-mascot.module.css turns into the ring's swell. Only while `active`: the caller
 * passes false under reduced motion and while Auto is paused (use-mascot-motion.ts), so he holds still then, and the
 * level is taken off again as he stops speaking, leaving the ring at rest.
 */

/** The custom property the ring's swell reads. */
export const VOICE_LEVEL_VAR = '--pl-voice-level'
/** Three decimals: finer than a pixel of swell, and a short string for the style. */
const LEVEL_DIGITS = 3

const canAnimate = (): boolean => typeof requestAnimationFrame === 'function' && typeof cancelAnimationFrame === 'function'

/** A ref for Auto's stage; while `active`, the stage carries Auto's voice level, frame by frame. */
export function useVoiceRing<T extends HTMLElement>(active: boolean): RefObject<T | null> {
  const stage = useRef<T>(null)
  useEffect(() => {
    const element = stage.current
    if (!active || element === null || !canAnimate()) return undefined
    let frame = 0
    const follow = (): void => {
      element.style.setProperty(VOICE_LEVEL_VAR, readVoiceLevels().agent.toFixed(LEVEL_DIGITS))
      frame = requestAnimationFrame(follow)
    }
    frame = requestAnimationFrame(follow)
    return () => {
      cancelAnimationFrame(frame)
      element.style.removeProperty(VOICE_LEVEL_VAR)
    }
  }, [active])
  return stage
}
