// @vitest-environment node
// The test-move ledger (PRD-261): every test moved from core into Play's tests has a row in
// test/moved-from-core/<area>.json naming the core test (corePath, read at coreSha, where it had coreIts
// cases), the kit test that replaces it (kitPath, with kitIts cases), the core tests that now hold any of
// its assertions (rehomed), and why it was rewritten rather than ported (rewritten; null for a port). A
// case is an it() or test() call, it.each() counted once, as the count of core's file is made. This test
// holds the ledger to the files: a kit test that is missing, that no longer has the cases its row says or
// that skips or focuses one, or that has fewer cases than core's with the gap not listed in rehomed, fails
// it. Several rows name one kit test only where core's ledger moved several core tests into it
// (SHARED_KIT_TESTS): each row's kitIts counts the cases that replace its own core test's, and the rows'
// kitIts add up to the kit test's cases. CI checks out the kit alone, so coreIts is counted from core's git
// objects when the row is written.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { THEME_ROOT } from './source-files.ts'

interface Rehomed {
  readonly assertion: string
  readonly corePath: string
}

interface LedgerRow {
  readonly corePath: string
  readonly coreSha: string
  readonly coreIts: number
  readonly kitPath: string
  readonly kitIts: number
  readonly rehomed: readonly Rehomed[]
  readonly rewritten: string | null
}

/** A row and the ledger file it is in. */
interface Located {
  readonly file: string
  readonly row: LedgerRow
}

const LEDGER_DIR = join(THEME_ROOT, 'test', 'moved-from-core')
const ROW_FIELDS: readonly string[] = ['coreIts', 'corePath', 'coreSha', 'kitIts', 'kitPath', 'rehomed', 'rewritten']
const CASE_CALL = /\b(?:it|test)(?:\.each)?\(/g
const SKIPPED_OR_FOCUSED = /\b(?:it|test|describe)\.(?:skip|only|todo)\b/
const COMMIT_SHA = /^[0-9a-f]{40}$/
const CORE_TEST = /^frontend\/(?:[\w.-]+\/)*__tests__\/[\w.-]+\.test\.tsx?$/
const CORE_FILE = /^(?:frontend|orchestrator)\/[\w./-]+\.[a-z]+$/
const KIT_TEST = /^test\/(?:[\w-]+\/)*[\w.-]+\.test\.tsx?$/
/** The ledgers B-05p started, one per area of Play's tests. */
const FIRST_LEDGERS: readonly string[] = ['deliverables.json', 'lib.json', 'mascot.json']
/** Core's merge of the SDK and host 1.1.0, where B-05p read the tests it moved. */
const SDK_1_1_MERGE = '0dd8b846e41772c8dd7ef159e4373bcb9419b06a'
/** B-05p's moves, the tests of the files E3g ported, each true when E3g changed what it asserts (PB-10). */
const B05P_MOVES: Readonly<Record<string, boolean>> = Object.freeze({
  'test/mascot/pause.test.ts': true,
  'test/mascot/session.test.ts': true,
  'test/mascot/auto-mascot-pause.test.tsx': true,
  'test/lib/seen.test.ts': true,
  'test/lib/shelf.test.ts': false,
  'test/deliverables/play-shelf.test.tsx': true,
})
/**
 * The kit tests that hold several core tests' cases, each with the core tests it holds: core's ledger (PRD-261
 * A-19f2) names that one kit test for each of them, so their rows share it.
 */
const SHARED_KIT_TESTS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  'test/copied-from-core.test.ts': [
    'frontend/lib/__tests__/prd261-port-chat.test.ts',
    'frontend/lib/__tests__/prd261-port-conversations.test.ts',
    'frontend/lib/__tests__/prd261-port-deliverables.test.ts',
  ],
})

const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0
const matches = (value: unknown, pattern: RegExp): boolean => typeof value === 'string' && pattern.test(value)

function isRehomed(value: unknown): value is Rehomed {
  if (value === null || typeof value !== 'object') return false
  const { assertion, corePath } = value as Readonly<Record<string, unknown>>
  return isText(assertion) && matches(corePath, CORE_FILE)
}

/** True when `value` is a row of the ledger's shape, with no other field. */
function isRow(value: unknown): value is LedgerRow {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const row = value as Readonly<Record<string, unknown>>
  const fields = Object.keys(row).sort()
  return (
    fields.join() === ROW_FIELDS.join() &&
    matches(row.corePath, CORE_TEST) &&
    matches(row.coreSha, COMMIT_SHA) &&
    isCount(row.coreIts) &&
    matches(row.kitPath, KIT_TEST) &&
    isCount(row.kitIts) &&
    Array.isArray(row.rehomed) &&
    row.rehomed.every(isRehomed) &&
    (row.rewritten === null || isText(row.rewritten))
  )
}

/** The cases a test file declares: it(), test() and it.each(), as core's count is made. */
function countCases(code: string): number {
  return Array.from(code.matchAll(CASE_CALL)).length
}

function ledgerFiles(): string[] {
  return readdirSync(LEDGER_DIR)
    .filter((name) => name.endsWith('.json'))
    .sort()
}

function readLedger(file: string): unknown {
  return JSON.parse(readFileSync(join(LEDGER_DIR, file), 'utf8'))
}

/** Why a ledger file is not a list of rows (none when it is). */
function shapeProblems(file: string): string[] {
  const rows = readLedger(file)
  if (!Array.isArray(rows) || rows.length === 0) return [`${file} is not a list of rows`]
  return rows.flatMap((row, index) => (isRow(row) ? [] : [`${file} row ${index} is not a ledger row: ${JSON.stringify(row)}`]))
}

/** Every row of every ledger (the ones of the ledger's shape; shapeProblems names the rest). */
function ledgerRows(): Located[] {
  return ledgerFiles().flatMap((file) => {
    const rows = readLedger(file)
    return Array.isArray(rows) ? rows.filter(isRow).map((row) => ({ file, row })) : []
  })
}

/**
 * Why a row doesn't hold for its kit test (none when it does). `shared` is the cases the other rows naming the
 * same kit test count (SHARED_KIT_TESTS): the kit test has the cases of all its rows.
 */
function rowProblems({ file, row }: Located, shared = 0): string[] {
  const where = `${file} ${row.corePath}`
  const kitFile = join(THEME_ROOT, row.kitPath)
  if (!existsSync(kitFile)) return [`${where}: its kitPath ${row.kitPath} is missing`]
  const code = readFileSync(kitFile, 'utf8')
  const cases = countCases(code)
  const gap = row.coreIts - row.kitIts
  const counted = row.kitIts + shared
  const says = shared > 0 ? `its row says ${row.kitIts} and the rows sharing it ${shared}` : `its row says ${row.kitIts}`
  const problems: readonly (string | null)[] = [
    cases === counted ? null : `${where}: ${row.kitPath} has ${cases} cases, ${says}`,
    SKIPPED_OR_FOCUSED.test(code) ? `${where}: ${row.kitPath} skips or focuses a case` : null,
    gap > row.rehomed.length ? `${where}: ${gap} cases fewer than core's, ${row.rehomed.length} listed in rehomed` : null,
  ]
  return problems.filter((problem): problem is string => problem !== null)
}

function duplicates(values: readonly string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) !== index)
}

/** The cases the other rows naming the same kit test count. */
function sharedCases(rows: readonly Located[], { row }: Located): number {
  return rows
    .filter((other) => other.row !== row && other.row.kitPath === row.kitPath)
    .reduce((sum, other) => sum + other.row.kitIts, 0)
}

/** Each kit test whose rows aren't one, or aren't exactly the core tests SHARED_KIT_TESTS lists for it. */
function sharingProblems(rows: readonly Located[]): string[] {
  const kitPaths = Array.from(new Set(rows.map(({ row }) => row.kitPath)))
  return kitPaths.flatMap((kitPath) => {
    const named = rows.filter(({ row }) => row.kitPath === kitPath).map(({ row }) => row.corePath).sort()
    const listed = [...(SHARED_KIT_TESTS[kitPath] ?? [])].sort()
    if (named.length === 1 && listed.length === 0) return []
    if (named.join() === listed.join()) return []
    return [`${kitPath} is named by ${named.join(', ')}; SHARED_KIT_TESTS lists ${listed.join(', ') || 'none'}`]
  })
}

describe('the test-move ledger', () => {
  const rows = ledgerRows()

  it("has a list of rows of the ledger's shape in each area's file", () => {
    expect(ledgerFiles()).toEqual(expect.arrayContaining([...FIRST_LEDGERS]))
    expect(ledgerFiles().flatMap(shapeProblems)).toEqual([])
    expect(rows.length).toBeGreaterThanOrEqual(Object.keys(B05P_MOVES).length)
  })

  it('finds the kit test of every row, with the cases its row says and none skipped or focused', () => {
    expect(rows.flatMap((located) => rowProblems(located, sharedCases(rows, located)))).toEqual([])
  })

  it('names each core test in one row only, and each kit test in one row but the shared ones SHARED_KIT_TESTS lists', () => {
    expect(duplicates(rows.map(({ row }) => row.corePath))).toEqual([])
    expect(sharingProblems(rows)).toEqual([])
  })

  it("holds B-05p's moves at core's 1.1.0 merge, the tests E3g changed marked rewritten (PB-10)", () => {
    const moves = Object.entries(B05P_MOVES).map(([kitPath, changed]) => {
      const found = rows.find(({ row }) => row.kitPath === kitPath)?.row
      return { kitPath, coreSha: found?.coreSha, rewritten: found ? found.rewritten !== null : null, changed }
    })
    expect(moves.filter((move) => move.coreSha !== SDK_1_1_MERGE || move.rewritten !== move.changed)).toEqual([])
  })
})

describe("the ledger's own checks", () => {
  const pause = (): Located => {
    const found = ledgerRows().find(({ row }) => row.kitPath === 'test/mascot/pause.test.ts')
    if (!found) throw new Error('the pause row is missing from mascot.json')
    return found
  }

  it('counts it(), test() and it.each() once each, as core is counted, and nothing else', () => {
    const code = ["it('a', () => {})", "it.each([1])('b %s', () => {})", "test('c', () => {})", 'commit(); split(); describe("d")'].join('\n')
    expect(countCases(code)).toBe(3)
  })

  it('fails a row whose kit test is missing, whose count is not the file, or whose gap is not in rehomed', () => {
    const { file, row } = pause()
    expect(rowProblems({ file, row })).toEqual([])
    expect(rowProblems({ file, row: { ...row, kitPath: 'test/mascot/missing.test.ts' } })).toEqual([expect.stringContaining('is missing')])
    expect(rowProblems({ file, row: { ...row, kitIts: row.kitIts + 1 } })).toEqual([expect.stringContaining('its row says')])
    const unlisted = { ...row, coreIts: row.kitIts + 1, rehomed: [] }
    expect(rowProblems({ file, row: unlisted })).toEqual([expect.stringContaining('fewer than core')])
    expect(rowProblems({ file, row: { ...unlisted, rehomed: row.rehomed } })).toEqual([])
  })

  it("splits a shared kit test's cases among its rows, and lets only the listed core tests share one", () => {
    const { file, row } = pause()
    const first: Located = { file, row: { ...row, corePath: 'frontend/lib/__tests__/a.test.ts', coreIts: 1, kitIts: 1, rehomed: [] } }
    const rest = row.kitIts - first.row.kitIts
    const second: Located = { file, row: { ...row, corePath: 'frontend/lib/__tests__/b.test.ts', coreIts: rest, kitIts: rest, rehomed: [] } }
    const both = [first, second]
    expect(both.flatMap((located) => rowProblems(located, sharedCases(both, located)))).toEqual([])
    expect(rowProblems(first)).toEqual([expect.stringContaining('its row says')])
    expect(sharingProblems(both)).toEqual([expect.stringContaining('SHARED_KIT_TESTS lists none')])
    expect(sharingProblems([{ file, row }])).toEqual([])
  })

  it('refuses a row missing a field, with another field, or with a short sha', () => {
    const { row } = pause()
    const missing = Object.fromEntries(Object.entries(row).filter(([field]) => field !== 'rewritten'))
    expect([isRow(row), isRow(missing), isRow({ ...row, note: 'x' }), isRow({ ...row, coreSha: 'abc1234' })]).toEqual([true, false, false, false])
  })
})
