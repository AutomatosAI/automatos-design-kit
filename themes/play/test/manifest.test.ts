// @vitest-environment node
// Play's theme.json, entry and build config agree with each other, with core's manifest validator
// (vendored in the theme CLI) and with what core's builtin Play declares. Files are read, not built.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { validateManifest } from '@automatos/theme-cli/manifest'
import { describe, expect, it } from 'vitest'
import { readSource, readThemeFile, SOURCE_ROOT, sourceScripts, THEME_ROOT } from './source-files.ts'

const CORE_SHA = 'ebedc7eb8d7f7f9d032706728a7f420a9e833392'
/** Slots Play's frame draws itself, so theme.json declares them but the entry registers none. */
const DRAWN_BY_FRAME = ['asleep@1']
/** The vendored SDK types, one file per area, named as `uses` writes the area ('pages-command-center'). */
const SDK_AREAS = join(THEME_ROOT, '..', '..', 'packages', 'theme-sdk', 'areas')
const SDK = String.raw`['"]@automatos/theme-sdk['"]`
/** `import { a, type B, c as d } from '@automatos/theme-sdk'` (or `export { … } from`), over several lines too. */
const NAMED_SDK_IMPORT = new RegExp(String.raw`\b(?:import|export)\s+(type\s+)?\{([^{}]*)\}\s*from\s*` + SDK, 'g')
/** A namespace or dynamic import of the SDK: it names no list, so `uses` could not be checked against it. */
const WIDE_SDK_IMPORT = new RegExp(String.raw`\bimport\s*\*\s*as\s+\w+\s+from\s*${SDK}|\bimport\s*\(\s*${SDK}`)

interface PageEntry { readonly mode: string; readonly keepCorePage?: readonly string[] }
interface Manifest {
  readonly [field: string]: unknown
  readonly slots: readonly string[]
  readonly pages: Readonly<Record<string, PageEntry>>
  readonly routes: readonly string[]
}

const manifest = JSON.parse(readThemeFile('theme.json')) as Manifest
const entry = readSource('entry.ts')

/** The first arguments of every `host.<method>('…', …)` call in the entry, in order. */
function registered(method: string): string[] {
  return Array.from(entry.matchAll(new RegExp(String.raw`host\.${method}\(\s*'([^']+)'`, 'g')), (m) => m[1])
}

/** The routes the entry registers: by literal, or by the PLAY_CONVERSATIONS_ROUTE constant. */
function registeredRoutes(): string[] {
  const slots = readSource('play-slots.tsx')
  const constant = /export const PLAY_CONVERSATIONS_ROUTE = '([^']+)'/.exec(slots)?.[1]
  const byConstant = entry.includes('host.registerRoute(PLAY_CONVERSATIONS_ROUTE,') && constant ? [constant] : []
  return [...registered('registerRoute'), ...byConstant]
}

/** Each value (not type) name the SDK exports, mapped to the area whose file declares it. */
function sdkAreaOfName(): Map<string, string> {
  const owner = new Map<string, string>()
  for (const file of readdirSync(SDK_AREAS).filter((name) => name.endsWith('.d.ts'))) {
    const text = readFileSync(join(SDK_AREAS, file), 'utf8')
    for (const match of text.matchAll(/^export declare (?:const|let|var|function|class|enum) ([A-Za-z_$][\w$]*)/gm)) {
      owner.set(match[1], file.slice(0, -'.d.ts'.length))
    }
  }
  return owner
}

/** The value names Play's source imports from the SDK; `type` imports are left out, as the build drops them. */
function sdkValueImports(): string[] {
  const names = sourceScripts().flatMap((rel) =>
    Array.from(readSource(rel).matchAll(NAMED_SDK_IMPORT)).flatMap((match) => (match[1] ? [] : match[2].split(','))),
  )
  return names
    .map((part) => part.trim())
    .filter((part) => part !== '' && !part.startsWith('type '))
    .map((part) => part.split(/\s+as\s+/)[0].trim())
}

describe('theme.json', () => {
  it("passes core's manifest validator", () => {
    expect(validateManifest(manifest).errors).toEqual([])
  })

  it("is builtin Play's entry as core has it", () => {
    expect(manifest).toMatchObject({
      schema: 'automatos-theme/v1',
      id: 'automatos/play',
      version: '1.1.0',
      htmlClass: 'play',
      minWidth: 1024,
      base: 'studio',
      tone: 'from-look',
      routes: ['conversations'],
    })
    expect([...manifest.slots].sort()).toEqual(['asleep@1', 'frame@1', 'lookEditor@1', 'notFound@1', 'styleSheet@1'])
  })

  it('keeps the core page for the links core keeps it for', () => {
    expect(manifest.pages).toEqual({
      '/chat': { mode: 'own', keepCorePage: ['repo', 'runtime', 'mode'] },
      '/deliverables': { mode: 'own', keepCorePage: ['tab', 'post', 'artifact_type'] },
    })
  })

  it("declares in uses exactly the SDK areas the code imports, as core's review check reads them", () => {
    expect(sourceScripts().filter((rel) => WIDE_SDK_IMPORT.test(readSource(rel)))).toEqual([])
    const owner = sdkAreaOfName()
    const imported = sdkValueImports()
    expect(imported.filter((name) => !owner.has(name))).toEqual([])
    const used = new Set(imported.map((name) => owner.get(name)))
    expect([...(manifest.uses as string[])].sort()).toEqual([...used].sort())
  })

  it("has the workspace package's version", () => {
    const pkg = JSON.parse(readThemeFile('package.json')) as { version?: string }
    expect(pkg.version).toBe(manifest.version)
  })
})

describe('entry.ts', () => {
  it('is a defineTheme default export', () => {
    expect(entry).toMatch(/import \{ defineTheme \} from '@automatos\/theme-sdk'/)
    expect(entry).toMatch(/export default defineTheme\(\{/)
  })

  it('registers every slot theme.json declares, but the ones the frame draws', () => {
    const expected = manifest.slots.filter((slot) => !DRAWN_BY_FRAME.includes(slot))
    expect(registered('registerSlot').sort()).toEqual([...expected].sort())
  })

  it("registers theme.json's pages and routes", () => {
    expect(registered('registerPage').sort()).toEqual(Object.keys(manifest.pages).sort())
    expect(registeredRoutes()).toEqual([...manifest.routes])
  })
})

describe('the build', () => {
  it('wraps every rule under html.play (D2-c)', () => {
    const config = readThemeFile('vite.config.ts')
    expect(config).toContain(`automatosTheme({ htmlClass: '${String(manifest.htmlClass)}', wrap: 'html' })`)
  })
})

describe('where the code comes from', () => {
  it('names the core commit and the rule until A-19', () => {
    const readme = readThemeFile('README.md')
    expect(readme).toContain(CORE_SHA)
    expect(readme).toMatch(/A-19/)
  })

  it.each(['lucide-react', 'zustand', 'use-sync-external-store'])('vendors %s with its licence', (name) => {
    expect(existsSync(join(SOURCE_ROOT, 'vendor', name, 'LICENSE.txt'))).toBe(true)
  })

  it('declares CSS modules outside src/, so the package source holds only the theme', () => {
    expect(existsSync(join(THEME_ROOT, 'types', 'css-modules.d.ts'))).toBe(true)
  })
})
