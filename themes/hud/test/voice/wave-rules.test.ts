// HUD's voice rules, each a plain function read without rendering: the Command design's waveform (72 bars on the
// desktop, 44 on the phone, the design's shape, a desktop half its own half of it), the voice's levels the bars show,
// newest at the bars beside the voice button and older ones further out, each bar at rest a quarter of its height (the
// stylesheet's own rest), when a session runs, and MIC LIVE's words. Every value is made up.
import { describe, expect, it } from 'vitest'
import { isVoiceRunning, MIC_LIVE, MIC_MUTED, micWords } from '../../src/voice/session.ts'
import {
  ageOf, barScales, clampLevel, DESKTOP_BARS, historyLength, PHONE_BARS, pushLevel, REST_SCALE, shapeAt, waveShape,
} from '../../src/voice/wave.ts'
import { readSource } from '../support/files.ts'

/** The design's own bar height ("Automatos Command HUD.dc.html" wave()). */
const designBar = (index: number): number => 0.25 + 0.75 * Math.abs(Math.sin(index * 1.7) * Math.cos(index * 0.37))

describe('the waveform', () => {
  it("has the design's bars: 72 on the desktop, 44 on the phone, each the design's height, a quarter to all of it", () => {
    expect([DESKTOP_BARS, PHONE_BARS]).toEqual([72, 44])
    const shape = waveShape(DESKTOP_BARS)
    expect(shape).toHaveLength(72)
    shape.forEach((height, index) => expect(height).toBeCloseTo(designBar(index), 10))
    expect(Math.min(...shape)).toBeGreaterThanOrEqual(0.25)
    expect(Math.max(...shape)).toBeLessThanOrEqual(1)
    expect(shapeAt(0)).toBe(0.25)
  })

  it("splits the desktop's 72 into two halves of the same shape, the second from the middle bar on", () => {
    const half = DESKTOP_BARS / 2
    expect([...waveShape(half), ...waveShape(half, half)]).toEqual(waveShape(DESKTOP_BARS))
  })

  it('ages a bar by its distance from where the newest level enters: the middle pair, or one end', () => {
    expect(Array.from({ length: 6 }, (_, index) => ageOf(index, 6, 'middle'))).toEqual([2, 1, 0, 0, 1, 2])
    expect(Array.from({ length: 5 }, (_, index) => ageOf(index, 5, 'middle'))).toEqual([2, 1, 0, 1, 2])
    expect(Array.from({ length: 4 }, (_, index) => ageOf(index, 4, 'start'))).toEqual([0, 1, 2, 3])
    expect(Array.from({ length: 4 }, (_, index) => ageOf(index, 4, 'end'))).toEqual([3, 2, 1, 0])
    const lengths = [historyLength(44, 'middle'), historyLength(5, 'middle'), historyLength(36, 'start'), historyLength(36, 'end')]
    expect(lengths).toEqual([22, 3, 36, 36])
  })

  it('keeps the newest level first, as many as the bars show, in a new array each time', () => {
    const first = pushLevel([], 0.5, 3)
    const second = pushLevel(first, 0.7, 3)
    expect(second).toEqual([0.7, 0.5])
    expect(first).toEqual([0.5])
    expect(pushLevel([0.3, 0.2, 0.1], 0.9, 3)).toEqual([0.9, 0.3, 0.2])
  })

  it('takes a level as 0 to 1, and anything that is no number as 0', () => {
    expect([-1, 0.4, 3, Number.NaN, Infinity].map(clampLevel)).toEqual([0, 0.4, 1, 0, 0])
  })

  it('stands every bar at rest with nothing heard, and a heard bar between rest and its full height by the level', () => {
    expect(barScales([], 4, 'start')).toEqual([REST_SCALE, REST_SCALE, REST_SCALE, REST_SCALE])
    expect(barScales([1, 0.8], 4, 'start')).toEqual([1, 0.85, REST_SCALE, REST_SCALE])
    expect(barScales([0.8, 0.4], 4, 'end')).toEqual([REST_SCALE, REST_SCALE, 0.55, 0.85])
    expect(barScales([0.8, 0.4], 6, 'middle')).toEqual([REST_SCALE, 0.55, 0.85, 0.85, 0.55, REST_SCALE])
  })

  it("rests at the design's floor, a quarter, the same rest the stylesheet draws without the loop", () => {
    expect(REST_SCALE).toBe(0.25)
    expect(readSource('voice/waveform.module.css')).toContain(`--hud-wave-rest: ${REST_SCALE};`)
  })
})

describe('the session', () => {
  it('runs while the host connects, listens, thinks or speaks, and not at rest, once a call ended or after a failure', () => {
    expect((['connecting', 'listening', 'thinking', 'speaking'] as const).every(isVoiceRunning)).toBe(true)
    expect((['idle', 'ended', 'error'] as const).some(isVoiceRunning)).toBe(false)
  })

  it('says the microphone while it is open, muted on a muted call, and nothing while it is shut', () => {
    expect(micWords({ micOpen: true, muted: false })).toBe(MIC_LIVE)
    expect(micWords({ micOpen: true, muted: true })).toBe(MIC_MUTED)
    expect(micWords({ micOpen: false, muted: true })).toBeNull()
    expect([MIC_LIVE, MIC_MUTED]).toEqual(['Mic live', 'Mic muted'])
  })
})
