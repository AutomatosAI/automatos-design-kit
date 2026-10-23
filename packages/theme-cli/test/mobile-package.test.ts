/**
 * The reader's half of theme.json's `mobile` block (host 1.1.0), as core's reader checks it
 * (orchestrator/services/themes/package.py `_mobile_link_errors`; these repeat the cases of core's
 * tests/test_prd261_mobile_package.py): the fonts the block names are in the package; `fromLooks` paints a
 * phone's ground and its text from the prepaint table's defaults, painted as the web's boot paints them
 * (src/mobile-paint.ts); a `clips` or `stills` mascot has every state's files. And `pack` of the hello theme.
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { checkPackage, MOBILE_CANNOT_PAINT, MOBILE_MASCOT_FILES } from '../src/check-package.ts'
import { byText, collectThemeFiles } from '../src/collect.ts'
import { MOBILE_MASCOT_MODES } from '../src/core/mobile-manifest.ts'
import type { PackageEntry } from '../src/members.ts'
import { bootTable, isStudioTriplet, lookFits, missingTokens, paintLook } from '../src/mobile-paint.ts'
import { packTheme } from '../src/pack.ts'

type JsonObject = Readonly<Record<string, unknown>>
/** Package files to add, by path; null drops one. */
type Files = Readonly<Record<string, Uint8Array | null>>

const HELLO_DIR = fileURLToPath(new URL('./fixtures/core/hello/', import.meta.url))
const HELLO_PACKAGE = 'automatos-e2e.hello-1.0.0.autotheme'
const MANIFEST = 'theme.json'
const PREPAINT = 'boot/prepaint.json'
const DEFAULTS = `${PREPAINT}#defaults`
const MOBILE_ENGINES = { automatos: '^1.1.0', sdk: '^1.0.0' }
const TOKENS = { light: { '--background': '0 0% 100%', '--foreground': '#14181c' } }
const SANS = 'assets/fonts/mobile/sans.ttf'
const MONO = 'assets/fonts/mobile/mono.otf'
// Studio tokens as triplets (hexToTriplet of #1a1814, #f0f4f8, #f4efe6 and #2f6fed); --hello-bg is the theme's own.
const PAPER_TEXT = '40 13.04% 9.02%'
const CREAM = '38.57 38.89% 92.94%'
const BLUE = '219.79 84.07% 55.69%'
const PAPER = { '--background': '40 33.33% 94.12%', '--foreground': PAPER_TEXT }
const INK = { '--background': '210 20% 7.84%', '--foreground': '210 36.36% 95.69%' }
const GROUND = { paper: PAPER, ink: INK }
const ACCENT = { blue: { '--primary': BLUE } }
const BASE = { knobs: { ground: GROUND, accent: ACCENT }, defaults: { ground: 'paper', accent: 'blue' } }
const GLOW = {
  var: '--hello-glow', knob: 'glow', min: 0, max: 30, integer: true, scale: 100, capTable: null, template: 'rgba-alpha',
  color: { knob: 'accent', rgb: { blue: '47,111,237' } },
}
/** GLOW without capTable: a rule the web's boot drops (only a capTable given as null means no caps). */
const UNCAPPED = Object.fromEntries(Object.entries(GLOW).filter(([key]) => key !== 'capTable'))
const CLIP = 'assets/mascot/idle.mp4'
const STILL = 'assets/mascot/idle.png'

/** BASE with one numeric rule, its defaults giving the rule's knob 1. */
function glowing(rule: JsonObject): JsonObject {
  return { ...BASE, numeric: [rule], defaults: { ...BASE.defaults, glow: 1 } }
}

function bytesOf(text: string): number[] {
  return Array.from(text, (char) => char.charCodeAt(0))
}

const PNG = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0)
const MP4 = Uint8Array.of(0, 0, 0, 0x10, ...bytesOf('ftypisom'), 0, 0, 2, 0)
const WEBM = Uint8Array.of(0x1a, 0x45, 0xdf, 0xa3, ...new Array<number>(12).fill(0))
/** One TrueType face, one 4-byte table after its directory (the corpus's font case). */
const FACE = Uint8Array.of(0, 1, 0, 0, 0, 1, 0, 0x10, 0, 0, 0, 0, ...bytesOf('head'), 0, 0, 0, 0, 0, 0, 0, 0x1c, 0, 0, 0, 4, 0, 0, 0, 0)

/** The hello package with theme.json's fields set and `files` added (null drops one), in path order. */
function helloPackage(manifestSet: JsonObject, files: Files = {}): PackageEntry[] {
  const hello = collectThemeFiles(HELLO_DIR)
  const manifest = JSON.parse(new TextDecoder().decode(hello.find((entry) => entry.path === MANIFEST)?.data)) as JsonObject
  const changed = new TextEncoder().encode(`${JSON.stringify({ ...manifest, ...manifestSet }, null, 2)}\n`)
  const entries = new Map<string, Uint8Array | null>([
    ...hello.map((entry): [string, Uint8Array] => [entry.path, entry.data]), [MANIFEST, changed], ...Object.entries(files),
  ])
  const kept = Array.from(entries).flatMap(([path, data]) => (data === null ? [] : [{ path, data }]))
  return kept.sort((a, b) => byText(a.path, b.path))
}

/** The hello package with `mobile`, an engines range that admits it and, given states, a top-level mascot. */
function mobilePackage(mobile: JsonObject, files: Files = {}, states?: readonly string[]): PackageEntry[] {
  return helloPackage({ engines: MOBILE_ENGINES, mobile, ...(states === undefined ? {} : { mascot: { states } }) }, files)
}

/** `fromLooks` with the prepaint table given as an object or as JSON text, or with none. */
function looksPackage(table: JsonObject | string | null): PackageEntry[] {
  const text = typeof table === 'string' ? table : JSON.stringify(table)
  return mobilePackage({ fromLooks: true }, { [PREPAINT]: table === null ? null : new TextEncoder().encode(text) })
}

function refusals(entries: readonly PackageEntry[]): string[][] {
  return checkPackage(entries).errors.map((error) => [error.code, error.path])
}

/** The one refusal's message, once it is `code` at `path` and one plain line. */
function onlyError(entries: readonly PackageEntry[], code: string, path: string): string {
  const { errors, manifest } = checkPackage(entries)
  expect(errors.map((error) => [error.code, error.path])).toEqual([[code, path]])
  expect(manifest).toBeNull()
  expect(errors[0].message.trim()).not.toBe('')
  expect(errors[0].message).not.toContain('\n')
  return errors[0].message
}

describe('the fonts the block names', () => {
  it('a font the package lacks is MISSING_FILE naming it', () => {
    const message = onlyError(mobilePackage({ tokens: TOKENS, fonts: { sans: SANS } }), 'MISSING_FILE', SANS)
    expect(message).toBe(`theme.json names ${SANS}, which isn't in the package.`)
  })

  it('names every missing font, in role order as written', () => {
    expect(refusals(mobilePackage({ tokens: TOKENS, fonts: { mono: MONO, sans: SANS } }))).toEqual([
      ['MISSING_FILE', MONO], ['MISSING_FILE', SANS],
    ])
  })

  it("comes before the block's own refusals, in the order of core's reader", () => {
    expect(refusals(mobilePackage({ fromLooks: true, fonts: { sans: SANS }, mascot: 'stills' }, {}, ['idle']))).toEqual([
      ['MISSING_FILE', SANS], [MOBILE_CANNOT_PAINT, PREPAINT], ['MISSING_FILE', STILL],
    ])
  })
})

describe('fromLooks: the defaults look paints the ground and its text', () => {
  it('cannot paint without boot/prepaint.json', () => {
    const message = onlyError(looksPackage(null), MOBILE_CANNOT_PAINT, PREPAINT)
    expect(message).toContain(PREPAINT)
    expect(message).toContain('"mobile.tokens"')
  })

  it('passes defaults that paint the ground and its text, from a knob table or a pair table', () => {
    expect(refusals(looksPackage({ knobs: { ground: GROUND }, defaults: { ground: 'ink' } }))).toEqual([])
    const knobs = { ground: { paper: { '--background': CREAM } }, accent: ACCENT }
    const pairs = [{ a: 'ground', b: 'accent', table: { paper: { blue: { '--foreground': PAPER_TEXT } } } }]
    expect(refusals(looksPackage({ knobs, pairs, defaults: { ground: 'paper', accent: 'blue' } }))).toEqual([])
  })

  it.each([
    [['--background'], 'paints no --background,'],
    [['--foreground'], 'paints no --foreground,'],
    [['--background', '--foreground'], 'paints no --background or --foreground,'],
  ])('cannot paint defaults that leave out %j', (drop, named) => {
    const paper = Object.fromEntries(Object.entries(PAPER).filter(([name]) => !drop.includes(name)))
    const table = { knobs: { ground: { paper: { ...paper, '--hello-bg': '#f4efe6' }, ink: INK } }, defaults: { ground: 'paper' } }
    expect(onlyError(looksPackage(table), MOBILE_CANNOT_PAINT, DEFAULTS)).toContain(named)
  })

  it('counts only the defaults look, not another choice that paints', () => {
    const table = { knobs: { ground: { paper: { '--foreground': PAPER_TEXT }, ink: INK } }, defaults: { ground: 'paper' } }
    onlyError(looksPackage(table), MOBILE_CANNOT_PAINT, DEFAULTS)
  })

  it.each([
    ['--background', 'hsl(40 33% 94%)'], ['--background', '#f4efe6'], ['--foreground', '#1a1814'],
  ])('paints nothing from %s written as %s: only a triplet paints a Studio token', (token, value) => {
    const table = { knobs: { ground: { paper: { ...PAPER, [token]: value } } }, defaults: { ground: 'paper' } }
    const message = onlyError(looksPackage(table), MOBILE_CANNOT_PAINT, DEFAULTS)
    expect(message).toContain(`paints no ${token},`)
    expect(message).toContain('"H S% L%" triplets')
  })

  it.each([
    ['an option its knob table lacks', { ...BASE, defaults: { ground: 'paper', accent: 'violet' } }],
    ['no cell of a pair table', { ...BASE, pairs: [{ a: 'ground', b: 'accent', table: { ink: { blue: {} } } }] }],
    ['a number out of its rule\'s range', { ...BASE, numeric: [GLOW], defaults: { ...BASE.defaults, glow: 40 } }],
  ])('cannot paint defaults naming %s: the web paints nothing from the table', (_name, table) => {
    const message = onlyError(looksPackage(table), MOBILE_CANNOT_PAINT, DEFAULTS)
    expect(message).toContain('the web paints nothing from the table')
    expect(message).toContain('"mobile.tokens"')
  })

  it('cannot paint a ground a numeric rule paints over: the web paints rgba() there last', () => {
    const table = { ...BASE, numeric: [{ ...GLOW, var: '--background' }], defaults: { ...BASE.defaults, glow: 20 } }
    expect(onlyError(looksPackage(table), MOBILE_CANNOT_PAINT, DEFAULTS)).toContain('paints no --background,')
  })

  it('passes defaults a dropped rule would refuse: a rule with no capTable is not one the web keeps', () => {
    expect(refusals(looksPackage({ ...BASE, numeric: [UNCAPPED], defaults: { ...BASE.defaults, glow: 40 } }))).toEqual([])
  })

  it('reads numbers as JSON.parse does: 2**53 + 1 is 2**53, inside a rule whose max is 2**53', () => {
    const text = JSON.stringify({ ...BASE, numeric: [{ ...GLOW, max: 2 ** 53 }], defaults: { ...BASE.defaults, glow: 0 } })
    expect(refusals(looksPackage(text.replace('"glow":0', '"glow":9007199254740993')))).toEqual([])
  })

  it.each([['{', 'BAD_JSON'], ['[]', 'BAD_PREPAINT']])('refuses an unreadable table %j once, as %s', (text, code) => {
    expect(refusals(looksPackage(text)).map(([refused]) => refused)).toEqual([code])
  })

  it('needs no table for a tokens block', () => {
    expect(refusals(mobilePackage({ tokens: TOKENS }))).toEqual([])
  })
})

describe("the table as the web's boot gets it (bootTable), and what it paints (paintLook)", () => {
  it('paints the look when it fits, else the defaults whole, and nothing from a table it drops', () => {
    expect(paintLook(BASE)).toEqual({ ...PAPER, '--primary': BLUE })
    expect(paintLook(BASE, { ground: 'ink', accent: 'blue' })).toEqual({ ...INK, '--primary': BLUE })
    expect(paintLook(BASE, { ground: 'ink', accent: 'violet' })).toEqual({ ...PAPER, '--primary': BLUE })
    expect(paintLook(BASE, 'ink')).toEqual(paintLook(BASE))
    expect(paintLook({ ...BASE, defaults: { ground: 'sand' } }, { ground: 'ink', accent: 'blue' })).toEqual({})
    expect([lookFits(bootTable(BASE)!, null), lookFits(bootTable(BASE)!, BASE.defaults)]).toEqual([false, true])
  })

  it('paints knob entries in table order, then pair cells, a later one overwriting; only Studio tokens as triplets', () => {
    const knobs = { ground: { paper: { ...PAPER, '--hello-bg': '#f4efe6', '--radius': '6px', '--ring': '#2f6fed' } }, accent: ACCENT }
    const pairs = [{ a: 'ground', b: 'accent', table: { paper: { blue: { '--background': '#f4efe6', '--primary': CREAM } } } }]
    const painted = paintLook({ knobs, pairs, defaults: { ground: 'paper', accent: 'blue' } })
    expect(painted).toEqual({ '--foreground': PAPER_TEXT, '--primary': CREAM })
    expect(missingTokens(painted)).toEqual(['--background'])
  })

  it.each([
    ['not an object', []],
    ['an option key over 64 UTF-16 units', { knobs: { ground: { ['p'.repeat(65)]: PAPER } }, defaults: { ground: 'p'.repeat(65) } }],
    ['33 two-unit characters', { knobs: { ground: { ['😀'.repeat(33)]: PAPER } }, defaults: { ground: '😀'.repeat(33) } }],
    ['a whole-number rule given 2.5', { ...BASE, numeric: [GLOW], defaults: { ...BASE.defaults, glow: 2.5 } }],
    ['a rule colour the rule lacks', glowing({ ...GLOW, color: { knob: 'accent', rgb: { blue: '47,111' } } })],
    ['no cap cell', glowing({ ...GLOW, capTable: ['ground', 'accent'], caps: { ink: { blue: 0.5 } } })],
    ['a cap past 1', glowing({ ...GLOW, capTable: ['ground', 'accent'], caps: { paper: { blue: 2 } } })],
  ])('drops the table when the defaults no longer fit: %s', (_name, table) => {
    expect(bootTable(table)).toBeNull()
    expect(paintLook(table)).toEqual({})
  })

  it('keeps option keys of exactly 64 UTF-16 units, and a capped rule whose cap cell the defaults name', () => {
    expect(bootTable({ knobs: { ground: { ['😀'.repeat(32)]: PAPER } }, defaults: { ground: '😀'.repeat(32) } })).not.toBeNull()
    expect(bootTable(glowing({ ...GLOW, capTable: ['ground', 'accent'], caps: { paper: { blue: 0.5 } } }))?.numeric).toHaveLength(1)
  })

  it.each([
    ['no capTable', UNCAPPED],
    ['another template', { ...GLOW, template: 'rgb' }],
    ['integer not a boolean', { ...GLOW, integer: 1 }],
    ['min over max', { ...GLOW, min: 40, max: 30 }],
    ['scale 0', { ...GLOW, scale: 0 }],
    ['min as text', { ...GLOW, min: '0' }],
    ['a var the boot refuses', { ...GLOW, var: '--Hello-glow' }],
    ['a colour knob that is not a look field', { ...GLOW, color: { knob: '1accent', rgb: GLOW.color.rgb } }],
    ['a capTable of one knob', { ...GLOW, capTable: ['ground'] }],
  ])('drops a numeric rule with %s, so the defaults need not fit it', (_name, rule) => {
    const table = bootTable({ ...BASE, numeric: [rule], defaults: { ...BASE.defaults, glow: 40 } })
    expect(table?.numeric).toEqual([])
  })

  it('drops knob tables and pairs whose knobs are not look fields, so the defaults need not name them', () => {
    const knobs = { ...BASE.knobs, '1ground': GROUND, ['k'.repeat(33)]: GROUND }
    const kept = bootTable({ ...BASE, knobs, pairs: [{ a: 'ground', b: 'accent-1', table: {} }] })
    expect([Object.keys(kept?.knobs ?? {}), kept?.pairs]).toEqual([['ground', 'accent'], []])
  })

  it('drops defaults that are not text or a finite number: 1e400 reads as Infinity, so a rule over it no longer fits', () => {
    const defaults = { ...BASE.defaults, radius: true, '1ground': 'paper', glow: null }
    expect(bootTable({ ...BASE, defaults })?.defaults).toEqual(BASE.defaults)
    const text = JSON.stringify({ ...BASE, numeric: [GLOW], defaults: { ...BASE.defaults, glow: 1 } })
    expect(bootTable(JSON.parse(text))).not.toBeNull()
    expect(bootTable(JSON.parse(text.replace('"glow":1', '"glow":1e400')))).toBeNull()
  })

  it("keeps only the variables the boot's own gate passes", () => {
    const paper = {
      ...PAPER, '--hello-a': 'url(x)', '--hello-b': 'color-mix(in srgb, red, blue)', '--hello-c': 'rgb(1,2,3',
      '--Hello-d': 'red', '--hello-e': 'x'.repeat(201), '--hello-f': 'calc(1px + 2px)', '--hello-g': 'hsl(var(--hello-h))',
    }
    const table = bootTable({ knobs: { ground: { paper } }, defaults: { ground: 'paper' } })
    expect(Object.keys(table?.knobs.ground.paper ?? {})).toEqual(['--background', '--foreground', '--hello-f', '--hello-g'])
  })

  it('reads a Studio token only as an "H S% L%" triplet; a scheme of mobile.tokens may give #rrggbb', () => {
    expect(['0 0% 100%', '359.99 100% 0%', BLUE].map(isStudioTriplet)).toEqual([true, true, true])
    expect(['#ffffff', '360 0% 0%', '0 0% 100.5%', 'hsl(0 0% 100%)', '0 0 100%', 1, null].map(isStudioTriplet)).toEqual(
      [false, false, false, false, false, false, false],
    )
    expect(missingTokens({ '--background': '#FFFFFF', '--foreground': '0 0% 0%' })).toEqual([])
    expect(missingTokens({ '--background': 'red' })).toEqual(['--background', '--foreground'])
  })
})

describe('the mascot files a phone draws', () => {
  function mascotPackage(mode: string | null, files: Files = {}, states: readonly string[] = ['idle']): PackageEntry[] {
    const mobile = { tokens: TOKENS, ...(mode === null ? {} : { mascot: mode }) }
    return mobilePackage(mobile, { [CLIP]: MP4, [STILL]: PNG, ...files }, states)
  }

  it('maps every mode to its files: clips the .mp4 and .png, stills the .png, none nothing', () => {
    expect(Object.keys(MOBILE_MASCOT_FILES).sort()).toEqual([...MOBILE_MASCOT_MODES].sort())
    expect(MOBILE_MASCOT_FILES).toEqual({ clips: ['mp4', 'png'], stills: ['png'], none: [] })
  })

  it('passes clips with the clip and the still', () => {
    const result = checkPackage(mascotPackage('clips'))
    expect(result.errors).toEqual([])
    expect(result.manifest).not.toBeNull()
  })

  it.each([CLIP, STILL])('refuses clips without %s, as MISSING_FILE naming it', (dropped) => {
    expect(onlyError(mascotPackage('clips', { [dropped]: null }), 'MISSING_FILE', dropped)).toBe(
      `"mobile.mascot" "clips" needs ${dropped}, which isn't in the package.`,
    )
  })

  it('takes no .webm for the .mp4: a phone plays mp4', () => {
    onlyError(mascotPackage('clips', { [CLIP]: null, 'assets/mascot/idle.webm': WEBM }), 'MISSING_FILE', CLIP)
  })

  it('needs only the still for stills, and nothing for none or no mode', () => {
    expect(refusals(mascotPackage('stills', { [CLIP]: null }))).toEqual([])
    onlyError(mascotPackage('stills', { [STILL]: null }), 'MISSING_FILE', STILL)
    expect(refusals(mascotPackage('none', { [CLIP]: null, [STILL]: null }))).toEqual([])
    expect(refusals(mascotPackage(null, { [CLIP]: null, [STILL]: null }))).toEqual([])
  })

  it('checks every state in order, the .mp4 before the .png', () => {
    expect(refusals(mascotPackage('clips', {}, ['idle', 'wave']))).toEqual([
      ['MISSING_FILE', 'assets/mascot/wave.mp4'], ['MISSING_FILE', 'assets/mascot/wave.png'],
    ])
  })
})

describe('pack with a mobile block', () => {
  const folders: string[] = []

  afterEach(() => {
    folders.splice(0).forEach((folder) => rmSync(folder, { recursive: true, force: true }))
  })

  function tempFolder(): string {
    const folder = mkdtempSync(join(tmpdir(), 'automatos-mobile-'))
    folders.push(folder)
    return folder
  }

  /** A copy of the hello theme whose theme.json names a phone font. */
  function helloWithFont(): string {
    const theme = join(tempFolder(), 'hello')
    cpSync(HELLO_DIR, theme, { recursive: true })
    const manifest = JSON.parse(readFileSync(join(theme, MANIFEST), 'utf8')) as JsonObject
    const mobile = { tokens: TOKENS, fonts: { sans: SANS } }
    writeFileSync(join(theme, MANIFEST), `${JSON.stringify({ ...manifest, engines: MOBILE_ENGINES, mobile }, null, 2)}\n`)
    return theme
  }

  it('stops with MISSING_FILE when the hello theme names a mobile font it lacks, and writes nothing', () => {
    const out = tempFolder()
    const result = packTheme(helloWithFont(), out)
    if (result.ok) throw new Error('a theme naming a font it lacks must not pack')
    expect(result.errors.map((error) => [error.code, error.path])).toEqual([['MISSING_FILE', SANS]])
    expect(existsSync(join(out, HELLO_PACKAGE))).toBe(false)
  })

  it('packs the font once it is there, listed as font/ttf', () => {
    const theme = helloWithFont()
    mkdirSync(join(theme, 'assets', 'fonts', 'mobile'), { recursive: true })
    writeFileSync(join(theme, SANS), FACE)
    const result = packTheme(theme, tempFolder())
    if (!result.ok) throw new Error(result.errors.map((error) => error.message).join('\n'))
    expect(result.manifest.files[SANS].type).toBe('font/ttf')
  })
})
