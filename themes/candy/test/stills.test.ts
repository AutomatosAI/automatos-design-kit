// @vitest-environment node
// Auto's twelve stills for the phone (theme.json mobile.mascot "stills"): assets/mascot/<state>.png is each state as his
// geometry draws it (src/art/auto-geometry.ts, rasterised by test/support/raster.ts), STILL_SIZE pixels a side on a
// clear ground. This test holds every committed still to the geometry, pixel for pixel; with CANDY_WRITE=1 it writes
// them (`CANDY_WRITE=1 npx vitest run test/stills.test.ts`). It also holds each still under the package's 512 KB cap.
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { decodePng, encodePng } from '@automatos/theme-harness/png'
import { MASCOT_STATES } from '@automatos/mascot/types'

import { rasterAuto } from './support/raster.ts'

const THEME_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')
const MASCOT_DIR = join(THEME_DIR, 'assets', 'mascot')
const WRITE = process.env.CANDY_WRITE === '1'
export const STILL_SIZE = 320
const STILL_CAP_BYTES = 512 * 1024
/** A still is a few million samples and three blurs: seconds each, more on a busy runner. */
const RASTER_TIMEOUT_MS = 60_000

describe("Auto's stills", { timeout: RASTER_TIMEOUT_MS }, () => {
  if (WRITE) {
    mkdirSync(MASCOT_DIR, { recursive: true })
    MASCOT_STATES.forEach((name) => writeFileSync(join(MASCOT_DIR, `${name}.png`), encodePng(rasterAuto(name, STILL_SIZE))))
  }

  it.each([...MASCOT_STATES])('%s.png is his geometry, as the rasteriser draws it', (name) => {
    const path = join(MASCOT_DIR, `${name}.png`)
    const still = decodePng(readFileSync(path))
    const drawn = rasterAuto(name, STILL_SIZE)
    expect([still.width, still.height]).toEqual([drawn.width, drawn.height])
    expect(still.pixels.equals(drawn.pixels)).toBe(true)
    expect(statSync(path).size).toBeLessThanOrEqual(STILL_CAP_BYTES)
  }, RASTER_TIMEOUT_MS)

  it("names every state theme.json's mascot block names, in its order", () => {
    const manifest = JSON.parse(readFileSync(join(THEME_DIR, 'theme.json'), 'utf8')) as { mascot: { states: string[] } }
    expect(manifest.mascot.states).toEqual([...MASCOT_STATES])
  })

  it('draws a different face for each of the concept’s five moods', () => {
    const faces = ['idle', 'listening', 'thinking', 'celebrate', 'sleeping'] as const
    const pictures = faces.map((name) => rasterAuto(name, 64).pixels.toString('base64'))
    expect(new Set(pictures).size).toBe(faces.length)
  }, RASTER_TIMEOUT_MS)
})
