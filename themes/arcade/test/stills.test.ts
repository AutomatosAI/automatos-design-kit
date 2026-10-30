// @vitest-environment node
// Auto's twelve stills for the phone (theme.json mobile.mascot "stills"): assets/mascot/<state>.png is each state's
// first frame as the sprite engine draws it (src/art/), in the bronze robot's colours (a phone can't recolour a
// picture, so the stills keep the dark palettes' Auto), each art pixel STILL_SCALE screen pixels, on a clear ground.
// This test holds every committed still to the engine, pixel for pixel; with ARCADE_WRITE=1 it writes them
// (`ARCADE_WRITE=1 npx vitest run test/stills.test.ts`). It also holds each still under the package's 512 KB cap.
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { MASCOT_STATES } from '@automatos/mascot/types'

import { AUTO_SIZE } from '../src/art/auto-sprite.ts'
import { spriteState } from '../src/art/states.ts'
import { SPRITE_COLOURS, type SpriteKey } from '../src/looks/catalogue.ts'
import { decodePng, encodePng, type Raster } from './support/png.ts'

const THEME_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')
const MASCOT_DIR = join(THEME_DIR, 'assets', 'mascot')
const WRITE = process.env.ARCADE_WRITE === '1'
export const STILL_SCALE = 8
const STILL_CAP_BYTES = 512 * 1024

function rgba(hex: string): readonly [number, number, number, number] {
  const value = hex.slice(1)
  const channel = (index: number) => parseInt(value.slice(index * 2, index * 2 + 2), 16)
  return [channel(0), channel(1), channel(2), value.length === 8 ? channel(3) : 255]
}

/** A state's first frame, scaled up with every art pixel a square of STILL_SCALE. */
function rasterOf(name: (typeof MASCOT_STATES)[number]): Raster {
  const size = AUTO_SIZE * STILL_SCALE
  const pixels = Buffer.alloc(size * size * 4)
  spriteState(name).frames[0].forEach((run) => {
    const colour = rgba(SPRITE_COLOURS.bronze[run.key as SpriteKey])
    for (let y = run.y * STILL_SCALE; y < (run.y + 1) * STILL_SCALE; y += 1) {
      for (let x = run.x * STILL_SCALE; x < (run.x + run.width) * STILL_SCALE; x += 1) pixels.set(colour, (y * size + x) * 4)
    }
  })
  return { width: size, height: size, pixels }
}

describe("Auto's stills", () => {
  if (WRITE) {
    mkdirSync(MASCOT_DIR, { recursive: true })
    MASCOT_STATES.forEach((name) => writeFileSync(join(MASCOT_DIR, `${name}.png`), encodePng(rasterOf(name))))
  }

  it.each([...MASCOT_STATES])('%s.png is its first frame, as the engine draws it', (name) => {
    const path = join(MASCOT_DIR, `${name}.png`)
    const still = decodePng(readFileSync(path))
    const drawn = rasterOf(name)
    expect([still.width, still.height]).toEqual([drawn.width, drawn.height])
    expect(still.pixels.equals(drawn.pixels)).toBe(true)
    expect(statSync(path).size).toBeLessThanOrEqual(STILL_CAP_BYTES)
  })

  it("names every state theme.json's mascot block names, in its order", () => {
    const manifest = JSON.parse(readFileSync(join(THEME_DIR, 'theme.json'), 'utf8')) as { mascot: { states: string[] } }
    expect(manifest.mascot.states).toEqual([...MASCOT_STATES])
  })
})
