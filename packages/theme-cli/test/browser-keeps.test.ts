/**
 * What core's browser would leave out of a theme's first paint and looks (src/first-paint.ts), refused by
 * `check design` and `check` before the theme ships: a knob or pair cell's value the first paint's gate drops
 * (boot-sanitize.ts, through mobile-paint.ts `bootValueProblem`), and a looks/schema.json knob the table never
 * paints (looks/spec.ts `lookSpecOf` builds a theme's looks from the table alone).
 *
 * The fixture is Candy 1.0.0's look data as it was released (fixtures/candy-1.0.0: boot/prepaint.json,
 * looks/schema.json and its presets, byte for byte): it passed every check, and on a hosted install its cards came
 * out transparent, its band and aura were gone and every look failed. Play, HUD and Arcade pass unchanged.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { contrastMeter, type ContrastMeter } from '../src/check/contrast.ts'
import { WARNING_PREFIX } from '../src/cli-main.ts'
import { checkDesign, checkDesignFiles, readDesignFiles } from '../src/check/design.ts'
import { PREPAINT_PATH, prepaintErrors } from '../src/core/css-value.ts'
import { validateLookSchema, type LookSchema } from '../src/core/look-schema.ts'
import { firstPaintErrors, KNOB_NOT_PAINTED, prepaintDropErrors, unpaintedKnobErrors } from '../src/first-paint.ts'
import { parseJson } from '../src/json.ts'
import { SCHEMA_PATH } from '../src/looks.ts'
import { bootValueProblem, CSS_VALUE_MAX_LENGTH, isBootValue } from '../src/mobile-paint.ts'
import { helloFolder, ranCheck, removeTempFolders } from './check-support.ts'
import { entriesOf, GLOW, rowOf, TABLE } from './design-support.ts'

const KIT = fileURLToPath(new URL('../../../', import.meta.url))
const CANDY_1_0_0 = fileURLToPath(new URL('./fixtures/candy-1.0.0/', import.meta.url))
const CLEAN_THEMES = ['hud', 'arcade', 'play'] as const
const PALETTES = ['blush', 'lilac', 'nightbloom']
const GRADIENTS = ['soft', 'rich', 'vivid']
const RADIAL = 'a gradient, radial-gradient()'
const LINEAR = 'a gradient, linear-gradient()'
const DROPPED = "the browser's first paint drops it, and every value built on it."
/** pack's warnings (hello ships no source/) come before any refusal. */
const WARNING = WARNING_PREFIX

let meter: ContrastMeter

beforeAll(async () => {
  meter = await contrastMeter()
})

afterEach(removeTempFolders)

/** A theme folder's look files by path, as `check design` reads them. */
function filesOf(themeDir: string): Map<string, Uint8Array> {
  return new Map(readDesignFiles(themeDir).map((entry): [string, Uint8Array] => [entry.path, entry.data]))
}

function jsonIn(files: ReadonlyMap<string, Uint8Array>, path: string): unknown {
  const raw = files.get(path)
  if (raw === undefined) throw new Error(`no ${path}`)
  return parseJson(raw, path).data
}

function schemaIn(files: ReadonlyMap<string, Uint8Array>): LookSchema {
  const { schema } = validateLookSchema(jsonIn(files, SCHEMA_PATH))
  if (schema === null) throw new Error(`${SCHEMA_PATH} does not pass core's look validator`)
  return schema
}

/** Each refusal's "<variable> for <look> is <rule>", the words after its path. */
function said(messages: readonly string[]): string[] {
  return messages.map((message) => message.slice(message.indexOf(': ') + 2).replace(`: ${DROPPED}`, ''))
}

describe("Candy 1.0.0's look data, as it was released", () => {
  const files = filesOf(CANDY_1_0_0)
  const table = jsonIn(files, PREPAINT_PATH)

  it("passes core's prepaint checks, as it did: the import grammar takes every gradient", () => {
    expect(prepaintErrors(table)).toEqual([])
  })

  it('names every value the first paint drops: the highlight, the vivid glow, the band in all nine cells, the vivid aura', () => {
    const expected = [
      ...GRADIENTS.map((gradient) => `--candy-card-hi for gradient "${gradient}" is ${RADIAL}`),
      `--candy-card-glow for gradient "vivid" is ${RADIAL}`,
      ...PALETTES.flatMap((palette) => GRADIENTS.map((gradient) => `--candy-band for palette "${palette}" and gradient "${gradient}" is ${LINEAR}`)),
      ...PALETTES.map((palette) => `--candy-aura for palette "${palette}" and gradient "vivid" is ${RADIAL}`),
    ]
    const errors = prepaintDropErrors(table)
    expect(new Set(errors.map((error) => error.code))).toEqual(new Set(['BAD_CSS_VALUE']))
    expect(said(errors.map((error) => error.message)).sort()).toEqual(expected.sort())
    expect(errors.every((error) => error.message.endsWith(DROPPED) && error.path.startsWith(`${PREPAINT_PATH}#`))).toBe(true)
  })

  it('drops the aura for its gradient, not its length: 197 characters, within the 200 the first paint takes', () => {
    const pairs = (table as { readonly pairs: ReadonlyArray<{ readonly table: Record<string, Record<string, Record<string, string>>> }> }).pairs
    const auras = PALETTES.map((palette) => pairs[1]?.table[palette]?.vivid?.['--candy-aura'] ?? '')
    expect(auras.map((aura) => aura.length)).toEqual(PALETTES.map(() => 197))
    expect(auras.map((aura) => aura.length <= CSS_VALUE_MAX_LENGTH && bootValueProblem(aura))).toEqual(PALETTES.map(() => RADIAL))
  })

  it('refuses roundness, the one knob of its schema the table never paints', () => {
    const errors = unpaintedKnobErrors(schemaIn(files), table)
    expect(errors.map((error) => [error.code, error.path])).toEqual([[KNOB_NOT_PAINTED, `${SCHEMA_PATH}#knobs.roundness`]])
    expect(errors[0]?.message).toContain('its look spec leaves "roundness" out and every look fails, the presets included')
  })

  it('fails check design on its prepaint line, with every drop and the knob; its presets still pass the schema', async () => {
    const result = await checkDesign(CANDY_1_0_0)
    expect(rowOf(result, 'looks').level).toBe('pass')
    const prepaint = rowOf(result, 'prepaint')
    expect(prepaint.level).toBe('error')
    expect(prepaint.errors.filter((error) => error.code === 'BAD_CSS_VALUE')).toHaveLength(16)
    expect(prepaint.errors.filter((error) => error.code === KNOB_NOT_PAINTED).map((error) => error.path)).toEqual([`${SCHEMA_PATH}#knobs.roundness`])
  })
})

describe('Play, HUD and Arcade, as they are released', () => {
  it.each(CLEAN_THEMES)('%s: the first paint keeps every value, and the table paints every knob of the schema', (name) => {
    const theme = join(KIT, 'themes', name)
    if (!existsSync(join(theme, PREPAINT_PATH))) {
      throw new Error(`themes/${name} has no ${PREPAINT_PATH}: kit.yml's Build step (npm run build) writes Play's before the tests.`)
    }
    expect(firstPaintErrors(filesOf(theme))).toEqual([])
  })

  it.each(['hud', 'arcade'] as const)('%s passes check design on its prepaint line', async (name) => {
    expect(rowOf(await checkDesign(join(KIT, 'themes', name)), 'prepaint')).toMatchObject({ level: 'pass', errors: [] })
  })
})

describe('the rules, one at a time', () => {
  it('keeps what boot-sanitize.ts keeps, and says why it drops the rest', () => {
    const kept = ['#FF6A1F', 'rgba(244,238,232,.12)', 'hsl(12 5% 7% / 0.14)', 'var(--x),sans-serif', 'calc(4px + 1rem)', 'saturate(1.2)']
    expect(kept.filter((value) => !isBootValue(value))).toEqual([])
    expect(bootValueProblem('color-mix(in srgb, #fff 50%, black)')).toBe('a call to color-mix(), a function the first paint never runs')
    expect(bootValueProblem('my_font, serif')).toBe('text with "_", a character the first paint refuses')
    expect(bootValueProblem('1'.repeat(CSS_VALUE_MAX_LENGTH + 1))).toBe('over 200 characters')
    expect(bootValueProblem('1'.repeat(CSS_VALUE_MAX_LENGTH))).toBeNull()
    expect(bootValueProblem('a(b')).toBe("text whose brackets don't pair")
  })

  it('refuses a knob only a numeric rule the browser drops would paint', () => {
    const files = new Map(entriesOf({ [PREPAINT_PATH]: { ...TABLE, numeric: [{ ...GLOW, template: 'rgba' }] } }).map((entry): [string, Uint8Array] => [entry.path, entry.data]))
    expect(firstPaintErrors(files).map((error) => [error.code, error.path])).toEqual([[KNOB_NOT_PAINTED, `${SCHEMA_PATH}#knobs.radius`]])
  })

  it("gives no KNOB_NOT_PAINTED for a table the browser drops whole: its defaults don't fit what it keeps", () => {
    const result = checkDesignFiles(entriesOf({ [PREPAINT_PATH]: { ...TABLE, numeric: [], defaults: { ground: 'dusk', accent: 'blue' } } }), meter)
    expect(rowOf(result, 'prepaint').errors.map((error) => error.code)).toEqual(['PREPAINT_DEFAULTS_UNFIT'])
  })

  it('looks only at a table that passes core\'s prepaint checks: core refuses the rest on its own', () => {
    const refused = { ...TABLE, knobs: { ...TABLE.knobs, accent: { blue: { '--hello-accent': 'url(https://example.com/x.png)' } } } }
    const files = new Map(entriesOf({ [PREPAINT_PATH]: refused }).map((entry): [string, Uint8Array] => [entry.path, entry.data]))
    expect(firstPaintErrors(files)).toEqual([])
  })
})

describe('check', () => {
  const wash = 'linear-gradient(120deg,#1D4ED8 0%,#1E7F3C 100%)'

  it("refuses a theme whose first paint drops a value and whose table never paints a knob, with every reason", async () => {
    const accent = { blue: { '--hello-accent': '#1D4ED8', '--hello-wash': wash }, green: { '--hello-accent': '#1E7F3C' } }
    const table = { ...TABLE, knobs: { ...TABLE.knobs, accent }, numeric: [] }
    const ran = await ranCheck(['check', helloFolder({ replace: { [PREPAINT_PATH]: JSON.stringify(table) } })])
    const said = ran.err.filter((line) => !line.startsWith(WARNING))
    expect(ran.code).toBe(1)
    expect(ran.out).toEqual([])
    expect(said[0]).toMatch(/can't be checked: the browser would leave part of its first paint or its looks out\.$/)
    expect(said.slice(1).map((line) => line.trim().split(' ').slice(0, 2).join(' '))).toEqual([
      `BAD_CSS_VALUE ${PREPAINT_PATH}#knobs.accent.blue.--hello-wash:`, `${KNOB_NOT_PAINTED} ${SCHEMA_PATH}#knobs.radius:`,
    ])
  })

  it('checks a theme whose table the first paint keeps whole and that paints every knob', async () => {
    const ran = await ranCheck(['check', helloFolder({ replace: { [PREPAINT_PATH]: JSON.stringify(TABLE) } })])
    expect([ran.code, ran.err.filter((line) => !line.startsWith(WARNING))]).toEqual([0, []])
    expect(ran.out.at(-1)).toMatch(/^verdict: pass /)
  })
})
