/**
 * The `jsRules` check runs the review job's one rules table (`@automatos/theme-rules`) on source/:
 * an error-severity finding is an error (a theme that opens the microphone among them), warnings alone
 * are a warning listed for the reviewer, no finding passes, and a package with no source/ is not measured.
 */
import { describe, expect, it } from 'vitest'
import { WARNING_PREFIX } from '../src/cli-main.ts'
import { describeJs, jsRulesCheck, NO_SOURCE, type JsEntry } from '../src/check/js.ts'
import { LEVEL_WARNING } from '../src/check/report.ts'
import { reviewHello } from './check-support.ts'

const HONEST = "import { defineTheme } from '@automatos/theme-sdk'\nexport default defineTheme({ register() {}, unregister() {} })\n"
const CALLS_FETCH = "export async function load() {\n  return fetch('/api/agents')\n}\n"
const OPENS_CAMERA = 'export const open = () => navigator.mediaDevices.getUserMedia({ video: true })\n'

function source(text: string): Map<string, Uint8Array> {
  return new Map([['source/entry.ts', new TextEncoder().encode(text)]])
}

describe('the jsRules check', () => {
  it('passes honest source, counting its scripts', async () => {
    const { report } = await reviewHello({ replace: { 'source/entry.ts': HONEST } })
    expect(report.checks.jsRules).toMatchObject({ level: 'pass', status: 'checked', scripts: 1, findings: [] })
  })

  it('a refused pattern is an error naming the file and line', async () => {
    const { report, texts } = await reviewHello({ replace: { 'source/entry.ts': HONEST, 'source/load.ts': CALLS_FETCH } })
    expect(report.checks.jsRules.level).toBe('error')
    expect(report.verdict).toBe('blocked')
    expect(texts.jsRules.items).toEqual([expect.stringMatching(/^JS_FETCH source\/load\.ts:2 /)])
  })

  it('opening the microphone or camera is an error (theme voice), its item unmarked', () => {
    const entry = jsRulesCheck(source(OPENS_CAMERA))
    expect(entry).toMatchObject({ level: 'error', status: 'checked', scripts: 1 })
    expect(entry.findings.map((finding) => [finding.code, finding.severity])).toEqual([['JS_GET_USER_MEDIA', 'error']])
    expect(describeJs(entry).items).toEqual([expect.stringMatching(/^JS_GET_USER_MEDIA source\/entry\.ts:1 .*SDK's voice area/)])
  })

  it('a warning finding is marked so it is not read as a refusal (no row warns today)', () => {
    const entry = jsRulesCheck(source(OPENS_CAMERA))
    const warned: JsEntry = { ...entry, level: LEVEL_WARNING, findings: entry.findings.map((finding) => ({ ...finding, severity: 'warning' as const })) }
    expect(describeJs(warned).items).toEqual([expect.stringMatching(new RegExp(`^${WARNING_PREFIX}JS_GET_USER_MEDIA source/entry\\.ts:1 `))])
  })

  it('is not measured with no source/', async () => {
    const { report, texts } = await reviewHello()
    expect(report.checks.jsRules).toEqual({ level: 'not_measured', status: 'no_source', scripts: 0, findings: [], reason: NO_SOURCE })
    expect(texts.jsRules.text).toBe(NO_SOURCE)
  })
})
