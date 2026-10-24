/**
 * The shared review corpus, kit side (PRD-261 B-03e2): core's orchestrator/tests/fixtures/themes/review-cases.json,
 * vendored byte for byte in test/fixtures/core at the commit src/core/README.md names. Core's
 * orchestrator/tests/test_prd261_review_corpus.py runs every case through its review stage (`run_review_stage`);
 * here `check`'s review (`reviewChecked`, on what checkPackage, the reader's port, accepted) runs every case and must
 * give the same level at each check the corpus names: sizes, cssScope, looks, uses and clonedFrom.
 *
 * A case is the hello package changed as core's build.py changes it: manifestSet sets top-level theme.json fields
 * over hello's and manifestUnset removes them, written with two-space indent and a final newline; replace sets a
 * file's text (a path hello lacks adds the file) or, with null, drops it; files are packed in path order.
 * `{"$corePageSha": path}` stands for that core page's sha256 in the vendored data/core-pages.json, and the SDK names
 * are the vendored data/sdk-surface.json, as core reads its own; a case whose host is `{"sdkSurface": "missing"}` is
 * reviewed with no SDK name list. The file is held to its sha256 row in src/core/README.md and to the shape core's
 * test pins (schema, package, checks, levels, case fields, host conditions), so a case core writes in a new form
 * fails here instead of passing unread.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { checkPackage } from '../src/check-package.ts'
import { corePageHashes } from '../src/check/drift.ts'
import { reviewChecked, type ReviewOptions } from '../src/check/index.ts'
import { LEVELS } from '../src/check/report.ts'
import { sha256Hex } from '../src/digest.ts'
import type { PackageEntry } from '../src/members.ts'
import { writeZip } from '../src/zip.ts'
import { folderFiles } from './hello-files.ts'

type JsonObject = Readonly<Record<string, unknown>>

interface ReviewCase {
  readonly name: string
  readonly manifestSet?: JsonObject
  readonly manifestUnset?: readonly string[]
  readonly replace?: JsonObject
  readonly host?: Readonly<Record<string, unknown>>
  readonly expected: Readonly<Record<string, string>>
}

interface ReviewCorpus {
  readonly schema: string
  readonly _comment: string
  readonly package: string
  readonly checks: readonly string[]
  readonly levels: readonly string[]
  readonly cases: readonly ReviewCase[]
}

const CORE_DIR = fileURLToPath(new URL('./fixtures/core/', import.meta.url))
const CORPUS_FILE = join(CORE_DIR, 'review-cases.json')
const HELLO_DIR = join(CORE_DIR, 'hello')
const README = new URL('../src/core/README.md', import.meta.url)
const CORPUS = JSON.parse(readFileSync(CORPUS_FILE, 'utf8')) as ReviewCorpus
const MANIFEST = 'theme.json'
const README_ROW = /^\| `test\/fixtures\/core\/review-cases\.json` \| `[^`]+` \| `([0-9a-f]{64})` \|$/m

/** test_prd261_review_corpus.py's names for the file's shape. */
const CORPUS_SCHEMA = 'automatos-theme-review-corpus/v1'
const HELLO_PACKAGE = 'hello'
/** review_stage.py READER_CHECKS, then uses and clonedFrom: the checks both reviews make. */
const CHECKS = ['sizes', 'cssScope', 'looks', 'uses', 'clonedFrom']
const CASE_FIELDS = ['name', 'manifestSet', 'manifestUnset', 'replace', 'host', 'expected']
const CORE_PAGE_SHA = '$corePageSha'
const HOST_SURFACE = 'sdkSurface'
const SURFACE_MISSING = 'missing'

const PAGES = corePageHashes()

/** The vendored release's sha256 of the core page at `path`; a path it doesn't ship is a broken corpus. */
function pageSha(path: unknown): string {
  const sha = typeof path === 'string' ? PAGES.get(path) : undefined
  if (sha === undefined) throw new Error(`data/core-pages.json has no page ${String(path)}`)
  return sha
}

/** `value` with each `{"$corePageSha": path}` replaced by that page's sha256 (core's `_resolved`). */
function resolved(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(resolved)
  if (typeof value !== 'object' || value === null) return value
  const entries = Object.entries(value)
  if (entries.length === 1 && entries[0][0] === CORE_PAGE_SHA) return pageSha(entries[0][1])
  return Object.fromEntries(entries.map(([key, item]) => [key, resolved(item)]))
}

/** hello's theme.json with `set` over it and `unset` removed, as package bytes (build.py `changed_manifest`). */
function changedManifest(set: JsonObject, unset: readonly string[]): Uint8Array {
  const hello = JSON.parse(readFileSync(join(HELLO_DIR, MANIFEST), 'utf8')) as JsonObject
  const merged = Object.entries({ ...hello, ...set }).filter(([key]) => !unset.includes(key))
  return new TextEncoder().encode(`${JSON.stringify(Object.fromEntries(merged), null, 2)}\n`)
}

/** The hello package with the case's changes, in path order (core's `_package`, over build.py `build_package`). */
function casePackage(testCase: ReviewCase): PackageEntry[] {
  const files = folderFiles(HELLO_DIR)
  if (testCase.manifestSet !== undefined || testCase.manifestUnset !== undefined) {
    files.set(MANIFEST, changedManifest(resolved(testCase.manifestSet ?? {}) as JsonObject, testCase.manifestUnset ?? []))
  }
  Object.entries(resolved(testCase.replace ?? {}) as JsonObject).forEach(([path, text]) => {
    if (text === null) files.delete(path)
    else files.set(path, new TextEncoder().encode(String(text)))
  })
  return Array.from(files.keys()).sort().map((path) => ({ path, data: files.get(path) as Uint8Array }))
}

/** The level `check` gives the case's package at each corpus check, on the host the case names (core's `_levels`). */
async function levelsOf(testCase: ReviewCase): Promise<Record<string, string>> {
  const entries = casePackage(testCase)
  const checked = checkPackage(entries)
  if (checked.manifest === null) {
    throw new Error(`${testCase.name}: the reader refuses it: ${checked.errors.map((error) => error.code).join(', ')}`)
  }
  const files = new Map(Array.from(checked.files, ([path, file]): [string, Uint8Array] => [path, file.data]))
  const options: ReviewOptions = testCase.host?.[HOST_SURFACE] === SURFACE_MISSING ? { surface: null } : {}
  const { report } = await reviewChecked(files, checked.manifest, writeZip(entries).length, options)
  return Object.fromEntries(CORPUS.checks.map((name) => [name, report.checks[name]?.level]))
}

describe("check gives core's review level at each check, on every case of the shared corpus", () => {
  it.each([...CORPUS.cases])('$name', async (testCase) => {
    expect(await levelsOf(testCase)).toEqual(testCase.expected)
  })
})

describe('the vendored corpus', () => {
  it('has the sha256 its row in src/core/README.md names', () => {
    const row = README_ROW.exec(readFileSync(README, 'utf8'))
    expect(row?.[1]).toBe(sha256Hex(readFileSync(CORPUS_FILE)))
  })

  it("names core's schema, the hello package, the checks both reviews make and check's levels", () => {
    expect([CORPUS.schema, CORPUS.package]).toEqual([CORPUS_SCHEMA, HELLO_PACKAGE])
    expect(CORPUS.checks).toEqual(CHECKS)
    expect(CORPUS.levels).toEqual([...LEVELS])
    expect(CORPUS._comment.trim()).not.toBe('')
    expect(CORPUS.cases.length).toBeGreaterThan(0)
  })

  it('gives each case a unique name, known fields, a known host and a level for each check in order', () => {
    const names = CORPUS.cases.map((testCase) => testCase.name)
    expect(new Set(names).size).toBe(names.length)
    CORPUS.cases.forEach((testCase) => {
      const host = Object.entries(testCase.host ?? {})
      expect(Object.keys(testCase).filter((field) => !CASE_FIELDS.includes(field)), testCase.name).toEqual([])
      expect(Object.keys(testCase.expected), testCase.name).toEqual(CORPUS.checks)
      expect(Object.values(testCase.expected).filter((level) => !CORPUS.levels.includes(level)), testCase.name).toEqual([])
      expect(host.filter(([key, value]) => key !== HOST_SURFACE || value !== SURFACE_MISSING), testCase.name).toEqual([])
    })
  })

  it('reaches every level uses and clonedFrom can give', () => {
    const reached = (check: string): string[] => Array.from(new Set(CORPUS.cases.map((testCase) => testCase.expected[check]))).sort()
    expect(reached('uses')).toEqual(['error', 'pass', 'warning'])
    expect(reached('clonedFrom')).toEqual(['pass', 'warning'])
  })
})
