import { type CSSProperties, type RefObject, useEffect, useMemo, useRef } from 'react'
import { readVoiceLevels, useVoice } from '@automatos/theme-sdk'

import { isVoiceRunning, useVoiceMotion } from './session'
import { barScales, historyLength, pushLevel, type WaveEntry, waveShape } from './wave'
import styles from './waveform.module.css'

/**
 * The Command design's waveform (wave.ts has its numbers): a row of thin bars in the look's accent, the design's shape,
 * its 44 px row on the desktop and 36 px on the phone. It moves in an animation-frame loop alone: while a voice session
 * runs and HUD's voice may move (session.ts), each frame reads readVoiceLevels(), never a render, and sets each bar's
 * scale, the newest level at the `entry` bars, so the wave travels away from the voice button. The bars are written in
 * the frame itself, not through React, so a frame renders nothing. Under the reduced-motion setting, with the look's
 * motion off and while no session runs there is no loop, and every bar stands at rest (REST_SCALE, the stylesheet's);
 * the loop is cancelled, and the bars put back at rest, when any of those changes and when the waveform unmounts. It is
 * decoration, hidden from assistive technology: MIC LIVE, the voice button's own state and the words heard say it.
 */

export type WaveSize = 'large' | 'small'

type BarStyle = CSSProperties & { readonly '--hud-bar': string }

const SHAPE_DECIMALS = 3

function barStyle(height: number): BarStyle {
  return { '--hud-bar': height.toFixed(SHAPE_DECIMALS) }
}

/** The bars of the waveform `ref` names, moved by the voice's levels in each animation frame while `active`. */
function useWaveLoop(ref: RefObject<HTMLDivElement | null>, entry: WaveEntry, active: boolean, count: number): void {
  useEffect(() => {
    const wave = ref.current
    // A page with no animation frames (a server, a bare test DOM) draws the bars at rest.
    if (!active || wave === null || typeof requestAnimationFrame !== 'function') return undefined
    const bars = Array.from(wave.children).filter((bar): bar is HTMLElement => bar instanceof HTMLElement)
    const length = historyLength(bars.length, entry)
    let history: readonly number[] = []
    let frame = 0
    const step = (): void => {
      const { user, agent } = readVoiceLevels()
      history = pushLevel(history, Math.max(user, agent), length)
      const scales = barScales(history, bars.length, entry)
      // The DOM itself, in the frame: a style write per bar, and no render.
      bars.forEach((bar, index) => bar.style.setProperty('transform', `scaleY(${scales[index]})`))
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(frame)
      bars.forEach((bar) => bar.style.removeProperty('transform'))
    }
  }, [ref, entry, active, count])
}

export interface WaveformProps {
  /** How many bars: DESKTOP_BARS, PHONE_BARS, or half the desktop's on each side of its button. */
  readonly bars: number
  /** The design's bar this row starts at: a desktop half starts at 0 or at the middle. */
  readonly first?: number
  /** Where the newest level enters: the bars next to the voice button. */
  readonly entry: WaveEntry
  readonly size: WaveSize
}

export function Waveform({ bars, first = 0, entry, size }: WaveformProps) {
  const ref = useRef<HTMLDivElement>(null)
  const shape = useMemo(() => waveShape(bars, first), [bars, first])
  const moves = useVoiceMotion()
  const running = isVoiceRunning(useVoice().phase)
  const active = moves && running
  useWaveLoop(ref, entry, active, bars)
  return (
    <div
      ref={ref}
      className={styles.wave}
      data-size={size}
      data-entry={entry}
      data-moving={active ? 'true' : 'false'}
      aria-hidden="true"
    >
      {shape.map((height, index) => (
        // The bars never reorder: their place is their key.
        <span key={index} className={styles.bar} style={barStyle(height)} />
      ))}
    </div>
  )
}
