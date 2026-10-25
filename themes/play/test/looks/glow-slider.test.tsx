// Play 1.1.1: the Glow slider. It was the engine's own range input, a different control in each browser; now it is
// drawn from the look's tokens in both engines (Chromium and WebKit's ::-webkit-slider-*, Firefox's ::-moz-range-*):
// a track in the outlined buttons' line, filled in the accent as text up to the thumb from --pl-look-slider-fill,
// which the slider sets inline from its value, and a round thumb in the accent as text ringed in the ground.
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GlowSlider } from '../../src/components/looks/look-options.tsx'
import { fillStyle } from '../../src/components/looks/swatch-style.ts'
import { clampGlow } from '../../src/lib/looks/editor.ts'
import { safeGlow } from '../../src/lib/looks/engine.ts'
import { EMBER } from '../../src/lib/looks/presets.ts'
import { declaredFor } from '../support/rule-values.ts'

const EDITOR_CSS = 'components/looks/editor.module.css'
const FILLED_TRACK = 'linear-gradient(to right, var(--pl-color-accent-text) var(--pl-look-slider-fill, 0%), var(--pl-line-button) 0)'
const ENGINES: readonly (readonly [string, string, string])[] = [
  ['Chromium and WebKit', '.slider::-webkit-slider-runnable-track', '.slider::-webkit-slider-thumb'],
  ['Firefox', '.slider::-moz-range-track', '.slider::-moz-range-thumb'],
]

describe('the Glow slider (Play 1.1.1)', () => {
  it('fills its track up to the thumb: the share of the safe glow, 0% when nothing can be picked', () => {
    expect(fillStyle(12, 24)).toEqual({ '--pl-look-slider-fill': '50%' })
    expect(fillStyle(40, 24)).toEqual({ '--pl-look-slider-fill': '100%' })
    expect(fillStyle(6, 0)).toEqual({ '--pl-look-slider-fill': '0%' })
  })

  it("sets that fill on the slider from the look's glow", () => {
    render(<GlowSlider look={EMBER} onChange={vi.fn()} />)
    const max = safeGlow(EMBER.ground, EMBER.accent)
    const expected = fillStyle(clampGlow(EMBER.glow, max), max)['--pl-look-slider-fill']
    expect(screen.getByRole('slider', { name: 'Glow' }).style.getPropertyValue('--pl-look-slider-fill')).toBe(expected)
  })

  it("draws its own control in place of the engine's, keeping accent-color for an engine that draws its own", () => {
    const slider = declaredFor(EDITOR_CSS, '.slider')
    expect([slider.get('appearance'), slider.get('accent-color')]).toEqual(['none', 'var(--pl-color-accent-text)'])
  })

  it.each(ENGINES)('in %s, a filled track and a round thumb in the accent as text, ringed in the ground', (_engine, track, thumb) => {
    expect(declaredFor(EDITOR_CSS, track).get('background')).toBe(FILLED_TRACK)
    const knob = declaredFor(EDITOR_CSS, thumb)
    expect([knob.get('background'), knob.get('border'), knob.get('border-radius')]).toEqual([
      'var(--pl-color-accent-text)', '2px solid var(--pl-color-bg)', 'var(--pl-radius-round)',
    ])
  })
})
