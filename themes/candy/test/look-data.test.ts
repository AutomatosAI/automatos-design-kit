// @vitest-environment node
// Candy's look data is made from its catalogue (src/looks/): looks/schema.json from the knobs, one preset file per
// palette, boot/prepaint.json from the palettes, the card gradients and the knobs, design/contrast.json from the
// pairs, and theme.json's default look. This test holds each committed file equal to what the code makes; with
// CANDY_WRITE=1 it writes them instead (`CANDY_WRITE=1 npx vitest run test/look-data.test.ts`), so a colour is
// changed in the catalogue alone. It also checks every pair on every preset here, on the colours as painted.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { CARD_INK, CARD_SETS, PALETTES } from '../src/looks/catalogue.ts'
import { contrastRatio, hexOfTriplet, rgbOfHex, tripletOf } from '../src/looks/colour.ts'
import { ALL_PAIRS } from '../src/looks/pairs.ts'
import { buildPrepaint, buildSchema } from '../src/looks/prepaint.ts'
import { DEFAULT_LOOK, LOOK_INTERFACE, LOOK_SCHEMA, PRESETS } from '../src/looks/spec.ts'

const THEME_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')
const WRITE = process.env.CANDY_WRITE === '1'
const PRESET_SUFFIX = '.look.json'
const HEX = /^#[0-9a-f]{6}$/i
const HSL = /^hsl\((.+)\)$/

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`
const readJson = (path: string): unknown => JSON.parse(readFileSync(join(THEME_DIR, path), 'utf8'))

/** Each file the look data is, with what the code makes for it. */
function madeFiles(): ReadonlyMap<string, unknown> {
  const files = new Map<string, unknown>([
    ['looks/schema.json', buildSchema(LOOK_SCHEMA, LOOK_INTERFACE)],
    ['boot/prepaint.json', buildPrepaint()],
    ['design/contrast.json', { schema: 'automatos-theme-contrast/v1', pairs: ALL_PAIRS }],
  ])
  PRESETS.forEach((look) => files.set(`looks/presets/${look.id}${PRESET_SUFFIX}`, look))
  return files
}

function writeAll(files: ReadonlyMap<string, unknown>): void {
  files.forEach((value, path) => {
    mkdirSync(dirname(join(THEME_DIR, path)), { recursive: true })
    writeFileSync(join(THEME_DIR, path), json(value))
  })
}

/** A preset's variables as the first paint sets them: every knob's cell, then each pair table's. */
function painted(look: (typeof PRESETS)[number]): Readonly<Record<string, string>> {
  const table = buildPrepaint()
  const knobs = Object.entries(table.knobs).map(([knob, cells]) => cells[String(look[knob as keyof typeof look])] ?? {})
  const pairs = table.pairs.map((pair) => pair.table[String(look[pair.a as keyof typeof look])][String(look[pair.b as keyof typeof look])])
  return Object.assign({}, ...knobs, ...pairs)
}

/** A painted value as #rrggbb: a hex as is, Studio's `hsl(H S% L%)` or a bare triplet read back. */
function hexOf(value: string): string {
  if (HEX.test(value)) return value
  const inner = HSL.exec(value)?.[1] ?? value
  return hexOfTriplet(inner)
}

describe('the look data', () => {
  const files = madeFiles()
  if (WRITE) writeAll(files)

  it.each([...files.keys()])('%s is what the catalogue makes', (path) => {
    expect(readJson(path)).toEqual(files.get(path))
  })

  it('has one preset file per palette and nothing else, the default first and in theme.json', () => {
    const names = readdirSync(join(THEME_DIR, 'looks', 'presets')).filter((name) => name.endsWith(PRESET_SUFFIX)).sort()
    expect(names).toEqual(PALETTES.map((palette) => `${palette.id}${PRESET_SUFFIX}`).sort())
    expect((readJson('theme.json') as { look: string }).look).toBe(DEFAULT_LOOK.id)
  })
})

describe('every pair, on every preset and on One colour cards', () => {
  const looks = PRESETS.flatMap((look) => [look, { ...look, cards: 'single' }])
  it.each(looks.map((look) => [`${look.name} (${look.cards})`, look] as const))('%s reads at its minimum', (_name, look) => {
    const vars = painted(look)
    ALL_PAIRS.forEach((pair) => {
      const ratio = contrastRatio(rgbOfHex(hexOf(vars[pair.text])), rgbOfHex(hexOf(vars[pair.ground])))
      expect(ratio, `${pair.text} on ${pair.ground} in ${look.name}`).toBeGreaterThanOrEqual(pair.min ?? 4.5)
    })
  })

  it('keeps white text at AA on every card start and middle, and at 3:1 on every end', () => {
    Object.values(CARD_SETS).forEach((set) => {
      expect(contrastRatio(rgbOfHex(CARD_INK), rgbOfHex(set.a))).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(rgbOfHex(CARD_INK), rgbOfHex(set.b))).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(rgbOfHex(CARD_INK), rgbOfHex(set.c))).toBeGreaterThanOrEqual(3)
    })
  })

  it('writes a colour as a triplet that reads back as the same colour, give or take one step', () => {
    PALETTES.forEach(({ colours }) => {
      const back = rgbOfHex(hexOfTriplet(tripletOf(colours.page)))
      rgbOfHex(colours.page).forEach((channel, index) => expect(Math.abs(channel - back[index])).toBeLessThanOrEqual(1))
    })
  })
})
