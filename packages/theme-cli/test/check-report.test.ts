/**
 * The report `check` builds is core's review stage report (review_stage.py, scan.py at the commit
 * src/core/README.md names): its schema, stage, levels, verdict and counts, the reader's checks with
 * what they measured, contrast unmeasured per preset without a `mobile` block and measured with one
 * (M-03's cases of core's test_prd261_review_stage.py), and llm left to the server. The vendored data
 * files and the commit the report names are held to that README.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { sha256Hex } from '../src/digest.ts'
import { CAPS } from '../src/files.ts'
import { CORE_PAGES_FILE } from '../src/check/drift.ts'
import type { Reviewed } from '../src/check/index.ts'
import {
  CONTRAST_NOT_RUN, CORE_SHA, LLM_SERVER_ONLY, REPORT_SCHEMA, STAGE, verdictOf, type CheckEntry, type Level,
} from '../src/check/report.ts'
import { SDK_SURFACE_FILE } from '../src/check/uses.ts'
import { helloPackage, reviewHello, type HelloChange } from './check-support.ts'

const README = new URL('../src/core/README.md', import.meta.url)
const SOURCE_LINE = /^Source: `AutomatosAI\/automatos-ai` at `([0-9a-f]{40})`/m
const DATA_ROW = /^\| `data\/([a-z-]+\.json)` \| `[^`]+` \| `([0-9a-f]{64})` \|$/gm
const CLEAN_LEVELS: Readonly<Record<string, Level>> = {
  sizes: 'pass', cssScope: 'pass', looks: 'pass', uses: 'pass', audioCapture: 'pass', clonedFrom: 'pass', previews: 'pass',
  jsRules: 'not_measured', contrast: 'not_measured', llm: 'not_measured',
}

function levels(checks: Readonly<Record<string, CheckEntry>>): Record<string, string> {
  return Object.fromEntries(Object.entries(checks).map(([name, check]) => [name, check.level]))
}

describe('the report and the verdict', () => {
  it('a clean package passes, with every check reported in order', async () => {
    const { report } = await reviewHello()
    expect([report.schema, report.stage, report.verdict]).toEqual([REPORT_SCHEMA, STAGE, 'pass'])
    expect(levels(report.checks)).toEqual(CLEAN_LEVELS)
    expect(Object.keys(report.checks)).toEqual(Object.keys(CLEAN_LEVELS))
    expect(report.summary).toEqual({ pass: 7, warning: 0, error: 0, not_measured: 3 })
    expect(report.checks.uses.usedAreas).toEqual(['theme'])
  })

  it('the verdict is blocked on an error, review_required on a warning, and not_measured never moves it', () => {
    const at = (...found: Level[]): Readonly<Record<string, CheckEntry>> => (
      Object.fromEntries(found.map((level, index) => [`c${index}`, { level }]))
    )
    expect(verdictOf(at('pass', 'error', 'warning'))).toBe('blocked')
    expect(verdictOf(at('pass', 'warning'))).toBe('review_required')
    expect(verdictOf(at('pass', 'not_measured'))).toBe('pass')
  })

  it('contrast is listed per preset as not measured, as core writes it at this commit', async () => {
    const contrast = (await reviewHello()).report.checks.contrast
    expect(contrast).toMatchObject({ level: 'not_measured', status: 'not_run', reason: CONTRAST_NOT_RUN })
    expect(contrast.presets).toEqual([{ id: 'default', status: 'not_run' }, { id: 'night', status: 'not_run' }])
  })

  it("llm is always the server's: not measured here", async () => {
    const { report, texts } = await reviewHello()
    expect(report.checks.llm).toEqual({ level: 'not_measured', status: 'server_only', reason: LLM_SERVER_ONLY })
    expect(texts.llm.text).toBe('server only: the Marketplace runs it')
  })
})

// M-03 (PB-35): a theme with a mobile block has its ten colour pairs measured (check-mobile-contrast.test.ts holds
// the measuring itself), for the table's defaults and then each preset. hello's two presets painted for the
// phone: default (paper, blue) reads, night (ink, green) puts white text on a green at 3.41:1.
const MOBILE_ENGINES = { automatos: '^1.1.0', sdk: '^1.0.0' }
const WHITE = '0 0% 100%'
const INK_TEXT = '#14181c'
// The table paints Studio tokens as triplets only (the web reads them as hsl(var(--x))): #14181c and #2e9e5b.
const INK_TRIPLET = '210 16.67% 9.41%'
const GREEN = '144.11 54.9% 40%'
const PREPAINT = 'boot/prepaint.json'
const DEFAULTS = `${PREPAINT}#defaults`
const LOOK_TABLE = {
  knobs: {
    ground: {
      paper: { '--background': WHITE, '--foreground': INK_TRIPLET },
      ink: { '--background': '220 13% 9%', '--foreground': '210 20% 96%' },
    },
    accent: {
      blue: { '--primary': '221.21 83.19% 53.33%', '--primary-foreground': WHITE },
      green: { '--primary': GREEN, '--primary-foreground': WHITE },
    },
  },
  // radius is painted by a numeric rule, as the reader needs every look knob painted (first-paint.ts; core's
  // test_prd261_review_stage.py LOOK_TABLE, build.py HELLO_RADIUS_RULE).
  numeric: [{
    var: '--hello-glow', knob: 'radius', min: 0, max: 16, integer: true, scale: 100, capTable: null, template: 'rgba-alpha',
    color: { knob: 'accent', rgb: { blue: '47,111,237', green: '30,127,60' } },
  }],
  defaults: { accent: 'blue', ground: 'paper', radius: 6 },
}

/** The review of hello with a `mobile` block (and any files added), its engines at the block's lowest host. */
function reviewMobile(mobile: Readonly<Record<string, unknown>>, replace: HelloChange['replace'] = {}): Promise<Reviewed> {
  return reviewHello({ manifest: { engines: MOBILE_ENGINES, mobile }, replace })
}

/** Each measured subject's id and status, in the report's order. */
function statuses(subjects: unknown): Array<[string, string]> {
  return (subjects as ReadonlyArray<{ id: string; status: string }>).map(({ id, status }) => [id, status])
}

describe("core's M-03 cases: a mobile block's colour pairs measured", () => {
  it('a mobile pair under AA makes contrast an error naming it, and blocks', async () => {
    const { report } = await reviewMobile({ tokens: { light: { '--background': WHITE, '--foreground': '0 0% 58%' } } })
    const contrast = report.checks.contrast
    expect([report.verdict, contrast.level, contrast.status]).toEqual(['blocked', 'error', 'fail'])
    expect(contrast.problems).toEqual([
      'mobile.tokens.light: --foreground on --background is 3.03:1, under the AA minimum of 4.5:1 for text.',
    ])
    // core's llm passes on its fake model; here llm is the server's, not measured.
    expect(report.summary).toEqual({ pass: 7, warning: 0, error: 1, not_measured: 2 })
  })

  it('a mobile block whose measured pairs meet AA passes contrast', async () => {
    const { report } = await reviewMobile({ tokens: { light: { '--background': WHITE, '--foreground': INK_TEXT, '--ring': '0 0% 56.5%' } } })
    const contrast = report.checks.contrast
    expect([report.verdict, contrast.level, contrast.source]).toEqual(['pass', 'pass', 'tokens'])
    expect(statuses(contrast.schemes).map(([id]) => id)).toEqual(['light'])
    expect(contrast).not.toHaveProperty('presets')
    expect(report.summary).toEqual({ pass: 8, warning: 0, error: 0, not_measured: 2 })
  })

  it('fromLooks: a preset under AA blocks and is named', async () => {
    const { report } = await reviewMobile({ fromLooks: true }, { [PREPAINT]: JSON.stringify(LOOK_TABLE) })
    const contrast = report.checks.contrast
    expect([report.verdict, contrast.level, contrast.source]).toEqual(['blocked', 'error', 'fromLooks'])
    expect(statuses(contrast.presets)).toEqual([[DEFAULTS, 'pass'], ['default', 'pass'], ['night', 'fail']])
    expect(contrast.problems).toEqual([
      'Preset "night": --primary-foreground on --primary is 3.41:1, under the AA minimum of 4.5:1 for text.',
    ])
  })

  it("fromLooks: the table's defaults under AA block while every preset passes", async () => {
    // The answer serves the table's defaults to every member with no stored look, so the review measures them too.
    const table = { ...LOOK_TABLE, defaults: { accent: 'green', ground: 'paper', radius: 6 } }
    const night = { schema: 'automatos-e2e-hello-look/v1', id: 'night', name: 'Night', sub: '', accent: 'blue', ground: 'ink', radius: 0 }
    const { report } = await reviewMobile({ fromLooks: true }, {
      [PREPAINT]: JSON.stringify(table),
      'looks/presets/night.look.json': JSON.stringify(night),
    })
    const contrast = report.checks.contrast
    expect([report.verdict, contrast.level]).toEqual(['blocked', 'error'])
    expect(statuses(contrast.presets)).toEqual([[DEFAULTS, 'fail'], ['default', 'pass'], ['night', 'pass']])
    expect(contrast.problems).toEqual([
      `${DEFAULTS}: --primary-foreground on --primary is 3.41:1, under the AA minimum of 4.5:1 for text.`,
    ])
  })
})

describe("the reader's checks pass with what they measured", () => {
  it('sizes: the package, JS plus CSS, the entry and the largest clip, against the caps in force', async () => {
    const files = helloPackage()
    const { report } = await reviewHello()
    const code = (files.get('dist/entry.js')?.length ?? 0) + (files.get('dist/theme.css')?.length ?? 0)
    expect(report.checks.sizes).toMatchObject({
      level: 'pass', status: 'pass', codeBytes: code, entryBytes: files.get('dist/entry.js')?.length, largestClipBytes: 0,
      limits: { package: CAPS.package, code: CAPS.code, entry: CAPS.entry, clip: CAPS.clip },
    })
    expect(report.checks.sizes.packageBytes).toBeGreaterThan(0)
  })

  it('cssScope is absent when the package ships no style sheet, and looks lists the presets', async () => {
    const { report } = await reviewHello({ replace: { 'dist/theme.css': null } })
    expect(report.checks.cssScope).toEqual({ status: 'absent', path: 'dist/theme.css', level: 'pass' })
    expect(report.checks.looks).toEqual({ status: 'pass', presets: ['default', 'night'], level: 'pass' })
  })
})

describe('the vendored data and the commit, held to src/core/README.md', () => {
  const readme = readFileSync(README, 'utf8')

  it('the report names the commit the README names', () => {
    expect(SOURCE_LINE.exec(readme)?.[1]).toBe(CORE_SHA)
  })

  it('each data file has the sha256 its README row names', () => {
    const rows = Object.fromEntries(Array.from(readme.matchAll(DATA_ROW), (match) => [match[1], match[2]]))
    expect(rows).toEqual({
      'core-pages.json': sha256Hex(readFileSync(CORE_PAGES_FILE)),
      'sdk-surface.json': sha256Hex(readFileSync(SDK_SURFACE_FILE)),
    })
  })
})
