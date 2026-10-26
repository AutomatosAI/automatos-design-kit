/**
 * Play 1.2.0 — Auto's light ring following his voice while he speaks through the host's voice (AutoMascot's
 * `speaking`, src/components/mascot/use-voice-ring.ts). Once a frame, inside requestAnimationFrame, his level (the
 * SDK's readVoiceLevels().agent, which the harness answers with what host.setVoiceLevels set while a session runs) is
 * written on his stage as --pl-voice-level, which his stylesheet turns into the ring's swell; it is taken off when he
 * stops speaking. He holds still under the OS reduced-motion setting and while he is paused (Play's Pause Auto, the
 * flag the host keeps): no frame is asked for and no level is written. The frames are a stand-in here, run by hand, so
 * every frame is seen. The stylesheet's half (the swell scaled by the host's motion factor, held at rest when still)
 * is read from its text.
 */
import { act, render, screen } from '@testing-library/react'
import { host } from '@automatos/theme-harness/host'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AutoMascot } from '../../src/components/mascot/auto-mascot.tsx'
import { VOICE_LEVEL_VAR } from '../../src/components/mascot/use-voice-ring.ts'
import { setMascotPaused } from '../../src/lib/mascot/pause.ts'
import { declaredFor } from '../support/rule-values.ts'

const MASCOT_CSS = 'components/mascot/auto-mascot.module.css'

/** The frames asked for and not yet run, and the ones cancelled. */
let frames: FrameRequestCallback[] = []
let cancelled: number[] = []

/** Runs every frame asked for so far (each asks for the next one). */
function runFrames(): void {
  const due = frames
  frames = []
  act(() => due.forEach((frame) => frame(0)))
}

const stage = (): HTMLElement => screen.getByTestId('auto-stage')
const level = (): string => stage().style.getPropertyValue(VOICE_LEVEL_VAR)

beforeEach(() => {
  host.reset()
  frames = []
  cancelled = []
  vi.stubGlobal('requestAnimationFrame', (frame: FrameRequestCallback) => frames.push(frame))
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    cancelled.push(id)
  })
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  host.setVoicePhase('speaking')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("Auto's ring while he speaks", () => {
  it('carries his voice level, frame by frame, and marks his stage as speaking', () => {
    host.setVoiceLevels({ agent: 0.5 })
    render(<AutoMascot state="idle" speaking />)
    expect(stage()).toHaveAttribute('data-voice', 'speaking')
    expect(level()).toBe('')
    runFrames()
    expect(level()).toBe('0.500')
    act(() => host.setVoiceLevels({ agent: 0.25 }))
    runFrames()
    expect(level()).toBe('0.250')
    expect(frames).toHaveLength(1)
  })

  it('lets go of the level and its frames once he stops speaking', () => {
    host.setVoiceLevels({ agent: 0.8 })
    const { rerender } = render(<AutoMascot state="idle" speaking />)
    runFrames()
    expect(level()).toBe('0.800')
    rerender(<AutoMascot state="idle" />)
    expect(stage()).not.toHaveAttribute('data-voice')
    expect(level()).toBe('')
    expect(cancelled).toHaveLength(1)
  })

  it('asks for no frame while he is not speaking', () => {
    host.setVoiceLevels({ agent: 0.8 })
    render(<AutoMascot state="idle" />)
    expect(frames).toEqual([])
    expect(stage()).not.toHaveAttribute('data-voice')
  })
})

describe('holding still', () => {
  it('under the OS reduced-motion setting: no frame, no level, his still', () => {
    host.setReducedMotion(true)
    host.setVoiceLevels({ agent: 0.8 })
    render(<AutoMascot state="idle" speaking />)
    expect(frames).toEqual([])
    expect(level()).toBe('')
    expect(screen.getByTestId('auto-stage').closest('[data-motion="still"]')).not.toBeNull()
  })

  it("while he is paused (Play's Pause Auto), and following his voice again once he plays", () => {
    setMascotPaused(true)
    host.setVoiceLevels({ agent: 0.8 })
    render(<AutoMascot state="idle" speaking />)
    expect(frames).toEqual([])
    expect(level()).toBe('')
    act(() => {
      setMascotPaused(false)
    })
    runFrames()
    expect(level()).toBe('0.800')
  })

  it("draws the swell from the level, scaled by the host's motion factor, and holds the ring at rest when still", () => {
    const swell = declaredFor(MASCOT_CSS, '.stage[data-voice="speaking"] .ring')
    expect(swell.get('animation')).toBe('none')
    expect(swell.get('transform')).toContain('var(--pl-voice-level, 0)')
    expect(swell.get('transform')).toContain('var(--pl-motion-scale, 1)')
    const still = declaredFor(MASCOT_CSS, '.auto[data-motion="still"] .stage[data-voice="speaking"] .ring')
    expect(still.get('transform')).toBe('translateX(-50%)')
  })
})
