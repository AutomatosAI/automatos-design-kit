/**
 * The `uses` check gives core's answers: the `uses` cases of core's
 * orchestrator/tests/test_prd261_review_stage.py at the commit src/core/README.md names (the seeded
 * bad packages, the SDK storage area on this host's name list, and no name list at all), each on
 * the hello package changed the same way, through the whole review.
 */
import { describe, expect, it } from 'vitest'
import { LLM_SERVER_ONLY } from '../src/check/report.ts'
import { filled, findSdkImports, sdkSurface, SDK_SURFACE_FILE, UNDECLARED, usesCheck } from '../src/check/uses.ts'
import { entryImporting, HELLO_ENTRY, helloPackage, reviewHello, reviewOnThisHost, SDK_IMPORT, SURFACE } from './check-support.ts'

const STORAGE_IMPORT = 'defineTheme, readThemeState, writeThemeState'
const STORAGE_AREA = 'storage'

async function usesOf(entry: string, uses?: readonly string[]): Promise<Readonly<Record<string, unknown>>> {
  const report = (await reviewHello({ entry, manifest: uses === undefined ? {} : { uses } })).report
  return report.checks.uses
}

describe("seeded bad packages, each failing at core's uses check", () => {
  it('an import the SDK does not export is an error at uses', async () => {
    const { report } = await reviewHello({ entry: entryImporting('defineTheme, stealSession as s') })
    const uses = report.checks.uses
    expect(report.verdict).toBe('blocked')
    expect(uses.level).toBe('error')
    expect(uses.unknownNames).toEqual(['stealSession'])
    expect((uses.problems as string[])[0]).toContain("can't load")
    expect(report.checks.llm).toMatchObject({ level: 'not_measured', reason: LLM_SERVER_ONLY })
  })

  it('an area used but not declared is a warning at uses', async () => {
    const { report } = await reviewHello({ entry: entryImporting('defineTheme, useChatController') })
    const uses = report.checks.uses
    expect(report.verdict).toBe('review_required')
    expect(uses.level).toBe('warning')
    expect(uses.undeclaredAreas).toEqual(['chat'])
    expect(uses.usedNames).toEqual(['defineTheme', 'useChatController'])
  })

  it('a minified import is read too', async () => {
    const minified = HELLO_ENTRY.replace(SDK_IMPORT, 'import{defineTheme as e,useAgents as t}from"@automatos/theme-sdk"')
    const uses = await usesOf(minified, ['theme', 'pages-agents'])
    expect(uses.level).toBe('pass')
    expect(uses.usedAreas).toEqual(['pages-agents', 'theme'])
  })

  it('a page area may be written with a dash or a dot, and a non-area is a warning', async () => {
    const entry = entryImporting('defineTheme, useAgents')
    expect((await usesOf(entry, ['theme', 'pages.agents'])).level).toBe('pass')
    const uses = await usesOf(entry, ['theme', 'pages-agents', 'telepathy'])
    expect(uses.level).toBe('warning')
    expect(uses.notAreas).toEqual(['telepathy'])
  })

  it('a declared area the code never uses is reported, not warned', async () => {
    const uses = await usesOf(HELLO_ENTRY, ['theme', 'chat'])
    expect(uses.level).toBe('pass')
    expect(uses.declaredUnused).toEqual(['chat'])
  })

  it('a namespace import is a warning and its names are found in the text', async () => {
    const wide = `${HELLO_ENTRY.replace(SDK_IMPORT, "import * as sdk from '@automatos/theme-sdk'\nconst { defineTheme } = sdk")}`
      + '\nexport const chat = () => sdk.useStartChat()\n'
    const uses = await usesOf(wide, ['theme', 'chat'])
    expect(uses.level).toBe('warning')
    expect(uses.wideImport).toBe(true)
    expect(uses.usedAreas).toEqual(['chat', 'theme'])
    expect(uses.unknownNames).toEqual([])
  })
})

describe("the SDK's storage area on this host's name list (the vendored sdk-surface.json)", () => {
  it('an SDK storage call declared in uses passes', async () => {
    const { report } = await reviewOnThisHost({ entry: entryImporting(STORAGE_IMPORT), manifest: { uses: ['theme', STORAGE_AREA] } })
    const uses = report.checks.uses
    expect([report.verdict, uses.level, uses.unknownNames]).toEqual(['pass', 'pass', []])
    expect(uses.usedAreas).toContain(STORAGE_AREA)
    expect(uses.undeclaredAreas).toEqual([])
    expect(uses.usedNames).toEqual(expect.arrayContaining(['readThemeState', 'writeThemeState']))
  })

  it('an SDK storage call without storage in uses is a warning listing it', async () => {
    const { report } = await reviewOnThisHost({ entry: entryImporting(STORAGE_IMPORT) })
    const uses = report.checks.uses
    expect([report.verdict, uses.level, uses.unknownNames]).toEqual(['review_required', 'warning', []])
    expect(uses.undeclaredAreas).toEqual([STORAGE_AREA])
    expect(uses.problems).toEqual([filled(UNDECLARED, 'areas', [STORAGE_AREA])])
  })
})

describe('without the SDK name list', () => {
  it('the uses check is a warning, not checked', async () => {
    const { report } = await reviewHello({}, { surface: null })
    expect(report.checks.uses).toMatchObject({ level: 'warning', status: 'not_checked' })
  })

  it('an unreadable name list reads as none, and the vendored one as its areas', () => {
    expect(sdkSurface(new URL('./no-such-surface.json', SDK_SURFACE_FILE))).toBeNull()
    const vendored = sdkSurface()
    expect(vendored?.[STORAGE_AREA]).toEqual(expect.arrayContaining(['readThemeState', 'writeThemeState']))
    expect(vendored?.theme).toContain('defineTheme')
  })
})

describe('the import forms the port reads', () => {
  it('reads re-exports, default-plus-named imports, type specifiers and quoted names', () => {
    const texts = [
      'export{useAgents}from"@automatos/theme-sdk"',
      "import Theme, { type ThemeHost, defineTheme, \"useStartChat\" as start } from '@automatos/theme-sdk'",
    ]
    expect(Array.from(findSdkImports(texts).named).sort()).toEqual(['ThemeHost', 'defineTheme', 'useAgents', 'useStartChat'])
    expect(findSdkImports(texts).wide).toBe(false)
  })

  it.each([
    ["const sdk = await import('@automatos/theme-sdk')"],
    ['export * from "@automatos/theme-sdk"'],
    ["export * as sdk from '@automatos/theme-sdk'"],
  ])('%s imports the SDK whole', (text) => {
    expect(findSdkImports([text]).wide).toBe(true)
  })

  it('reads only dist/entry.js and dist/chunks/*.js, never source/', () => {
    const files = new Map(helloPackage({ replace: { 'source/entry.ts': entryImporting('defineTheme, stealSession') } }))
    expect(usesCheck({ uses: ['theme'] }, files, SURFACE)).toMatchObject({ level: 'pass', unknownNames: [] })
    files.set('dist/chunks/page.js', new TextEncoder().encode('import{stealSession}from"@automatos/theme-sdk"'))
    expect(usesCheck({ uses: ['theme'] }, files, SURFACE)).toMatchObject({ level: 'error', unknownNames: ['stealSession'] })
  })
})
