// @vitest-environment node
// The look editor's copy of the look data (src/looks/spec.ts) is the files' own: looks/schema.json's knobs, labels
// and choices in its order, with the default preset's values as the defaults; looks/presets/, one file per preset,
// each the preset; theme.json's look, the default; and boot/prepaint.json, an entry for every choice of every knob,
// a cell for every ground and accent, the default preset's choices as its defaults and a tone for every ground.
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { DEFAULT_LOOK, KNOBS, LOOK_SCHEMA, PRESETS, type ThemeLook } from '../src/looks/spec.ts'

interface SchemaFile {
  readonly look: { readonly schema: string }
  readonly knobs: Readonly<Record<string, { readonly kind: string; readonly label: string; readonly choices: string[]; readonly default: string }>>
}

interface PrepaintFile {
  readonly knobs: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  readonly pairs: ReadonlyArray<{ readonly a: string; readonly b: string; readonly table: Readonly<Record<string, Readonly<Record<string, unknown>>>> }>
  readonly defaults: Readonly<Record<string, unknown>>
  readonly tone: { readonly knob: string; readonly values: Readonly<Record<string, string>> }
}

// From the string import.meta.url: the harness runs this file under jsdom (its header names the environment only when
// vitest runs the file itself), where a `new URL(..., import.meta.url)` is no file URL fs can read.
const THEME_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')
const PRESETS_DIR = join(THEME_DIR, 'looks', 'presets')
const PRESET_SUFFIX = '.look.json'

const readJson = <T>(path: string): T => JSON.parse(readFileSync(join(THEME_DIR, path), 'utf8')) as T
const choicesOf = (name: string): string[] => KNOBS.find((knob) => knob.name === name)?.choices.map((choice) => choice.key) ?? []
const picks = (look: ThemeLook): Record<string, string> => Object.fromEntries(KNOBS.map((knob) => [knob.name, look[knob.name]]))

describe("the look editor's copy of the look data", () => {
  const schema = readJson<SchemaFile>('looks/schema.json')
  const prepaint = readJson<PrepaintFile>('boot/prepaint.json')

  it("names looks/schema.json's look schema", () => {
    expect(schema.look.schema).toBe(LOOK_SCHEMA)
  })

  it("has the schema's knobs, labels and choices in its order, the default preset's values as the defaults", () => {
    const fromFile = Object.entries(schema.knobs).map(([name, knob]) => ({ name, ...knob }))
    const fromCode = KNOBS.map((knob) => ({
      name: knob.name, kind: 'choice', label: knob.label, choices: choicesOf(knob.name), default: DEFAULT_LOOK[knob.name],
    }))
    expect(fromFile).toEqual(fromCode)
  })

  it('has one preset file per preset, each the preset, and the default first and in theme.json', () => {
    const files = readdirSync(PRESETS_DIR).filter((name) => name.endsWith(PRESET_SUFFIX)).sort()
    expect(files).toEqual(PRESETS.map((look) => `${look.id}${PRESET_SUFFIX}`).sort())
    PRESETS.forEach((look) => expect(readJson(`looks/presets/${look.id}${PRESET_SUFFIX}`)).toEqual(look))
    expect([PRESETS[0], readJson<{ look: string }>('theme.json').look]).toEqual([DEFAULT_LOOK, DEFAULT_LOOK.id])
  })

  it('paints every choice of every knob, every ground with every accent, from the default look', () => {
    expect(Object.keys(prepaint.knobs)).toEqual(KNOBS.map((knob) => knob.name))
    KNOBS.forEach((knob) => expect(Object.keys(prepaint.knobs[knob.name])).toEqual(choicesOf(knob.name)))
    const [pair] = prepaint.pairs
    expect([pair.a, pair.b, Object.keys(pair.table)]).toEqual(['ground', 'accent', choicesOf('ground')])
    Object.values(pair.table).forEach((cells) => expect(Object.keys(cells)).toEqual(choicesOf('accent')))
    expect(prepaint.defaults).toEqual(picks(DEFAULT_LOOK))
  })

  it('sets a tone for every ground', () => {
    expect(prepaint.tone.knob).toBe('ground')
    expect(Object.keys(prepaint.tone.values)).toEqual(choicesOf('ground'))
  })
})
