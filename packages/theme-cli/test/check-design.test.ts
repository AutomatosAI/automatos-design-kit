/**
 * `automatos-theme check design <theme folder>` (PRD-261 B-03d): the look schema and presets through
 * core's look validators and the prepaint table through core's prepaint checks, with core's codes
 * (core's corpus, case by case); every preset painted from its table and measured against every pair
 * of design/contrast.json, an error naming preset, text, ground and ratio under the pair's minimum;
 * Play passes with the pairs of its own contrast proof; pack never packs design/. The command also runs
 * under plain Node, as installed. The table as the host keeps it, and its first paint, are first-paint.test.ts's.
 *
 * The seeded theme is design-support.ts's: core's hello theme with a prepaint table and passing pairs.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { run, type CommandDeps } from '../src/cli-main.ts'
import { collectThemeFiles } from '../src/collect.ts'
import { contrastMeter, type ContrastMeter } from '../src/check/contrast.ts'
import {
  checkDesign, checkDesignFiles, DESIGN_CONTRAST_PATH, DESIGN_USAGE, type DesignResult, type DesignRow,
} from '../src/check/design.ts'
import { CHECK_USAGE } from '../src/check/index.ts'
import { CORE_SHA } from '../src/check/report.ts'
import { PREPAINT_ERROR_CODES, PREPAINT_PATH } from '../src/core/css-value.ts'
import { LOOK_ERROR_CODES } from '../src/core/look-schema.ts'
import { SCHEMA_PATH } from '../src/looks.ts'
import { packTheme } from '../src/pack.ts'
import { readZip } from '../src/zip.ts'
import { removeTempFolders, tempFolder } from './check-support.ts'
import { ACCENT_ON_BG, contrastFile, designFolder, entriesOf, PASSING, rowOf, TABLE, type Json } from './design-support.ts'

const PLAY = fileURLToPath(new URL('../../../themes/play/', import.meta.url))
const README = new URL('../src/core/README.md', import.meta.url)
const CORPUS = JSON.parse(readFileSync(new URL('./fixtures/core/cases.json', import.meta.url), 'utf8')) as Corpus
const DEFAULT_PRESET = 'looks/presets/default.look.json'
const NIGHT_PRESET = 'looks/presets/night.look.json'
/** Reading Play's built look files and painting its presets on a cold runner. */
const PLAY_TIMEOUT_MS = 60_000
const CLI = fileURLToPath(new URL('../src/cli.ts', import.meta.url))
/** Node starting the CLI from its TypeScript source on a cold runner. */
const NODE_TIMEOUT_MS = 60_000
/** What the test's resolve hook throws for a module under themes/play/. */
const NO_PLAY = 'refused by the test: a module under themes/play/'
/** The one module of Play's that `check` loads: look-kit's contrast.ts, for the mobile block's measure. */
const LOOK_KIT_CONTRAST = 'src/lib/look-kit/contrast.ts'
interface CorpusCase {
  readonly name: string
  readonly code: string | null
  readonly document?: unknown
  readonly set?: Json
  readonly unset?: readonly string[]
}
interface Corpus {
  readonly lookSchemas: { readonly cases: readonly CorpusCase[] }
  readonly looks: { readonly schema: unknown; readonly base: Json; readonly cases: readonly CorpusCase[] }
  readonly prepaint: { readonly cases: readonly CorpusCase[] }
}

/** A design/contrast.json that can't be read as pairs, and the one field each refusal is at. */
const BAD_FILES: Array<[string, unknown, string]> = [
  ['not an object', [], ''],
  ['another schema', { schema: 'x/v1', pairs: PASSING }, 'schema'],
  ['no pairs', contrastFile([]), 'pairs'],
  ['a field it does not have', { ...contrastFile(PASSING), note: 'x' }, 'note'],
  ['a pair that is not an object', contrastFile(['--hello-text']), 'pairs[0]'],
  ['a text that is not a custom property', contrastFile([{ text: 'red', ground: '--hello-bg' }]), 'pairs[0].text'],
  ['a min past 21', contrastFile([{ text: '--hello-text', ground: '--hello-bg', min: 22 }]), 'pairs[0].min'],
  ['a pair field it does not have', contrastFile([{ text: '--hello-text', ground: '--hello-bg', why: 'x' }]), 'pairs[0].why'],
  ['a pair twice', contrastFile([PASSING[0], PASSING[0]]), 'pairs[1]'],
]

interface Ran { readonly code: number; readonly out: readonly string[]; readonly err: readonly string[]; readonly sent: readonly unknown[] }

/** The command as the command table runs it, with a network that records anything sent. */
async function ranDesign(argv: readonly string[]): Promise<Ran> {
  const out: string[] = []
  const err: string[] = []
  const sent: unknown[] = []
  const deps: CommandDeps = {
    env: {},
    fetch: (async (...args: unknown[]) => {
      sent.push(args)
      throw new Error('check design sends nothing')
    }) as typeof fetch,
    cwd: process.cwd(),
  }
  const code = await run(argv, { out: (line) => out.push(line), err: (line) => err.push(line) }, deps)
  return { code, out, err, sent }
}

let meter: ContrastMeter

beforeAll(async () => {
  meter = await contrastMeter()
})

afterEach(removeTempFolders)

function codesOf(found: DesignRow, keep: (path: string, code: string) => boolean): string[] {
  return Array.from(new Set(found.errors.filter((error) => keep(error.path, error.code)).map((error) => error.code)))
}

function patched(base: Json, set: Json = {}, unset: readonly string[] = []): Json {
  return Object.fromEntries(Object.entries({ ...base, ...set }).filter(([key]) => !unset.includes(key)))
}

describe('the command', () => {
  it('names the core commit, gives the three lines, and exits 0 when every preset × pair reads', async () => {
    const ran = await ranDesign(['check', 'design', designFolder()])
    expect(ran.out[0]).toContain(`AutomatosAI/automatos-ai at ${CORE_SHA}`)
    expect(ran.out.slice(1, -1).map((line) => line.split(/\s+/).slice(0, 2).join(' '))).toEqual(['looks pass', 'prepaint pass', 'contrast pass'])
    expect(ran.out.at(-1)).toBe('verdict: pass (3 pass, 0 warning, 0 error, 0 not_measured)')
    expect([ran.code, ran.err, ran.sent]).toEqual([0, [], []])
  })

  it('is an error naming the preset, the text, the ground and the ratio for a pair under its minimum (exit 1)', async () => {
    const ran = await ranDesign(['check', 'design', designFolder({ [DESIGN_CONTRAST_PATH]: ACCENT_ON_BG })])
    expect(ran.code).toBe(1)
    expect(ran.out).toContain(
      `    CONTRAST_UNDER_MIN ${DESIGN_CONTRAST_PATH}#pairs[0]: Preset "night": --hello-accent on --hello-bg is 3.74:1, under its minimum of 4.5:1.`,
    )
    expect(ran.out.filter((line) => line.includes('Preset "default"'))).toEqual([])
    expect(ran.out.at(-1)).toMatch(/^verdict: blocked \(2 pass, 0 warning, 1 error, 0 not_measured\)$/)
  })

  it.each([[['check', 'design']], [['check', 'design', 'a', 'b']], [['check', 'design', '.', '--json']]])('%j: the usage, exit 2', async (argv) => {
    const ran = await ranDesign(argv)
    expect([ran.code, ran.err, ran.out]).toEqual([2, [DESIGN_USAGE], []])
  })

  it('a path that is not a folder: exit 2, nothing checked', async () => {
    const ran = await ranDesign(['check', 'design', join(tempFolder(), 'missing')])
    expect(ran.code).toBe(2)
    expect(ran.err[0]).toMatch(/is not a folder: check design takes a theme folder\.$/)
  })
})

describe("core's validators, with core's codes", () => {
  it.each([...CORPUS.lookSchemas.cases])('look schema: $name', (testCase) => {
    const found = rowOf(checkDesignFiles(entriesOf({ [SCHEMA_PATH]: testCase.document }), meter), 'looks')
    expect(codesOf(found, (path) => path.startsWith(SCHEMA_PATH))).toEqual(testCase.code === null ? [] : [testCase.code])
  })

  it.each([...CORPUS.looks.cases])('preset: $name', (testCase) => {
    const preset = 'document' in testCase ? testCase.document : patched(CORPUS.looks.base, testCase.set, testCase.unset)
    const found = rowOf(checkDesignFiles(entriesOf({ [SCHEMA_PATH]: CORPUS.looks.schema, [DEFAULT_PRESET]: preset }), meter), 'looks')
    const coreCodes = codesOf(found, (path, code) => path.startsWith(DEFAULT_PRESET) && LOOK_ERROR_CODES.includes(code))
    expect(coreCodes).toEqual(testCase.code === null ? [] : [testCase.code])
  })

  it.each([...CORPUS.prepaint.cases])('prepaint table: $name', (testCase) => {
    const found = rowOf(checkDesignFiles(entriesOf({ [PREPAINT_PATH]: testCase.document }), meter), 'prepaint')
    expect(codesOf(found, (_path, code) => PREPAINT_ERROR_CODES.includes(code))).toEqual(testCase.code === null ? [] : [testCase.code])
    if (testCase.code !== null) expect(found.level).toBe('error')
  })
})

describe('the AA matrix: every preset × every pair', () => {
  it('reads hex, Studio triplets and hsl()-wrapped triplets as the browser draws them, and pair-table variables', () => {
    const { measures, rows } = checkDesignFiles(entriesOf(), meter)
    const ratio = (preset: string, index: number) => measures.find((item) => item.preset === preset && item.index === index)?.measure.ratio
    expect(rows.map((item) => item.level)).toEqual(['pass', 'pass', 'pass'])
    expect(measures).toHaveLength(PASSING.length * 2)
    expect(ratio('default', 1)).toBeCloseTo(ratio('default', 0) ?? 0, 10)
    expect(ratio('default', 2)).toBeCloseTo(ratio('default', 1) ?? 0, 10)
    expect(ratio('default', 1)).toBeCloseTo(16.48, 2)
    expect(ratio('night', 3)).toBeCloseTo(5.51, 2)
    expect(ratio('night', 4)).toBeCloseTo(3.74, 2)
  })

  it('takes a pair under the default 4.5 as an error, and the same colours at their own min of 3 as a pass', () => {
    const under = checkDesignFiles(entriesOf({ [DESIGN_CONTRAST_PATH]: ACCENT_ON_BG }), meter)
    const found = rowOf(under, 'contrast').errors.map((error) => [error.code, error.path])
    expect(found).toEqual([['CONTRAST_UNDER_MIN', `${DESIGN_CONTRAST_PATH}#pairs[0]`]])
    const atThreeFile = contrastFile([{ text: '--hello-accent', ground: '--hello-bg', min: 3 }])
    const atThree = checkDesignFiles(entriesOf({ [DESIGN_CONTRAST_PATH]: atThreeFile }), meter)
    expect(rowOf(atThree, 'contrast')).toMatchObject({ level: 'pass', errors: [] })
  })

  it("is an error when a pair can't be measured: a variable not painted, or an rgba() value", () => {
    const pairs = contrastFile([{ text: '--hello-missing', ground: '--hello-bg' }, { text: '--hello-glow', ground: '--hello-bg' }])
    const found = rowOf(checkDesignFiles(entriesOf({ [DESIGN_CONTRAST_PATH]: pairs }), meter), 'contrast')
    const messages = found.errors.map((error) => `${error.code} ${error.message}`)
    expect(found.level).toBe('error')
    expect(messages).toContain(
      'CONTRAST_NOT_MEASURED Preset "default": --hello-missing on --hello-bg can\'t be measured: --hello-missing is not painted.',
    )
    expect(messages).toContain(
      'CONTRAST_NOT_MEASURED Preset "default": --hello-glow on --hello-bg can\'t be measured: '
      + '--hello-glow is "rgba(29,78,216,0.06)", not #rrggbb or an "H S% L%" triplet.',
    )
  })

  it("names a preset the table can't paint, and measures the rest", () => {
    const table = { ...TABLE, knobs: { ...TABLE.knobs, accent: { blue: { '--hello-accent': '#1D4ED8' } } } }
    const result = checkDesignFiles(entriesOf({ [PREPAINT_PATH]: table }), meter)
    expect(rowOf(result, 'prepaint').errors.map((error) => [error.code, error.path])).toEqual([['PRESET_NOT_IN_PREPAINT', NIGHT_PRESET]])
    expect(rowOf(result, 'contrast').errors.map((error) => [error.code, error.path])).toEqual([['CONTRAST_NOT_MEASURED', NIGHT_PRESET]])
    expect(new Set(result.measures.map((item) => item.preset))).toEqual(new Set(['default']))
  })

  it("measures nothing when the table's defaults don't fit it, as the host then paints nothing from it", () => {
    const result = checkDesignFiles(entriesOf({ [PREPAINT_PATH]: { ...TABLE, defaults: { ground: 'paper', accent: 'red', radius: 6 } } }), meter)
    expect(rowOf(result, 'prepaint').errors.map((error) => error.code)).toEqual(['PREPAINT_DEFAULTS_UNFIT'])
    expect(rowOf(result, 'contrast').errors.map((error) => [error.code, error.path])).toEqual([['CONTRAST_NOT_MEASURED', PREPAINT_PATH]])
    expect(result.measures).toEqual([])
  })

  it('is not measured with no design/contrast.json; with pairs but no prepaint table it is an error', () => {
    const noPairs = checkDesignFiles(entriesOf({ [DESIGN_CONTRAST_PATH]: null }), meter)
    expect(noPairs.rows.map((item) => item.level)).toEqual(['pass', 'pass', 'not_measured'])
    const noTable = checkDesignFiles(entriesOf({ [PREPAINT_PATH]: null }), meter)
    expect(noTable.rows.map((item) => item.level)).toEqual(['pass', 'not_measured', 'error'])
  })

  it.each(BAD_FILES)('design/contrast.json with %s is refused at its field', (_name, file, where) => {
    const found = rowOf(checkDesignFiles(entriesOf({ [DESIGN_CONTRAST_PATH]: file }), meter), 'contrast')
    expect(found.level).toBe('error')
    expect(found.errors.map((error) => [error.code, error.path])).toEqual([['BAD_CONTRAST_PAIRS', `${DESIGN_CONTRAST_PATH}#${where}`]])
  })

  it('refuses a design/contrast.json that is a link, as a package refuses links', async () => {
    const theme = designFolder({ [DESIGN_CONTRAST_PATH]: null })
    mkdirSync(dirname(join(theme, DESIGN_CONTRAST_PATH)), { recursive: true })
    const target = join(tempFolder(), 'pairs.json')
    writeFileSync(target, JSON.stringify(contrastFile(PASSING)))
    symlinkSync(target, join(theme, DESIGN_CONTRAST_PATH))
    const found = rowOf(await checkDesign(theme), 'contrast')
    expect(found.errors.map((error) => error.code)).toEqual(['SYMLINK'])
  })

  it.each([['looks', 'looks'], ['boot', 'prepaint'], ['design', 'contrast']] as const)(
    'refuses a linked %s/ folder on its %s line and reads nothing through it, as pack refuses a linked folder',
    async (folder, line) => {
      const theme = designFolder()
      const target = join(tempFolder(), folder)
      renameSync(join(theme, folder), target)
      symlinkSync(target, join(theme, folder))
      const found = rowOf(await checkDesign(theme), line)
      expect(found.level).toBe('error')
      expect(found.errors.filter((error) => error.code === 'SYMLINK').map((error) => error.path)).toEqual([folder])
    },
  )

  it.each([['looks', 'looks'], ['looks/presets', 'looks'], ['boot', 'prepaint'], ['design', 'contrast']] as const)(
    'a file where the %s/ folder goes: NOT_A_FOLDER on its %s line, nothing read in it, exit 1 (no ENOTDIR)',
    async (folder, line) => {
      const theme = designFolder()
      rmSync(join(theme, folder), { recursive: true })
      writeFileSync(join(theme, folder), '{}\n')
      const found = rowOf(await checkDesign(theme), line)
      expect(found.level).toBe('error')
      expect(found.errors.filter((error) => error.code === 'NOT_A_FOLDER').map((error) => error.path)).toEqual([folder])
      const ran = await ranDesign(['check', 'design', theme])
      expect([ran.code, ran.err]).toEqual([1, []])
      expect(ran.out.filter((text) => text.startsWith(`    NOT_A_FOLDER ${folder}: ${folder} is a file, not a folder`))).toHaveLength(1)
    },
  )

  it('names a repeated pair, and the pair it repeats, by their places in the file', () => {
    const file = contrastFile([{ text: 'red', ground: '--hello-bg' }, PASSING[0], PASSING[0]])
    const found = rowOf(checkDesignFiles(entriesOf({ [DESIGN_CONTRAST_PATH]: file }), meter), 'contrast')
    expect(found.errors.map((error) => error.path)).toEqual([`${DESIGN_CONTRAST_PATH}#pairs[0].text`, `${DESIGN_CONTRAST_PATH}#pairs[2]`])
    expect(found.errors[1]?.message).toBe('pairs[2] repeats pairs[1]: --hello-text on --hello-bg.')
  })
})

describe('Play', () => {
  let play: DesignResult
  let ran: Ran

  beforeAll(async () => {
    if (!existsSync(join(PLAY, SCHEMA_PATH)) || !existsSync(join(PLAY, PREPAINT_PATH))) {
      throw new Error(`themes/play has no ${SCHEMA_PATH} or ${PREPAINT_PATH}: kit.yml's Build step (npm run build) writes them before the tests.`)
    }
    play = await checkDesign(PLAY)
    ran = await ranDesign(['check', 'design', PLAY])
  }, PLAY_TIMEOUT_MS)

  it('passes: every line, and every pair on every preset, exit 0', () => {
    const lines = play.rows.map((item) => [item.name, item.level, item.errors])
    expect(lines).toEqual([['looks', 'pass', []], ['prepaint', 'pass', []], ['contrast', 'pass', []]])
    expect(play.measures.filter((item) => item.measure.status !== 'pass')).toEqual([])
    expect(ran.code).toBe(0)
  })

  it("declares the pairs of its own contrast proof, measured on each of its 5 presets", () => {
    type Declared = { readonly pairs: ReadonlyArray<{ text: string; ground: string; min?: number }> }
    const declared = JSON.parse(readFileSync(join(PLAY, DESIGN_CONTRAST_PATH), 'utf8')) as Declared
    // themes/play/test/lib/looks/contrast.test.ts: 11 pairs of Play's own variables, Studio's 21 TEXT_PAIRS, and --ring at 3:1.
    expect(declared.pairs.filter((pair) => pair.text.startsWith('--pl-'))).toHaveLength(11)
    expect(declared.pairs).toHaveLength(33)
    expect(declared.pairs.filter((pair) => pair.min !== undefined)).toEqual([{ text: '--ring', ground: '--background', min: 3 }])
    expect(new Set(play.measures.map((item) => item.preset)).size).toBe(5)
    expect(play.measures).toHaveLength(33 * 5)
  })
})

describe('pack never packs design/', () => {
  it('packs a theme with design/ exactly as it packs the same theme without it', () => {
    const plain = designFolder({ [DESIGN_CONTRAST_PATH]: null })
    const designed = designFolder()
    writeFileSync(join(designed, 'design', 'notes.md'), '# Design notes\n')
    const packed = [packTheme(plain, tempFolder()), packTheme(designed, tempFolder())]
    const [without, withDesign] = packed.map((result) => {
      if (!result.ok) throw new Error(result.errors.map((error) => error.message).join('\n'))
      return result
    })
    expect(existsSync(join(designed, DESIGN_CONTRAST_PATH))).toBe(true)
    expect(readZip(readFileSync(withDesign.file)).map((entry) => entry.path).filter((path) => path.startsWith('design/'))).toEqual([])
    expect(withDesign.manifest.digest).toBe(without.manifest.digest)
  })

  it("leaves Play's design/contrast.json out of Play's package files", () => {
    expect(existsSync(join(PLAY, DESIGN_CONTRAST_PATH))).toBe(true)
    expect(collectThemeFiles(PLAY).map((entry) => entry.path).filter((path) => path.startsWith('design/'))).toEqual([])
  })

  it('src/core/README.md says design/contrast.json is kit-only and what the server measures instead', () => {
    const readme = readFileSync(README, 'utf8')
    expect(readme).toContain('`design/contrast.json` is kit-only')
    expect(readme).toMatch(/`pack` never packs `design\/`/)
    expect(readme).toMatch(/the server measures only the `mobile` block's ten\s+Studio pairs \(PRD-261 M-03\)/)
    expect(readme).toMatch(/declared pairs for every look stay kit-only for v1 \(PRD-261 QB-40\)/)
  })
})

/** A Node --import module whose resolve hook refuses every module under `playUrl` but `allowed`. */
function noPlayHook(playUrl: string, allowed: string): string {
  return [
    "import { registerHooks } from 'node:module'",
    `const PLAY = ${JSON.stringify(playUrl)}`,
    `const ALLOWED = ${JSON.stringify(allowed)}`,
    'registerHooks({ resolve(specifier, context, nextResolve) {',
    '  const resolved = nextResolve(specifier, context)',
    `  if (resolved.url.startsWith(PLAY) && resolved.url !== ALLOWED) throw new Error(${JSON.stringify(NO_PLAY)} + ' ' + resolved.url)`,
    '  return resolved',
    '} })',
    '',
  ].join('\n')
}

/** The CLI's own process: Node on `args`, as the installed executable runs. */
function runNode(args: readonly string[]): { readonly status: number | null; readonly stdout: string; readonly stderr: string } {
  return spawnSync(process.execPath, [...args], { encoding: 'utf8' })
}

describe('under plain Node, as the automatos-theme executable runs', () => {
  it("check design loads Play's look-kit through its resolve hook: exit 0 with three pass lines, exit 1 under a minimum", () => {
    const passed = runNode([CLI, 'check', 'design', designFolder()])
    expect(passed.status, passed.stderr).toBe(0)
    const lines = passed.stdout.split('\n').slice(1, 4).map((line) => line.split(/\s+/).slice(0, 2).join(' '))
    expect(lines).toEqual(['looks pass', 'prepaint pass', 'contrast pass'])
    const failed = runNode([CLI, 'check', 'design', designFolder({ [DESIGN_CONTRAST_PATH]: ACCENT_ON_BG })])
    expect(failed.status, failed.stderr).toBe(1)
    expect(failed.stdout).toContain(`    CONTRAST_UNDER_MIN ${DESIGN_CONTRAST_PATH}#pairs[0]: Preset "night": --hello-accent on --hello-bg`)
  }, NODE_TIMEOUT_MS)

  it("check loads no Play module but look-kit's contrast.ts; only check design loads the rest of look-kit (hsl.ts)", () => {
    const hook = join(tempFolder(), 'no-play.mjs')
    const play = `${pathToFileURL(realpathSync(PLAY)).href}/`
    writeFileSync(hook, noPlayHook(play, `${play}${LOOK_KIT_CONTRAST}`))
    const check = runNode(['--import', pathToFileURL(hook).href, CLI, 'check'])
    expect(check.stderr).not.toContain(NO_PLAY)
    expect([check.status, check.stderr.includes(CHECK_USAGE)]).toEqual([2, true])
    const design = runNode(['--import', pathToFileURL(hook).href, CLI, 'check', 'design', designFolder()])
    expect(design.status).not.toBe(0)
    expect(design.stderr).toContain(NO_PLAY)
  }, NODE_TIMEOUT_MS)
})
