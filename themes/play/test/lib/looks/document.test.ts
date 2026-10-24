/**
 * PRD-260 K3 — the look on <html>: applying it sets Play's variables and
 * Studio's tokens; clearing it takes off exactly what the look owns and
 * leaves every other inline style alone.
 *
 * Moved from core's lib/looks/__tests__/document.test.ts as it was, but for its imports: the look runtime
 * (@automatos/look-kit, Play's own src/lib/look-kit before PRD-261 B-01i), Play's looks (src/lib/looks), and the
 * helpers of test/lib/looks/helpers.ts; and, since Play 1.1.1 (PRD-261 K-21), for the motion mark, which the
 * host writes now (data-theme-motion), so the look owns none. The <html> is jsdom's.
 */
import { afterEach, describe, expect, it } from 'vitest'

import { LOOK_DOCUMENT_NAMES, applyLook, clearLook, lookDocumentVars } from '../../../src/lib/looks/document.ts'
import { LOOK_VAR_NAMES, STUDIO_TOKEN_NAMES } from '../../../src/lib/looks/engine.ts'
import { DAYLIGHT, PRESETS } from '../../../src/lib/looks/presets.ts'

import { clearRoot, lookNamesLeft, myLook, rootVars } from './helpers.ts'

/** A property someone else put on <html>; the look must leave it. */
const OTHER_VAR = '--not-the-look'
/** The host's motion mark (core's THEME_MOTION_ATTRIBUTE); the look neither writes nor clears it. */
const HOST_MOTION_ATTRIBUTE = 'data-theme-motion'

afterEach(clearRoot)

describe('the look on <html>', () => {
  it('owns every --pl-* variable and every Studio token, and nothing else', () => {
    expect(LOOK_DOCUMENT_NAMES).toEqual([...LOOK_VAR_NAMES, ...STUDIO_TOKEN_NAMES])
    expect(new Set(LOOK_DOCUMENT_NAMES).size).toBe(LOOK_DOCUMENT_NAMES.length)
    for (const look of [...PRESETS, myLook()]) {
      expect(Object.keys(lookDocumentVars(look)).sort()).toEqual([...LOOK_VAR_NAMES, ...STUDIO_TOKEN_NAMES].sort())
    }
  })

  it('applies a look and clears it again, leaving other inline styles alone', () => {
    const root = document.documentElement
    root.style.setProperty(OTHER_VAR, '1')
    applyLook(root, DAYLIGHT)
    expect(rootVars()).toEqual(lookDocumentVars(DAYLIGHT))

    clearLook(root)
    expect(lookNamesLeft()).toEqual([])
    expect(root.style.getPropertyValue(OTHER_VAR)).toBe('1')
  })

  it("writes no motion mark of its own and leaves the host's alone (K-21)", () => {
    const root = document.documentElement
    root.setAttribute(HOST_MOTION_ATTRIBUTE, 'reduce')
    applyLook(root, DAYLIGHT)
    expect(root).not.toHaveAttribute('data-pl-motion')
    expect(root.style.getPropertyValue('--pl-motion')).toBe('')
    clearLook(root)
    expect(root).toHaveAttribute(HOST_MOTION_ATTRIBUTE, 'reduce')
  })
})
