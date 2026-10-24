// @vitest-environment node
// HUD's look data, held three ways. looks/schema.json and looks/presets/*.look.json are the Command design's files
// (its looks/ folder in the kit's references), byte for byte. The code's copy of them (src/lib/looks: the spec, its labels
// and the presets) is the files' own, knob for knob, with theme.json's look the default. And boot/prepaint.json,
// committed, is the table the catalogue builds (src/lib/looks/prepaint.ts), value for value, with an entry for
// every choice of every knob, a cell for every ground and accent, the defaults the default preset's, the grid and
// the glow as numeric rules and every ground dark.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ACCENTS, ACCENT_KEYS, FONT_KEYS, GROUND_KEYS } from '../src/lib/looks/catalogue.ts'
import { rgba, safeGlowAlpha } from '../src/lib/looks/engine.ts'
import { hudPrepaintTable, type PrepaintTable } from '../src/lib/looks/prepaint.ts'
import { DEFAULT_LOOK, PRESETS } from '../src/lib/looks/presets.ts'
import { HUD_LOOK_SPEC, KNOB_LABELS, validateHudLook } from '../src/lib/looks/spec.ts'
import { KNOB_NAMES, SWITCH_CHOICES, type HudLook } from '../src/lib/looks/types.ts'
import { lookToCssVars } from '../src/lib/looks/vars.ts'
import { DESIGN_LOOKS, readThemeFile, readThemeJson, THEME_ROOT } from './support/files.ts'

type Knob =
  | { readonly kind: 'choice'; readonly label: string; readonly choices: readonly string[]; readonly default: string }
  | { readonly kind: 'number'; readonly label: string; readonly min: number; readonly max: number; readonly integer: boolean; readonly default: number }

interface SchemaFile {
  readonly schema: string
  readonly look: { readonly schema: string; readonly interface: string }
  readonly knobs: Readonly<Record<string, Knob>>
}

const PRESET_SUFFIX = '.look.json'
const PRESETS_FOLDER = join('looks', 'presets')
const schema = readThemeJson<SchemaFile>('looks/schema.json')
const prepaint = readThemeJson<PrepaintTable>('boot/prepaint.json')

function presetFiles(folder: string): string[] {
  return readdirSync(folder).filter((name) => name.endsWith(PRESET_SUFFIX)).sort()
}

/** The spec's knob as looks/schema.json writes it, with its label and the default look's value. */
function specKnob(name: (typeof KNOB_NAMES)[number]): Knob {
  const knob = HUD_LOOK_SPEC.knobs.get(name)
  if (knob === undefined) throw new Error(`the spec has no knob ${name}`)
  const fallback = DEFAULT_LOOK[name]
  if (knob.kind === 'choice') return { kind: 'choice', label: KNOB_LABELS[name], choices: [...knob.choices], default: String(fallback) }
  return { kind: 'number', label: KNOB_LABELS[name], min: knob.min, max: knob.max, integer: knob.integer === true, default: Number(fallback) }
}

/** A look painted from the table as the host's boot paints it: each knob's option, the pair's cell, then the rules. */
function paintFromTable(look: HudLook): Record<string, string> {
  const fields = look as unknown as Readonly<Record<string, string | number>>
  const options = Object.entries(prepaint.knobs).map(([knob, table]) => table[String(fields[knob])])
  const cells = prepaint.pairs.map((pair) => pair.table[String(fields[pair.a])][String(fields[pair.b])])
  const numbers = prepaint.numeric.map((rule) => {
    const colour = String(fields[rule.color.knob])
    const cap = rule.capTable === null || rule.caps === null ? 1 : rule.caps[String(fields[rule.capTable[0]])][String(fields[rule.capTable[1]])]
    return { [rule.var]: rgba(ACCENTS[colour as keyof typeof ACCENTS].hex, Math.min(Number(fields[rule.knob]) / rule.scale, cap)) }
  })
  return Object.assign({}, ...options, ...cells, ...numbers) as Record<string, string>
}

function picks(look: HudLook): Record<string, string | number> {
  return Object.fromEntries(KNOB_NAMES.map((name) => [name, look[name]]))
}

// The kit's references may be taken out on their own (tests/references.test.ts): this holds while they are there.
describe.runIf(existsSync(DESIGN_LOOKS))("looks/: the Command design's look files, byte for byte", () => {
  it('looks/schema.json is the design\'s looks/schema.json', () => {
    const design = readFileSync(join(DESIGN_LOOKS, 'looks', 'schema.json'))
    expect(readFileSync(join(THEME_ROOT, 'looks', 'schema.json')).equals(design)).toBe(true)
  })

  it('looks/presets/ holds the five design presets, each byte for byte', () => {
    const designFolder = join(DESIGN_LOOKS, 'looks', 'presets')
    const files = presetFiles(join(THEME_ROOT, PRESETS_FOLDER))
    expect(files).toEqual(presetFiles(designFolder))
    expect(files).toEqual(['arc', 'forge', 'ghost', 'nova', 'signal'].map((id) => `${id}${PRESET_SUFFIX}`))
    files.forEach((name) => {
      const own = readFileSync(join(THEME_ROOT, PRESETS_FOLDER, name))
      expect(own.equals(readFileSync(join(designFolder, name))), name).toBe(true)
    })
  })
})

describe("the code's copy of the look format", () => {
  it("names looks/schema.json's look schema and interface", () => {
    expect(schema.look).toEqual({ schema: HUD_LOOK_SPEC.lookSchema, interface: HUD_LOOK_SPEC.interface })
  })

  it("has the schema's knobs, kinds, labels, choices and ranges in its order, the default preset's values as defaults", () => {
    expect(Object.keys(schema.knobs)).toEqual([...KNOB_NAMES])
    expect(Array.from(HUD_LOOK_SPEC.knobs.keys())).toEqual([...KNOB_NAMES])
    KNOB_NAMES.forEach((name) => expect(schema.knobs[name], name).toEqual(specKnob(name)))
  })

  it('has one preset per file, each equal to its file, the default first and in theme.json', () => {
    expect(PRESETS.map((look) => `${look.id}${PRESET_SUFFIX}`).sort()).toEqual(presetFiles(join(THEME_ROOT, PRESETS_FOLDER)))
    PRESETS.forEach((look) => expect(readThemeJson(`looks/presets/${look.id}${PRESET_SUFFIX}`), look.id).toEqual(look))
    expect([PRESETS[0], readThemeJson<{ look: string }>('theme.json').look]).toEqual([DEFAULT_LOOK, DEFAULT_LOOK.id])
  })

  it('takes every preset, and refuses a look of another interface or with a value off its knob', () => {
    PRESETS.forEach((look) => expect(validateHudLook(look), look.id).toEqual({ ok: true, look }))
    expect(validateHudLook({ ...DEFAULT_LOOK, interface: 'play' }).ok).toBe(false)
    expect(validateHudLook({ ...DEFAULT_LOOK, glow: 41 }).ok).toBe(false)
    expect(validateHudLook({ ...DEFAULT_LOOK, scan: true }).ok).toBe(false)
  })
})

describe('boot/prepaint.json', () => {
  it('is the table the catalogue builds, value for value', () => {
    expect(prepaint).toEqual(hudPrepaintTable())
  })

  it('ends in one newline after two-space JSON, as the kit writes data files', () => {
    expect(readThemeFile('boot/prepaint.json')).toBe(`${JSON.stringify(prepaint, null, 2)}\n`)
  })

  it('paints every choice of every choice knob', () => {
    const choices: Readonly<Record<string, readonly string[]>> = {
      accent: ACCENT_KEYS, ground: GROUND_KEYS, font: FONT_KEYS, scan: SWITCH_CHOICES, auto: SWITCH_CHOICES, motion: SWITCH_CHOICES,
    }
    expect(Object.keys(prepaint.knobs).sort()).toEqual(Object.keys(choices).sort())
    Object.entries(choices).forEach(([knob, keys]) => expect(Object.keys(prepaint.knobs[knob]), knob).toEqual([...keys]))
  })

  it('has a cell for every ground with every accent', () => {
    const [pair] = prepaint.pairs
    expect([prepaint.pairs.length, pair.a, pair.b, Object.keys(pair.table)]).toEqual([1, 'ground', 'accent', [...GROUND_KEYS]])
    Object.values(pair.table).forEach((cells) => expect(Object.keys(cells)).toEqual([...ACCENT_KEYS]))
  })

  it('paints the grid and the glow from their numbers, the glow capped for AA on each pair', () => {
    expect(prepaint.numeric.map((rule) => [rule.var, rule.knob, rule.scale, rule.capTable])).toEqual([
      ['--hud-grid', 'grid', 300, null],
      ['--hud-glow', 'glow', 100, ['ground', 'accent']],
    ])
    const caps = prepaint.numeric[1].caps ?? {}
    GROUND_KEYS.forEach((ground) => ACCENT_KEYS.forEach((accent) => expect(caps[ground][accent]).toBe(safeGlowAlpha(ground, accent))))
  })

  it.each(PRESETS.map((look): [string, HudLook] => [look.id, look]))('paints %s as the code paints it (lookToCssVars)', (_id, look) => {
    expect(paintFromTable(look)).toEqual(lookToCssVars(look))
  })

  it("paints the default preset first, and makes every ground dark", () => {
    expect(prepaint.defaults).toEqual(picks(DEFAULT_LOOK))
    expect(prepaint.tone).toEqual({ knob: 'ground', values: Object.fromEntries(GROUND_KEYS.map((key) => [key, 'dark'])) })
  })

  it("names only --hud-* variables and Studio's tokens", () => {
    const names = new Set([
      ...Object.values(prepaint.knobs).flatMap((options) => Object.values(options).flatMap((vars) => Object.keys(vars))),
      ...prepaint.pairs.flatMap((pair) => Object.values(pair.table).flatMap((row) => Object.values(row).flatMap((vars) => Object.keys(vars)))),
    ])
    const studio = [...names].filter((name) => !name.startsWith('--hud-'))
    expect(studio.length).toBeGreaterThan(0)
    expect(studio.filter((name) => !STUDIO_TOKENS.includes(name))).toEqual([])
  })
})

/** Studio's colour tokens look-kit's studio-tokens.ts writes: the 24 triplets and the eight pre-wrapped aliases. */
const STUDIO_TOKENS: readonly string[] = [
  '--background', '--foreground', '--card', '--card-foreground', '--popover', '--popover-foreground',
  '--primary', '--primary-foreground', '--secondary', '--secondary-foreground', '--muted', '--muted-foreground',
  '--accent', '--accent-foreground', '--destructive', '--destructive-foreground', '--border', '--input', '--ring',
  '--background-gradient-from', '--background-gradient-to', '--glass-border-hover', '--cc-hover', '--cc-hover-border',
  '--paper', '--bg-1', '--bg-2', '--fg', '--fg-2', '--fg-3', '--border-2', '--accent-2',
]
