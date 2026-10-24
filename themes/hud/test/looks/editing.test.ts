// @vitest-environment node
// The LOOK drawer's rules, pure: the look the active one was picked from, whether it is edited, the status line,
// what Save as new look makes (MINE n, never a taken id or name, and a look HUD's spec takes), what Reset goes back
// to, which looks can be deleted, and the glow the page paints, capped where its background and accent need it.
import { describe, expect, it } from 'vitest'
import { safeGlow } from '../../src/lib/looks/engine.ts'
import { ARC, FORGE, NOVA, PRESETS } from '../../src/lib/looks/presets.ts'
import { validateHudLook } from '../../src/lib/looks/spec.ts'
import type { HudLook } from '../../src/lib/looks/types.ts'
import {
  asNewLook, baseLook, clampKnob, EDITED_MARK, flipped, glowCap, isEdited, isSavedLook, resetTarget, shownGlow,
  statusLine, withValues,
} from '../../src/looks/editing.ts'

const mine = (n: number, fields: Partial<HudLook> = {}): HudLook => ({ ...ARC, id: `mine-${n}`, name: `MINE ${n}`, ...fields })

describe('the look the active one was picked from', () => {
  it('is its preset, or its saved look, or none', () => {
    expect(baseLook({ ...FORGE, accent: 'arc' }, [])).toBe(FORGE)
    expect(baseLook(mine(1, { grid: 3 }), [mine(1)])).toEqual(mine(1))
    expect(baseLook(mine(9), [mine(1)])).toBeUndefined()
  })

  it('reads as edited only once a knob differs from it', () => {
    expect(isEdited(ARC, [])).toBe(false)
    expect(isEdited(withValues(ARC, { glow: 3 }), [])).toBe(true)
    expect(isEdited(withValues(mine(9), { glow: 3 }), [])).toBe(false)
    expect(statusLine(ARC, [])).toBe('ARC')
    expect(statusLine(withValues(ARC, { scan: 'off' }), [])).toBe(`ARC · ${EDITED_MARK}`)
  })

  it('changes knobs on a copy, never on the look it is handed', () => {
    const changed = withValues(ARC, { accent: 'gold', grid: 2 })
    expect(changed).toEqual({ ...ARC, accent: 'gold', grid: 2 })
    expect(ARC.accent).toBe('arc')
  })
})

describe('Save as new look', () => {
  it('names the look MINE n under the id mine-n, from the count of saved looks up, skipping any taken', () => {
    expect(asNewLook(ARC, [])).toEqual({ ...ARC, id: 'mine-1', name: 'MINE 1', sub: '' })
    expect(asNewLook(ARC, [mine(1)]).id).toBe('mine-2')
    expect(asNewLook(ARC, [mine(2)])).toMatchObject({ id: 'mine-3', name: 'MINE 3' })
    expect(asNewLook(ARC, [mine(7, { name: 'MINE 2' })])).toMatchObject({ id: 'mine-3', name: 'MINE 3' })
  })

  it("makes a look HUD's look spec takes, from every preset", () => {
    for (const preset of PRESETS) expect(validateHudLook(asNewLook(preset, [mine(1)])).ok).toBe(true)
  })
})

describe('Reset and Delete', () => {
  it('Reset goes back to the picked look, or to ARC when there is none', () => {
    expect(resetTarget(withValues(NOVA, { glow: 1 }), [])).toBe(NOVA)
    expect(resetTarget(mine(1, { glow: 1 }), [mine(1)])).toEqual(mine(1))
    expect(resetTarget(mine(4), [])).toBe(ARC)
  })

  it('only a saved look of the user\'s own can be deleted, never a preset', () => {
    expect(isSavedLook(mine(1), [mine(1)])).toBe(true)
    expect(isSavedLook(mine(1), [])).toBe(false)
    expect(isSavedLook(ARC, [ARC])).toBe(false)
  })
})

describe('the numbers and the switches', () => {
  it('reads a slider as a whole number in its range', () => {
    expect(clampKnob(12.4, 0, 30)).toBe(12)
    expect(clampKnob(-3, 0, 30)).toBe(0)
    expect(clampKnob(99, 0, 30)).toBe(30)
    expect(clampKnob(Number.NaN, 0, 30)).toBe(0)
  })

  it("paints the look's glow, or its background and accent's cap where that is lower", () => {
    expect(glowCap(NOVA)).toBe(safeGlow('navy', 'nova'))
    expect(shownGlow(ARC)).toBe(ARC.glow)
    expect(shownGlow(NOVA)).toBe(Math.min(NOVA.glow, glowCap(NOVA)))
    expect(shownGlow(NOVA)).toBeLessThan(NOVA.glow)
  })

  it('flips a switch', () => {
    expect(flipped('on')).toBe('off')
    expect(flipped('off')).toBe('on')
  })
})
