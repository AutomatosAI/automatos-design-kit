// HUD's waveform on the kit's harness: it follows readVoiceLevels in an animation-frame loop, the newest level at the
// bars beside the voice button and older ones moving out, the member's level while the microphone is open and Auto's
// while he speaks; and it holds still (no loop, every bar at rest) while no session runs, under the reduced-motion
// setting and while the look's motion is off. The loop is cancelled, and the bars put back at rest, when the session
// ends, when motion is turned off and when the waveform unmounts. The browser's animation frames are stood in for, so
// each frame runs when the test says. Roles, names and attributes only; every level is made up.
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { host } from '@automatos/theme-harness/host'
import { ARC } from '../../src/lib/looks/presets.ts'
import { REST_SCALE } from '../../src/voice/wave.ts'
import { Waveform } from '../../src/voice/waveform.tsx'

type Frame = (time: number) => void

/** The frames asked for and not yet run or cancelled, by id. */
let pending: ReadonlyMap<number, Frame> = new Map()
let lastId = 0
let requestFrame = vi.fn((_frame: Frame): number => 0)
let cancelFrame = vi.fn((_id: number): void => undefined)

/** Runs every frame asked for so far, as the browser's next paint would. */
function nextFrame(time = 16): void {
  const due = [...pending.values()]
  pending = new Map()
  due.forEach((frame) => frame(time))
}

/** The waveform's bars, in order. */
function bars(): HTMLElement[] {
  const wave = document.querySelector('[data-entry]')
  if (wave === null) throw new Error('No waveform on the page.')
  return Array.from(wave.children).filter((bar): bar is HTMLElement => bar instanceof HTMLElement)
}

const wave = (): Element | null => document.querySelector('[data-entry]')

/** Each bar's scale as the loop last set it; null for a bar the loop never set (the stylesheet's rest). */
function scales(): (number | null)[] {
  return bars().map((bar) => {
    const match = /^scaleY\(([\d.]+)\)$/.exec(bar.style.getPropertyValue('transform'))
    return match === null ? null : Number(match[1])
  })
}

const atRest = (): boolean => scales().every((scale) => scale === null)

/** Six bars, the newest level entering at the middle pair, as the phone's. */
const renderWave = () => render(<Waveform bars={6} entry="middle" size="small" />)

beforeEach(() => {
  host.reset()
  pending = new Map()
  lastId = 0
  requestFrame = vi.fn((frame: Frame): number => {
    lastId += 1
    pending = new Map([...pending, [lastId, frame]])
    return lastId
  })
  cancelFrame = vi.fn((id: number): void => {
    pending = new Map([...pending].filter(([known]) => known !== id))
  })
  vi.stubGlobal('requestAnimationFrame', requestFrame)
  vi.stubGlobal('cancelAnimationFrame', cancelFrame)
})

// Unmounted first, so a loop still running is cancelled through the stand-in that started it.
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('the waveform', () => {
  it("draws the design's bars at rest, hidden from assistive technology, with no loop while no session runs", () => {
    renderWave()
    expect(bars()).toHaveLength(6)
    expect(wave()).toHaveAttribute('aria-hidden', 'true')
    expect(wave()).toHaveAttribute('data-moving', 'false')
    const design = Array.from({ length: 6 }, (_, index) => (0.25 + 0.75 * Math.abs(Math.sin(index * 1.7) * Math.cos(index * 0.37))))
    expect(bars().map((bar) => bar.style.getPropertyValue('--hud-bar'))).toEqual(design.map((height) => height.toFixed(3)))
    expect(requestFrame).not.toHaveBeenCalled()
    expect(atRest()).toBe(true)
  })

  it("follows the member's level while the microphone is open, the newest at the middle, older ones moving out", () => {
    renderWave()
    act(() => host.setVoicePhase('listening'))
    expect(wave()).toHaveAttribute('data-moving', 'true')
    expect(requestFrame).toHaveBeenCalledTimes(1)
    host.setVoiceLevels({ user: 0.8 })
    nextFrame()
    expect(scales()).toEqual([REST_SCALE, REST_SCALE, 0.85, 0.85, REST_SCALE, REST_SCALE])
    host.setVoiceLevels({ user: 0.4 })
    nextFrame()
    expect(scales()).toEqual([REST_SCALE, 0.85, 0.55, 0.55, 0.85, REST_SCALE])
    expect(requestFrame).toHaveBeenCalledTimes(3)
  })

  it("follows Auto's level while he speaks", () => {
    host.setVoicePhase('speaking')
    renderWave()
    host.setVoiceLevels({ agent: 0.6 })
    nextFrame()
    expect(scales()).toEqual([REST_SCALE, REST_SCALE, 0.7, 0.7, REST_SCALE, REST_SCALE])
  })

  it('takes the newest level in at one end for a half beside the desktop button', () => {
    host.setVoicePhase('listening')
    render(<Waveform bars={4} entry="end" size="large" />)
    host.setVoiceLevels({ user: 1 })
    nextFrame()
    expect(scales()).toEqual([REST_SCALE, REST_SCALE, REST_SCALE, 1])
  })

  it('holds still under the reduced-motion setting: no loop, every bar at rest, whatever the levels', () => {
    host.setReducedMotion(true)
    host.setVoicePhase('listening')
    host.setVoiceLevels({ user: 1 })
    renderWave()
    nextFrame()
    expect(requestFrame).not.toHaveBeenCalled()
    expect(wave()).toHaveAttribute('data-moving', 'false')
    expect(atRest()).toBe(true)
  })

  it("holds still while the look's motion is off", () => {
    host.setLooks({ look: { ...ARC, motion: 'off' } })
    host.setVoicePhase('speaking')
    host.setVoiceLevels({ agent: 1 })
    renderWave()
    nextFrame()
    expect(requestFrame).not.toHaveBeenCalled()
    expect(atRest()).toBe(true)
  })

  it('cancels its loop and goes back to rest when motion is turned off mid-session, and when the session ends', () => {
    host.setVoicePhase('listening')
    host.setVoiceLevels({ user: 0.8 })
    renderWave()
    nextFrame()
    expect(atRest()).toBe(false)
    act(() => host.setReducedMotion(true))
    expect(cancelFrame).toHaveBeenLastCalledWith(lastId)
    expect(pending.size).toBe(0)
    expect(atRest()).toBe(true)
    act(() => host.setReducedMotion(false))
    nextFrame()
    expect(atRest()).toBe(false)
    act(() => host.setVoicePhase('idle'))
    expect(cancelFrame).toHaveBeenLastCalledWith(lastId)
    expect(pending.size).toBe(0)
    expect(atRest()).toBe(true)
  })

  it('cancels its loop when it unmounts', () => {
    host.setVoicePhase('listening')
    const { unmount } = renderWave()
    nextFrame()
    const waiting = lastId
    unmount()
    expect(cancelFrame).toHaveBeenCalledWith(waiting)
    expect(pending.size).toBe(0)
  })
})
