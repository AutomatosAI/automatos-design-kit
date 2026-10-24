/**
 * PRD-260 K3 — the look on <html>: applying it sets Play's variables and
 * Studio's tokens; clearing it takes off exactly what the look owns and
 * leaves every other inline style alone.
 *
 * Moved from core's lib/looks/__tests__/document.test.ts as it was, but for its imports: the look runtime
 * (@automatos/look-kit, Play's own src/lib/look-kit before PRD-261 B-01i), Play's looks (src/lib/looks), and the
 * helpers of test/lib/looks/helpers.ts. The <html> is jsdom's.
 */
import { afterEach, describe, expect, it } from 'vitest'

import {
  LOOK_DOCUMENT_NAMES,
  MOTION_ATTRIBUTE,
  MOTION_VAR,
  applyLook,
  applyMotion,
  clearLook,
  lookDocumentVars,
} from '../../../src/lib/looks/document.ts'
import { LOOK_VAR_NAMES, STUDIO_TOKEN_NAMES } from '../../../src/lib/looks/engine.ts'
import { DAYLIGHT, PRESETS } from '../../../src/lib/looks/presets.ts'

import { clearRoot, lookNamesLeft, myLook, rootVars } from './helpers.ts'

/** A property someone else put on <html>; the look must leave it. */
const OTHER_VAR = '--not-the-look'

afterEach(clearRoot)

describe('the look on <html>', () => {
  it('owns every --pl-* variable, every Studio token and the motion variable, and nothing else', () => {
    expect(LOOK_DOCUMENT_NAMES).toEqual([...LOOK_VAR_NAMES, ...STUDIO_TOKEN_NAMES, MOTION_VAR])
    expect(new Set(LOOK_DOCUMENT_NAMES).size).toBe(LOOK_DOCUMENT_NAMES.length)
    for (const look of [...PRESETS, myLook()]) {
      expect(Object.keys(lookDocumentVars(look)).sort()).toEqual([...LOOK_VAR_NAMES, ...STUDIO_TOKEN_NAMES].sort())
    }
  })

  it('applies a look and clears it again, leaving other inline styles alone', () => {
    const root = document.documentElement
    root.style.setProperty(OTHER_VAR, '1')
    applyLook(root, DAYLIGHT)
    applyMotion(root, true)
    expect(rootVars()).toEqual(lookDocumentVars(DAYLIGHT))
    expect(root).toHaveAttribute(MOTION_ATTRIBUTE, 'reduce')
    expect(root.style.getPropertyValue(MOTION_VAR)).toBe('0')

    clearLook(root)
    expect(lookNamesLeft()).toEqual([])
    expect(root.style.getPropertyValue(MOTION_VAR)).toBe('')
    expect(root).not.toHaveAttribute(MOTION_ATTRIBUTE)
    expect(root.style.getPropertyValue(OTHER_VAR)).toBe('1')
  })

  it('marks full motion when the user has not asked for less', () => {
    applyMotion(document.documentElement, false)
    expect(document.documentElement).toHaveAttribute(MOTION_ATTRIBUTE, 'full')
    expect(document.documentElement.style.getPropertyValue(MOTION_VAR)).toBe('1')
  })
})
