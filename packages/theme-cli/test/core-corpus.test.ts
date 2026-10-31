/**
 * pack refuses what core refuses: core's shared corpus (orchestrator/tests/fixtures/themes/cases.json,
 * vendored in test/fixtures/core) run against the kit's checks.
 *
 * `manifests`, `lookSchemas`, `looks`, `cssValues`, `prepaint` and `prepaintDrops` run against the vendored
 * TypeScript validators (src/core), proving the copy intact; `firstPaint` runs against src/first-paint.ts, the
 * port of core's first_paint.py, on the corpus's look schema, with core's sentences. `packages` runs against
 * checkPackage, the port of the server's reader: each case changes the hello package (manifestSet/manifestUnset
 * on theme.json, replace sets a file's text or, with null, drops it), exactly as core's pytest builds it. A
 * case's code is null when core accepts the input; otherwise every error carries that code.
 *
 * Core A-20 (QB-11): htmlClass 'play' is no longer reserved. As core's validator-parity and theme-package
 * tests pin it, the corpus gives 'play' to any theme id, in theme.json and in a package, and still refuses
 * every class the host keeps; the vendored validator keeps no class for an id.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { checkPackage } from '../src/check-package.ts'
import { cssValueProblem, PREPAINT_ERROR_CODES, prepaintDropErrors, prepaintErrors, type ThemeError } from '../src/core/css-value.ts'
import { validateLook, validateLookSchema, type LookSchema } from '../src/core/look-schema.ts'
import * as packageManifest from '../src/core/package-manifest.ts'
import { validateManifest } from '../src/core/package-manifest.ts'
import { FIRST_PAINT_ERROR_CODES, firstPaintTableErrors } from '../src/first-paint.ts'
import type { PackageEntry } from '../src/members.ts'
import { folderFiles } from './hello-files.ts'

type JsonObject = Readonly<Record<string, unknown>>

interface CorpusCase {
  readonly name: string
  readonly code: string | null
  readonly set?: JsonObject
  readonly unset?: readonly string[]
  readonly document?: unknown
  readonly manifestSet?: JsonObject
  readonly manifestUnset?: readonly string[]
  readonly replace?: Readonly<Record<string, string | null>>
  /** The refusals' sentences, in order, where the case pins them. */
  readonly messages?: readonly string[]
}

interface CorpusSection {
  readonly base?: JsonObject
  readonly schema?: unknown
  readonly cases: readonly CorpusCase[]
}

interface Corpus {
  readonly manifests: CorpusSection
  readonly lookSchemas: CorpusSection
  readonly looks: CorpusSection
  readonly prepaint: CorpusSection
  readonly prepaintDrops: CorpusSection
  readonly firstPaint: CorpusSection
  readonly cssValues: { readonly valid: readonly string[]; readonly invalid: readonly string[] }
  readonly packages: CorpusSection
}

const CORE_DIR = fileURLToPath(new URL('./fixtures/core/', import.meta.url))
const HELLO_DIR = join(CORE_DIR, 'hello')
const CORPUS = JSON.parse(readFileSync(join(CORE_DIR, 'cases.json'), 'utf8')) as Corpus
const MANIFEST = 'theme.json'
/** A-20: the <html> classes the host keeps, and the one it no longer reserves for any id. */
const HOST_HTML_CLASSES: readonly string[] = ['studio', 'classic', 'dark', 'light', 'system']
const FREED_HTML_CLASS = 'play'
const RESERVED_CODE = 'RESERVED_HTML_CLASS'
const FREED_CLASS_IDS_MIN = 3

/** The case's input: `document` as given, or `base` with `set` applied and `unset` removed. */
function patched(base: JsonObject | undefined, set: JsonObject | undefined, unset: readonly string[] = []): JsonObject {
  const merged: Record<string, unknown> = { ...base, ...set }
  return Object.fromEntries(Object.entries(merged).filter(([key]) => !unset.includes(key)))
}

/** The hello package with a `packages` case's changes, in path order (core's build_package). */
function packageEntries(testCase: CorpusCase): PackageEntry[] {
  const files = folderFiles(HELLO_DIR)
  if (testCase.manifestSet !== undefined || testCase.manifestUnset !== undefined) {
    const hello = JSON.parse(new TextDecoder().decode(files.get(MANIFEST))) as JsonObject
    const manifest = patched(hello, testCase.manifestSet, testCase.manifestUnset)
    files.set(MANIFEST, new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`))
  }
  Object.entries(testCase.replace ?? {}).forEach(([path, text]) => {
    if (text === null) files.delete(path)
    else files.set(path, new TextEncoder().encode(text))
  })
  return Array.from(files.keys()).sort().map((path) => ({ path, data: files.get(path) as Uint8Array }))
}

function expectVerdict(errors: readonly ThemeError[], code: string | null): void {
  errors.forEach((error) => {
    expect(Object.keys(error).sort()).toEqual(['code', 'message', 'path'])
    expect(error.message.trim()).not.toBe('')
  })
  if (code === null) {
    expect(errors).toEqual([])
    return
  }
  expect(errors.length).toBeGreaterThan(0)
  expect(Array.from(new Set(errors.map((error) => error.code)))).toEqual([code])
}

/** The cases of `cases` whose `field` sets `htmlClass` to `htmlClass`. */
function htmlClassCases(cases: readonly CorpusCase[], field: 'set' | 'manifestSet', htmlClass: string): CorpusCase[] {
  return cases.filter((testCase) => testCase[field]?.htmlClass === htmlClass)
}

function helloLookSchema(): LookSchema {
  const { schema } = validateLookSchema(CORPUS.looks.schema)
  if (schema === null) throw new Error('the corpus look schema must be valid')
  return schema
}

describe('the vendored validators give the corpus verdicts', () => {
  it.each([...CORPUS.manifests.cases])('manifest: $name', (testCase) => {
    const document = 'document' in testCase ? testCase.document : patched(CORPUS.manifests.base, testCase.set, testCase.unset)
    const result = validateManifest(document)
    expectVerdict(result.errors, testCase.code)
    expect(result.manifest === null).toBe(testCase.code !== null)
  })

  it.each([...CORPUS.lookSchemas.cases])('look schema: $name', (testCase) => {
    expectVerdict(validateLookSchema(testCase.document).errors, testCase.code)
  })

  it.each([...CORPUS.looks.cases])('look: $name', (testCase) => {
    const look = 'document' in testCase ? testCase.document : patched(CORPUS.looks.base, testCase.set, testCase.unset)
    expectVerdict(validateLook(helloLookSchema(), look), testCase.code)
  })

  it.each([...CORPUS.cssValues.valid])('CSS value %j passes', (value) => {
    expect(cssValueProblem(value)).toBeNull()
  })

  it.each([...CORPUS.cssValues.invalid])('CSS value %j is refused with a reason', (value) => {
    const problem = cssValueProblem(value)
    expect(typeof problem).toBe('string')
    expect(problem).not.toBe('')
    expect(problem).not.toContain('\n')
  })

  it.each([...CORPUS.prepaint.cases])('prepaint: $name', (testCase) => {
    expectVerdict(prepaintErrors(testCase.document), testCase.code)
  })

  it.each([...CORPUS.prepaintDrops.cases])('prepaint drops: $name', (testCase) => {
    const errors = prepaintDropErrors(testCase.document)
    expectVerdict(errors, testCase.code)
    errors.forEach((error) => expect(PREPAINT_ERROR_CODES).toContain(error.code))
    if (testCase.messages !== undefined) expect(errors.map((error) => error.message)).toEqual(testCase.messages)
  })
})

describe("src/first-paint.ts gives core's first_paint.py verdicts and sentences", () => {
  it.each([...CORPUS.firstPaint.cases])('first paint: $name', (testCase) => {
    const errors = firstPaintTableErrors(helloLookSchema(), testCase.document)
    expectVerdict(errors, testCase.code)
    errors.forEach((error) => expect(FIRST_PAINT_ERROR_CODES).toContain(error.code))
    if (testCase.messages !== undefined) expect(errors.map((error) => error.message)).toEqual(testCase.messages)
  })

  it('pins the sentence of every refused case, and has a case each check keeps', () => {
    const refused = [...CORPUS.prepaintDrops.cases, ...CORPUS.firstPaint.cases].filter((testCase) => testCase.code !== null)
    expect(refused.length).toBeGreaterThan(0)
    refused.forEach((testCase) => expect(testCase.messages?.length, testCase.name).toBeGreaterThan(0))
    expect(CORPUS.prepaintDrops.cases.some((testCase) => testCase.code === null && 'document' in testCase)).toBe(true)
    expect(CORPUS.firstPaint.cases.some((testCase) => testCase.code === null)).toBe(true)
  })
})

describe("checkPackage gives core's reader verdicts", () => {
  it('reads the corpus and the hello package', () => {
    expect(CORPUS.packages.cases.length).toBeGreaterThan(25)
    expect(Array.from(folderFiles(HELLO_DIR).keys()).sort()).toEqual([
      'README.md', 'dist/entry.js', 'dist/theme.css', 'looks/presets/default.look.json',
      'looks/presets/night.look.json', 'looks/schema.json', 'theme.json',
    ])
  })

  it.each([...CORPUS.packages.cases])('package: $name', (testCase) => {
    const result = checkPackage(packageEntries(testCase))
    expectVerdict(result.errors, testCase.code)
    expect(result.manifest === null).toBe(testCase.code !== null)
  })
})

describe("htmlClass 'play' is any theme's (core A-20)", () => {
  it('the corpus gives play to three ids or more and to a package with CSS under html.play, and refuses each host class', () => {
    const freed = htmlClassCases(CORPUS.manifests.cases, 'set', FREED_HTML_CLASS)
    const ids = new Set(freed.map((testCase) => testCase.set?.id ?? CORPUS.manifests.base?.id))
    expect(ids.size).toBeGreaterThanOrEqual(FREED_CLASS_IDS_MIN)
    expect(freed.map((testCase) => testCase.code)).toEqual(freed.map(() => null))
    const packages = htmlClassCases(CORPUS.packages.cases, 'manifestSet', FREED_HTML_CLASS)
    expect(packages.map((testCase) => testCase.code)).toEqual([null])
    HOST_HTML_CLASSES.forEach((htmlClass) => {
      const codes = htmlClassCases(CORPUS.manifests.cases, 'set', htmlClass).map((testCase) => testCase.code)
      expect(codes.length, htmlClass).toBeGreaterThan(0)
      expect(Array.from(new Set(codes)), htmlClass).toEqual([RESERVED_CODE])
    })
  })

  it('the vendored validator reserves only the classes the host keeps, and keeps none for a theme id', () => {
    expect(packageManifest.RESERVED_HTML_CLASSES).toEqual(HOST_HTML_CLASSES)
    expect(packageManifest).not.toHaveProperty('HTML_CLASS_OWNERS')
  })
})
