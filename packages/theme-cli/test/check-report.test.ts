/**
 * The report `check` builds is core's review stage report (review_stage.py, scan.py at the commit
 * src/core/README.md names): its schema, stage, levels, verdict and counts, the reader's checks with
 * what they measured, contrast unmeasured per preset, and llm left to the server. The vendored data
 * files and the commit the report names are held to that README.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { sha256Hex } from '../src/digest.ts'
import { CAPS } from '../src/files.ts'
import { CORE_PAGES_FILE } from '../src/check/drift.ts'
import {
  CONTRAST_NOT_RUN, CORE_SHA, LLM_SERVER_ONLY, REPORT_SCHEMA, STAGE, verdictOf, type CheckEntry, type Level,
} from '../src/check/report.ts'
import { SDK_SURFACE_FILE } from '../src/check/uses.ts'
import { helloPackage, reviewHello } from './check-support.ts'

const README = new URL('../src/core/README.md', import.meta.url)
const SOURCE_LINE = /^Source: `AutomatosAI\/automatos-ai` at `([0-9a-f]{40})`/m
const DATA_ROW = /^\| `data\/([a-z-]+\.json)` \| `[^`]+` \| `([0-9a-f]{64})` \|$/gm
const CLEAN_LEVELS: Readonly<Record<string, Level>> = {
  sizes: 'pass', cssScope: 'pass', looks: 'pass', uses: 'pass', clonedFrom: 'pass', previews: 'pass',
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
    expect(report.summary).toEqual({ pass: 6, warning: 0, error: 0, not_measured: 3 })
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

  // At this commit the theme format has no `mobile` block, so the reader refuses one and contrast is
  // not measured for every package it accepts. The core commit that adds the block (PRD-261 M-01..M-03)
  // also measures its colour pairs; re-vendoring to it fails this test until check measures them too.
  it('a mobile block is refused by the reader at this commit, so no package reaches a contrast measure', async () => {
    await expect(reviewHello({ manifest: { mobile: { fromLooks: true, mascot: 'clips' } } })).rejects.toThrow('UNKNOWN_FIELD')
  })

  it("llm is always the server's: not measured here", async () => {
    const { report, texts } = await reviewHello()
    expect(report.checks.llm).toEqual({ level: 'not_measured', status: 'server_only', reason: LLM_SERVER_ONLY })
    expect(texts.llm.text).toBe('server only: the Marketplace runs it')
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
