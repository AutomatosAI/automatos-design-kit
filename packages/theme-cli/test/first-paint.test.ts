/**
 * The first paint `check design` measures (PRD-261 B-03d), at the core commit src/core/README.md names:
 * the table as the host keeps it (boot-sanitize.ts sanitizePrepaint, through src/mobile-paint.ts `bootTable`
 * and `lookFits`, the CLI's one port of it), painted as THEME_BOOT_SCRIPT paints it (src/check/contrast.ts
 * `firstPaint`). Its Studio tokens are the ones the server's paint_look keeps for a phone (mobile-paint.ts
 * `paintLook`), and a tone rule paints nothing: boot.ts reads the kept rule only for the tone an installed
 * theme's first paint starts in.
 *
 * The seeded theme is design-support.ts's.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { contrastMeter, firstPaint, type ContrastMeter } from '../src/check/contrast.ts'
import { checkDesignFiles, DESIGN_CONTRAST_PATH } from '../src/check/design.ts'
import { PREPAINT_PATH } from '../src/core/css-value.ts'
import { MOBILE_TOKEN_NAMES } from '../src/core/mobile-manifest.ts'
import { bootTable, isStudioTriplet, paintLook, type BootTable } from '../src/mobile-paint.ts'
import { contrastFile, entriesOf, GLOW, PASSING, rowOf, TABLE } from './design-support.ts'

/** A look of TABLE's other choices, radius 12 (a glow of 0.12). */
const INK_GREEN = { ground: 'ink', accent: 'green', radius: 12 }
/** A look naming a ground TABLE has no entry for. */
const UNFIT = { ground: 'dusk', accent: 'blue', radius: 6 }
const TONE = { knob: 'ground', values: { paper: 'light', ink: 'dark' } }
const LOOKS: Array<[string, unknown]> = [['the defaults', TABLE.defaults], ['ink and green', INK_GREEN], ['a look that does not fit', UNFIT]]

let meter: ContrastMeter

beforeAll(async () => {
  meter = await contrastMeter()
})

/** `table` as bootTable keeps it; the test fails when it drops it. */
function kept(table: unknown): BootTable {
  const found = bootTable(table)
  if (found === null) throw new Error('bootTable dropped the table')
  return found
}

describe('the table as the host keeps it (boot-sanitize.ts sanitizePrepaint), not as the file holds it', () => {
  const capped = { ...GLOW, capTable: ['ground', 'accent'], caps: { paper: { blue: 1.5, green: 0.5 }, ink: { blue: 0.5, green: 0.5 } } }
  const DROPPED: Array<[string, unknown]> = [
    ['an rgb list with spaces', { ...TABLE, numeric: [{ ...GLOW, color: { ...GLOW.color, rgb: { ...GLOW.color.rgb, blue: '29, 78, 216' } } }] }],
    ['a cap past 1', { ...TABLE, numeric: [capped] }],
  ]

  it.each(DROPPED)("measures nothing when the host's drops (%s) leave the defaults unfit, as it then drops the table", (_name, table) => {
    const result = checkDesignFiles(entriesOf({ [PREPAINT_PATH]: table }), meter)
    expect(rowOf(result, 'prepaint').errors.map((error) => error.code)).toEqual(['PREPAINT_DEFAULTS_UNFIT'])
    expect(rowOf(result, 'contrast').errors.map((error) => [error.code, error.path])).toEqual([['CONTRAST_NOT_MEASURED', PREPAINT_PATH]])
    expect(result.measures).toEqual([])
  })

  it('paints nothing from a numeric rule the host drops (an integer that is not true or false)', () => {
    const table = { ...TABLE, numeric: [{ ...GLOW, integer: 1 }] }
    const pairs = contrastFile([{ text: '--hello-glow', ground: '--hello-bg' }])
    const result = checkDesignFiles(entriesOf({ [PREPAINT_PATH]: table, [DESIGN_CONTRAST_PATH]: pairs }), meter)
    expect(rowOf(result, 'prepaint').level).toBe('pass')
    expect(rowOf(result, 'contrast').errors.map((error) => error.message)).toContain(
      'Preset "default": --hello-glow on --hello-bg can\'t be measured: --hello-glow is not painted.',
    )
  })
})

describe("the first paint (THEME_BOOT_SCRIPT's paint, boot.ts :145-:148)", () => {
  it('paints each knob entry, then the pair cell, then the numeric rule as rgba(); the defaults for a look that does not fit', () => {
    expect(firstPaint(kept(TABLE), INK_GREEN)).toEqual({
      '--hello-bg': '#111111', '--hello-text': '#EEEEEE', '--background': '0 0% 7%', '--foreground': '0 0% 93%',
      '--fg': 'hsl(0 0% 93%)', '--hello-accent': '#1E7F3C', '--hello-link': '#2E9E52', '--hello-glow': 'rgba(30,127,60,0.12)',
    })
    expect(firstPaint(kept(TABLE), UNFIT)).toEqual(firstPaint(kept(TABLE), TABLE.defaults))
    expect(firstPaint(kept(TABLE), TABLE.defaults)['--hello-glow']).toBe('rgba(29,78,216,0.06)')
  })

  it("caps a numeric rule's alpha (the knob over its kept scale) at its cap cell", () => {
    const caps = { paper: { blue: 0.04, green: 0.5 }, ink: { blue: 0.5, green: 0.5 } }
    const table = kept({ ...TABLE, numeric: [{ ...GLOW, capTable: ['ground', 'accent'], caps }] })
    expect(firstPaint(table, TABLE.defaults)['--hello-glow']).toBe('rgba(29,78,216,0.04)')
    expect(firstPaint(table, INK_GREEN)['--hello-glow']).toBe('rgba(30,127,60,0.12)')
  })

  it.each(LOOKS)(
    "%s: its triplet Studio tokens are the ones mobile-paint.ts paintLook (the server's paint_look) paints",
    (_name, look) => {
      const studio = Object.entries(firstPaint(kept(TABLE), look))
        .filter(([name, value]) => MOBILE_TOKEN_NAMES.includes(name) && isStudioTriplet(value))
      expect(Object.fromEntries(studio)).toEqual(paintLook(TABLE, look))
      expect(studio.length).toBeGreaterThan(0)
    },
  )

  it('paints and measures the same with a tone rule as without it: boot.ts reads the kept rule only for the tone', () => {
    const declared = [...PASSING, { text: '--hello-glow', ground: '--hello-bg' }]
    const pairs = contrastFile(declared)
    const [plain, toned] = [TABLE, { ...TABLE, tone: TONE }].map((table) => (
      checkDesignFiles(entriesOf({ [PREPAINT_PATH]: table, [DESIGN_CONTRAST_PATH]: pairs }), meter)
    ))
    expect(rowOf(toned, 'prepaint').level).toBe('pass')
    expect(toned.rows).toEqual(plain.rows)
    expect(toned.measures).toEqual(plain.measures)
    expect(toned.measures).toHaveLength(declared.length * 2)
    expect(firstPaint(kept({ ...TABLE, tone: TONE }), INK_GREEN)).toEqual(firstPaint(kept(TABLE), INK_GREEN))
  })
})
