// @vitest-environment node
// Arcade's look data is made from its catalogue (src/looks/): looks/schema.json from the knobs, one preset file per
// palette, boot/prepaint.json from the palettes, the art and the knobs, design/contrast.json from the pairs, and
// theme.json's default look. This test holds each committed file equal to what the code makes; with
// ARCADE_WRITE=1 it writes them instead (`ARCADE_WRITE=1 npx vitest run test/look-data.test.ts`), so a colour is
// changed in the catalogue alone. It also checks the design's contrast pairs here, on the colours as written.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { PALETTES } from '../src/looks/catalogue.ts'
import { contrastRatio, hexOfTriplet, rgbOfHex, tripletOf } from '../src/looks/colour.ts'
import { ALL_PAIRS, DESIGN_PAIRS } from '../src/looks/pairs.ts'
import { buildPrepaint, buildSchema } from '../src/looks/prepaint.ts'
import { DEFAULT_LOOK, LOOK_INTERFACE, LOOK_SCHEMA, PRESETS } from '../src/looks/spec.ts'

const THEME_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')
const WRITE = process.env.ARCADE_WRITE === '1'
const PRESET_SUFFIX = '.look.json'

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

describe("the design's colour pairs, as the catalogue writes them", () => {
  const colourOf = (palette: (typeof PALETTES)[number], variable: string): string => {
    const key = Object.entries({
      '--arcade-tx': 'tx', '--arcade-tx2': 'tx2', '--arcade-bar-tx': 'barTx', '--arcade-bar': 'bar', '--arcade-ac': 'ac',
      '--arcade-page': 'page', '--arcade-win': 'win', '--arcade-hp': 'hp', '--arcade-xp': 'xp', '--arcade-mp': 'mp',
      '--arcade-qs': 'qs', '--arcade-hlt': 'hlt', '--arcade-hl': 'hl', '--arcade-aci': 'aci', '--arcade-bd': 'bd',
    }).find(([name]) => name === variable)?.[1] as keyof typeof palette.colours
    return palette.colours[key]
  }

  it.each(PALETTES.map((palette) => [palette.name, palette] as const))('%s reads at AA on every pair', (_name, palette) => {
    DESIGN_PAIRS.forEach((pair) => {
      const ratio = contrastRatio(rgbOfHex(colourOf(palette, pair.text)), rgbOfHex(colourOf(palette, pair.ground)))
      expect(ratio, `${pair.label} in ${palette.name}`).toBeGreaterThanOrEqual(pair.min ?? 4.5)
    })
  })

  it('writes a colour as a triplet that reads back as the same colour, give or take one step', () => {
    PALETTES.forEach(({ colours }) => {
      const back = rgbOfHex(hexOfTriplet(tripletOf(colours.page)))
      rgbOfHex(colours.page).forEach((channel, index) => expect(Math.abs(channel - back[index])).toBeLessThanOrEqual(1))
    })
  })
})
