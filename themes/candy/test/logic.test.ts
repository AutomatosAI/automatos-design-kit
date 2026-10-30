// @vitest-environment node
// Candy's pure helpers: which card gradient a thing wears and the letter on its avatar (src/ui/sets.ts), times in
// Candy's words (src/ui/when.ts), Auto's state as a glyph and a word (src/art/state-words.ts), and his geometry
// (src/art/auto-geometry.ts, auto-path.ts): the CSS gradients resolved to points, the twelve states' eyes, and the
// outlines the SVG and the stills share. The times are made up, read in the machine's own zone.
import { describe, expect, it } from 'vitest'

import { MASCOT_STATES } from '@automatos/mascot/types'

import { AUTO_BOX, autoParts, BODY, EYE_FORMS, linear, radial, VISOR } from '../src/art/auto-geometry.ts'
import { archBoxes, roundRectPath, shapePath } from '../src/art/auto-path.ts'
import { stateGlyph, stateWord } from '../src/art/state-words.ts'
import { kebab } from '../src/looks/names.ts'
import { cardSetOf, initialOf, kindSetOf } from '../src/ui/sets.ts'
import { agoWords, aheadWords, dayWords, shortWhen } from '../src/ui/when.ts'

const at = (year: number, month: number, day: number, hour = 12, minute = 0): number =>
  new Date(year, month - 1, day, hour, minute).getTime()
const iso = (time: number): string => new Date(time).toISOString()
const NOW = at(2026, 10, 30, 15, 0)

describe('the card sets and avatars', () => {
  it('cycles the three gradients in screen order', () => {
    expect([0, 1, 2, 3, 4, 5, -1].map(cardSetOf)).toEqual([1, 2, 3, 1, 2, 3, 3])
  })

  it("gives a Deliverable its kind's gradient, the first for a kind it doesn't know", () => {
    expect(['report', 'slides', 'document', 'spreadsheet', 'image', 'blog', 'Report', 'video', null].map(kindSetOf))
      .toEqual([1, 1, 2, 2, 3, 3, 1, 1, 1])
    expect(['slide', 'blog_post', 'constructor', 'toString'].map(kindSetOf)).toEqual([1, 3, 1, 1])
  })

  it("takes a name's first letter or digit, upper-cased", () => {
    expect([' iris', 'Élan', '42 bot', '', null, '—'].map(initialOf)).toEqual(['I', 'É', '4', '?', '?', '?'])
  })
})

describe('times in words', () => {
  it('says how long ago', () => {
    expect(agoWords(iso(NOW - 20_000), NOW)).toBe('Now')
    expect(agoWords(iso(NOW - 12 * 60_000), NOW)).toBe('12 min ago')
    expect(agoWords(iso(NOW - 2 * 3_600_000), NOW)).toBe('2 h ago')
    expect(agoWords(iso(at(2026, 10, 29, 9)), NOW)).toBe('Yesterday')
    expect(agoWords(iso(at(2026, 10, 26, 9)), NOW)).toBe('Mon')
    expect(agoWords(iso(at(2026, 10, 24, 9)), NOW)).toBe('Oct 24')
    expect(agoWords('not a time', NOW)).toBeNull()
  })

  it('shortens it at a list edge, and names the day', () => {
    expect(shortWhen(iso(NOW - 2 * 3_600_000), NOW)).toBe('2 h')
    expect(dayWords(iso(at(2026, 10, 30, 8)), NOW)).toBe('Today')
    expect(dayWords(null, NOW)).toBeNull()
  })

  it('says when something is ahead', () => {
    expect(aheadWords(iso(at(2026, 10, 30, 16, 0)), NOW)).toBe('16:00')
    expect(aheadWords(iso(at(2026, 10, 31, 9)), NOW)).toBe('Tomorrow')
    expect(aheadWords(iso(at(2026, 11, 3, 9)), NOW)).toBe('Tue')
    expect(aheadWords(iso(at(2026, 11, 20, 9)), NOW)).toBe('Nov 20')
  })
})

describe("Auto's state words", () => {
  it('says every state as a glyph and a word', () => {
    MASCOT_STATES.forEach((state) => {
      expect(stateWord(state).length, state).toBeGreaterThan(0)
      expect(stateGlyph(state), state).toMatch(/^[●○✓✕]$/)
    })
    expect(`${stateGlyph('listening')} ${stateWord('listening')}`).toBe('● Listening')
  })
})

describe("Auto's geometry", () => {
  const box = { x: 0, y: 0, w: 100, h: 50 }

  it('runs a 180° gradient straight down the box, and a 150° one corner to corner through the centre', () => {
    expect(linear(box, 180, [])).toMatchObject({ x1: 50, y1: 0, x2: 50, y2: 50 })
    const slant = linear(box, 150, [])
    if (slant.kind !== 'linear') throw new TypeError('linear')
    expect((slant.x1 + slant.x2) / 2).toBeCloseTo(50)
    expect((slant.y1 + slant.y2) / 2).toBeCloseTo(25)
    expect(slant.x2 > slant.x1 && slant.y2 > slant.y1).toBe(true)
  })

  it("reaches a radial gradient's farthest corner", () => {
    expect(radial(box, 0, 0, [])).toMatchObject({ cx: 0, cy: 0, r: Math.sqrt(100 * 100 + 50 * 50) })
  })

  it('draws every state with the same body and visor, the eyes inside the visor', () => {
    MASCOT_STATES.forEach((state) => {
      const parts = autoParts(state)
      expect(parts.map((part) => part.name)).toEqual(
        ['stalk', 'ball', 'body', 'visor', 'shine', 'eye-left', 'eye-right', 'cheek-left', 'cheek-right'],
      )
      parts.filter((part) => part.name.startsWith('eye')).forEach(({ shape }) => {
        expect(shape.x).toBeGreaterThanOrEqual(VISOR.x)
        expect(shape.x + shape.w).toBeLessThanOrEqual(VISOR.x + VISOR.w)
        expect(shape.y).toBeGreaterThanOrEqual(VISOR.y)
        expect(shape.y + shape.h).toBeLessThanOrEqual(VISOR.y + VISOR.h)
      })
    })
    expect(Object.keys(EYE_FORMS).sort()).toEqual([...MASCOT_STATES].sort())
  })

  it('keeps the whole drawing inside its square', () => {
    const parts = autoParts('idle')
    const top = Math.min(...parts.map((part) => part.shape.y))
    expect(top).toBeGreaterThanOrEqual(AUTO_BOX.y)
    expect(BODY.y + BODY.h).toBeLessThanOrEqual(AUTO_BOX.y + AUTO_BOX.size)
  })

  it('outlines a box with elliptical corners, and an arch as two boxes for the even-odd rule', () => {
    const pill = { kind: 'rrect' as const, x: 0, y: 0, w: 10, h: 4, rx: [2, 2, 2, 2] as const, ry: [2, 2, 2, 2] as const }
    expect(roundRectPath(pill)).toBe('M2 0 L8 0 A2 2 0 0 1 10 2 L10 2 A2 2 0 0 1 8 4 L2 4 A2 2 0 0 1 0 2 L0 2 A2 2 0 0 1 2 0 Z')
    const [outer, inner] = archBoxes({ kind: 'arch', x: 0, y: 0, w: 10, h: 8, stroke: 2 })
    expect([outer.w, outer.h, inner.x, inner.y, inner.w, inner.h]).toEqual([10, 8, 2, 2, 6, 6])
    expect(shapePath({ kind: 'arch', x: 0, y: 0, w: 10, h: 8, stroke: 2 }).match(/M/g)).toHaveLength(2)
  })

  it('names each colour as a lower-case custom property', () => {
    expect(['bodyA', 'eyeGlow', 'cheek'].map(kebab)).toEqual(['body-a', 'eye-glow', 'cheek'])
  })
})
