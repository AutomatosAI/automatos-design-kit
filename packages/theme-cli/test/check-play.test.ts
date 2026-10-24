/**
 * `check themes/play` reports no error: Play, as kit.yml's Build step built it, passes every check
 * the server's review makes, against the core commit the output names, its mobile block's AA contrast
 * included. Checked as an author runs it, on the built theme folder (pack's own packing, into a
 * temporary folder; nothing is written in it).
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { ENTRY_PATH } from '../src/check-package.ts'
import { CONTRAST_REASONS, DEFAULTS_ID, type ContrastSubject } from '../src/check/mobile-contrast.ts'
import type { PresetPreviews } from '../src/check/previews.ts'
import { CORE_SHA } from '../src/check/report.ts'
import { MOBILE_CONTRAST_PAIRS } from '../src/core/mobile-manifest.ts'
import { ranCheck, type Ran } from './check-support.ts'

const PLAY = fileURLToPath(new URL('../../../themes/play/', import.meta.url))
/** Packing Play twice (lines and JSON) on a cold runner. */
const CHECK_TIMEOUT_MS = 60_000
/** Play's presets (lib/looks/presets.ts) as the package holds them, in path order. */
const PLAY_PRESETS = ['aurora', 'daylight', 'ember', 'obsidian', 'workshop']
/** Play 1.1.0's hand-picked previews (C-06q2), as its theme.json lists them: its default look's chat first, the cover. */
const PLAY_COVER = 'assets/previews/ember.png'

interface PlayContrast {
  readonly level: string
  readonly source: string
  readonly status: string
  readonly reason: string
  readonly problems: readonly string[]
  readonly presets: readonly ContrastSubject[]
}

interface PlayPreviews {
  readonly level: string
  readonly cover: string | null
  readonly otherPreviews: readonly string[]
  readonly presets: readonly PresetPreviews[]
}

let lines: Ran
let json: Ran

beforeAll(async () => {
  if (!existsSync(join(PLAY, ENTRY_PATH))) {
    throw new Error(`themes/play has no ${ENTRY_PATH}: kit.yml's Build step (npm run build) runs before the tests.`)
  }
  lines = await ranCheck(['check', PLAY])
  json = await ranCheck(['check', PLAY, '--json'])
}, CHECK_TIMEOUT_MS)

describe('check themes/play', () => {
  it('reports no error and exits 0', () => {
    const errors = lines.out.filter((line) => /^\S+\s+error\s/.test(line))
    expect(errors).toEqual([])
    expect(lines.code).toBe(0)
    expect(lines.out.at(-1)).toMatch(/^verdict: (pass|review_required) \(\d+ pass, \d+ warning, 0 error, \d+ not_measured\)$/)
  })

  it('names the core commit it checked against', () => {
    expect(lines.out[0]).toContain(CORE_SHA)
  })

  // Play 1.1.0's block is `fromLooks`: the review paints boot/prepaint.json's defaults and each of the five
  // presets as the web paints them, and every one gives the phone all ten pairs at or over AA (Play's own
  // test/mobile.test.ts measures the same pairs with look-kit).
  it("measures Play's mobile block from its looks: the defaults and each preset, every pair measured and at AA", () => {
    const { contrast } = (JSON.parse(json.out.join('\n')) as { checks: { contrast: PlayContrast } }).checks
    expect([contrast.level, contrast.source, contrast.status, contrast.problems]).toEqual(['pass', 'fromLooks', 'pass', []])
    expect(contrast.reason).toBe(CONTRAST_REASONS.pass)
    expect(contrast.presets.map(({ id, kind, status }) => [id, kind, status])).toEqual([
      [DEFAULTS_ID, 'defaults', 'pass'],
      ...PLAY_PRESETS.map((id) => [id, 'preset', 'pass']),
    ])
    const pairs = contrast.presets.flatMap((subject) => subject.pairs)
    expect(pairs).toHaveLength((PLAY_PRESETS.length + 1) * MOBILE_CONTRAST_PAIRS.length)
    expect(pairs.filter((pair) => pair.status !== 'pass')).toEqual([])
  })

  it("reads Play's own source/ and bundle: its JS rules and SDK uses pass", () => {
    const report = JSON.parse(json.out.join('\n')) as { checks: Record<string, { level: string; unknownNames?: unknown }> }
    expect(report.checks.jsRules.level).toBe('pass')
    expect(report.checks.uses.unknownNames).toEqual([])
    expect(Object.values(report.checks).map((check) => check.level)).not.toContain('error')
    expect(json.code).toBe(0)
  })

  // Core's listing keeps theme.json's order (listings.py `_preview_paths` since 99fb70ff5): ember.png is Play's
  // cover though aurora.png sorts first, and ember's own previews come as listed, its chat before its screens.
  it("lists Play's previews in theme.json's order: every one under its preset, ember.png the cover", () => {
    const { previews } = (JSON.parse(json.out.join('\n')) as { checks: { previews: PlayPreviews } }).checks
    const listed = (JSON.parse(readFileSync(join(PLAY, 'theme.json'), 'utf8')) as { previews: string[] }).previews
    expect([previews.level, previews.cover, previews.otherPreviews]).toEqual(['pass', PLAY_COVER, []])
    expect(listed[0]).toBe(PLAY_COVER)
    expect(previews.presets.map((preset) => preset.id)).toEqual(PLAY_PRESETS)
    expect(previews.presets.flatMap((preset) => preset.previews.map((preview) => preview.path)).sort()).toEqual([...listed].sort())
    expect(previews.presets.find((preset) => preset.id === 'ember')?.previews).toEqual([
      { screen: null, path: PLAY_COVER },
      { screen: 'deliverables', path: 'assets/previews/ember-deliverables.png' },
      { screen: 'looks', path: 'assets/previews/ember-looks.png' },
    ])
  })
})
