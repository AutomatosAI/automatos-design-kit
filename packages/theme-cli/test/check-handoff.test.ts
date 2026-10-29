/**
 * `automatos-theme check handoff <design folder>` (guides/designing-a-theme.md, "The handoff"): a design's
 * looks.json (automatos-theme-handoff/v1) checked before any of the theme is built. Its shape (the theme's id, the
 * presets with a tone, knob values and the same #rrggbb colours, the default, the pairs, the phone block), its knobs
 * and presets through core's own look validators with core's codes, and every pair on every preset. Exit 0 with no
 * error, 1 with one, 2 for usage or a path that is no folder. The handoffs are made up.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { run, type CommandDeps } from '../src/cli-main.ts'
import { contrastMeter, type ContrastMeter } from '../src/check/contrast.ts'
import { checkHandoffText, HANDOFF_USAGE, type HandoffRow } from '../src/check/handoff.ts'
import { removeTempFolders, tempFolder } from './check-support.ts'

type Json = Record<string, unknown>

function handoff(change: (base: Json) => Json = (base) => base): Json {
  const base: Json = {
    schema: 'automatos-theme-handoff/v1',
    theme: 'acme/harbour',
    default: 'paper',
    knobs: {
      ground: { kind: 'choice', label: 'Ground', choices: ['paper', 'ink'], default: 'paper' },
      glow: { kind: 'number', label: 'Glow', min: 0, max: 10, integer: true, default: 4 },
    },
    presets: {
      paper: { name: 'Paper', sub: 'Blue on paper', tone: 'light', knobs: { ground: 'paper', glow: 4 },
        colours: { page: '#F4EFE6', text: '#1D1C1A', accent: '#2458C7' } },
      ink: { name: 'Ink', sub: 'Blue on ink', tone: 'dark', knobs: { ground: 'ink', glow: 6 },
        colours: { page: '#14181C', text: '#EEF0F2', accent: '#86AAF5' } },
    },
    pairs: [{ text: 'text', ground: 'page' }, { text: 'accent', ground: 'page', min: 3 }],
    phone: { colours: 'looks', fonts: { serif: 'Display', sans: 'Body' }, mascot: 'stills' },
  }
  return change(structuredClone(base))
}

let meter: ContrastMeter

beforeAll(async () => {
  meter = await contrastMeter()
})

afterEach(() => removeTempFolders())

const rows = (data: unknown): HandoffRow[] => checkHandoffText(JSON.stringify(data), meter)
const row = (data: unknown, name: HandoffRow['name']): HandoffRow | undefined => rows(data).find((item) => item.name === name)
const codes = (item: HandoffRow | undefined): string[] => (item?.errors ?? []).map((error) => error.code)

describe('a handoff the kit can build from', () => {
  it('passes every line', () => {
    expect(rows(handoff()).map((item) => [item.name, item.level])).toEqual([
      ['handoff', 'pass'], ['looks', 'pass'], ['contrast', 'pass'],
    ])
  })
})

describe('the shape', () => {
  it.each([
    ['another schema', (base: Json) => ({ ...base, schema: 'looks/v1' })],
    ['the reserved publisher', (base: Json) => ({ ...base, theme: 'automatos/harbour' })],
    ['a default no preset has', (base: Json) => ({ ...base, default: 'night' })],
    ['a field the handoff has no use for', (base: Json) => ({ ...base, tokens: [] })],
    ['a preset with no tone', (base: Json) => { delete (base.presets as Json & { paper: Json }).paper.tone; return base }],
    ['presets naming other colours', (base: Json) => { ((base.presets as Json & { ink: Json }).ink.colours as Json).glow = '#FFFFFF'; return base }],
    ['a colour that is not #rrggbb', (base: Json) => { ((base.presets as Json & { ink: Json }).ink.colours as Json).text = 'white'; return base }],
    ['one face for two phone roles', (base: Json) => ({ ...base, phone: { fonts: { serif: 'Body', sans: 'Body' } } })],
  ])('refuses %s', (_name, change) => {
    const item = row(handoff(change), 'handoff')
    expect(item?.level).toBe('error')
    expect(codes(item)).toContain('BAD_HANDOFF')
  })
})

describe("core's look validators", () => {
  it("refuses a knob kind the host doesn't take, with core's code", () => {
    const enumKnob = handoff((base) => ({ ...base, knobs: { ...(base.knobs as Json), ground: { type: 'enum', options: ['paper', 'ink'] } } }))
    const item = row(enumKnob, 'looks')
    expect(item?.level).toBe('error')
    expect(item?.errors[0]?.path).toMatch(/^looks\.json/)
  })

  it('refuses a preset whose knob value the knob refuses, naming the preset', () => {
    const item = row(handoff((base) => { (base.presets as Json & { ink: Json }).ink.knobs = { ground: 'sea', glow: 6 }; return base }), 'looks')
    expect(item?.level).toBe('error')
    expect(item?.errors.map((error) => error.path).join(' ')).toContain('looks.json#presets.ink')
  })
})

describe('the colour pairs', () => {
  it('names the preset, both colours and the ratio of a pair under its minimum', () => {
    const item = row(handoff((base) => { ((base.presets as Json & { paper: Json }).paper.colours as Json).text = '#B0B0B0'; return base }), 'contrast')
    expect(item?.level).toBe('error')
    expect(codes(item)).toEqual(['CONTRAST_UNDER_MIN'])
    expect(item?.errors[0]?.message).toMatch(/presets\.paper: text on page is \d+\.\d\d:1, under 4\.5:1\.$/)
  })

  it("can't measure a pair naming a colour the presets don't have", () => {
    expect(codes(row(handoff((base) => ({ ...base, pairs: [{ text: 'muted', ground: 'page' }] })), 'contrast'))).toContain('CONTRAST_NOT_MEASURED')
  })

  it('measures nothing without pairs', () => {
    expect(row(handoff((base) => ({ ...base, pairs: [] })), 'contrast')?.level).toBe('not_measured')
  })
})

describe('the command', () => {
  function folderWith(data: Json | null): string {
    const folder = tempFolder()
    mkdirSync(folder, { recursive: true })
    if (data !== null) writeFileSync(join(folder, 'looks.json'), JSON.stringify(data))
    return folder
  }

  async function ran(argv: readonly string[]) {
    const out: string[] = []
    const err: string[] = []
    const deps = { cwd: process.cwd() } as CommandDeps
    const code = await run(argv, { out: (line: string) => out.push(line), err: (line: string) => err.push(line) }, deps)
    return { code, out, err }
  }

  it('exits 0 on a handoff that passes, with the verdict last', async () => {
    const result = await ran(['check', 'handoff', folderWith(handoff())])
    expect(result.code).toBe(0)
    expect(result.out.at(-1)).toMatch(/^verdict: pass/)
  })

  it('exits 1 on a folder with no looks.json', async () => {
    expect((await ran(['check', 'handoff', folderWith(null)])).code).toBe(1)
  })

  it('exits 2 with the usage for no folder, and for a path that is no folder', async () => {
    expect(await ran(['check', 'handoff'])).toMatchObject({ code: 2, err: [HANDOFF_USAGE] })
    expect((await ran(['check', 'handoff', join(folderWith(null), 'nothing')])).code).toBe(2)
  })
})
