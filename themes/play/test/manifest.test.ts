// @vitest-environment node
// Play's theme.json, entry and build config agree with each other, with core's manifest validator
// (vendored in the theme CLI) and with what core's builtin Play declares. Files are read, not built.
// PRD-261 M-07: theme.json names Auto's states (`mascot`) and the phone's block (`mobile`); the files and
// colours the block needs are test/mobile.test.ts's. PRD-261 B-01i: `uses` covers the SDK areas of the kit
// packages Play bundles too, since the package carries their src/ under source/packages/ and the review reads it.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { validateManifest } from '@automatos/theme-cli/manifest'
import { bundledPackages } from '@automatos/vite-preset'
import { describe, expect, it } from 'vitest'
import { MASCOT_STATES } from '@automatos/mascot/types'
import { readSource, readThemeFile, SOURCE_ROOT, sourceScripts, THEME_ROOT } from './source-files.ts'

const CORE_SHA = 'ebedc7eb8d7f7f9d032706728a7f420a9e833392'
/** Core's A-19 merge (AutomatosAI/automatos-ai#1282): builtin Play left core, so Play lives only in the kit. */
const A19_MERGE = 'fd993980e319172ea442491217249000ed85a5e7'
/** The kit's record of where Play's code came from, outside the package: Play's README is packed. */
const PLAY_HISTORY = join(THEME_ROOT, '..', '..', 'docs', 'PLAY-HISTORY.md')
/** The README's section that points at the history, and the head of the history's table of changed lines. */
const WHERE_FROM = 'Where the code comes from'
const CHANGED_LINES_HEADER = '| File | Change | Why |'
/** Slots Play's frame draws itself, so theme.json declares them but the entry registers none. */
const DRAWN_BY_FRAME = ['asleep@1']
/** The vendored SDK types, one file per area, named as `uses` writes the area ('pages-command-center'). */
const SDK_AREAS = join(THEME_ROOT, '..', '..', 'packages', 'theme-sdk', 'areas')
const SDK = String.raw`['"]@automatos/theme-sdk['"]`
/** `import { a, type B, c as d } from '@automatos/theme-sdk'` (or `export { … } from`), over several lines too. */
const NAMED_SDK_IMPORT = new RegExp(String.raw`\b(?:import|export)\s+(type\s+)?\{([^{}]*)\}\s*from\s*` + SDK, 'g')
/** A namespace or dynamic import of the SDK: it names no list, so `uses` could not be checked against it. */
const WIDE_SDK_IMPORT = new RegExp(String.raw`\bimport\s*\*\s*as\s+\w+\s+from\s*${SDK}|\bimport\s*\(\s*${SDK}`)
/** A script file, as test/source-files.ts reads Play's. */
const SCRIPT_FILE = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/

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

/** The lines of one `## <heading>` section of the README, up to the next `## ` heading, blank lines left out. */
function readmeSection(heading: string): string[] {
  const lines = readThemeFile('README.md').split('\n')
  const start = lines.indexOf(`## ${heading}`)
  if (start < 0) throw new Error(`README.md has no "## ${heading}" section`)
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((line) => line.startsWith('## '))
  return (end < 0 ? rest : rest.slice(0, end)).filter((line) => line.trim() !== '')
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

/** Every script the package carries as source/: Play's src/ and each bundled kit package's src/, by path, as text. */
function packedScripts(): { readonly rel: string; readonly text: string }[] {
  const own = sourceScripts().map((rel) => ({ rel, text: readSource(rel) }))
  const bundled = bundledPackages(THEME_ROOT).flatMap((item) => {
    const src = join(item.dir, 'src')
    return readdirSync(src, { encoding: 'utf8', recursive: true })
      .filter((rel) => SCRIPT_FILE.test(rel))
      .map((rel) => ({ rel: `${item.name}/${rel}`, text: readFileSync(join(src, rel), 'utf8') }))
  })
  return [...own, ...bundled]
}

/** The value names the packed source imports from the SDK; `type` imports are left out, as the build drops them. */
function sdkValueImports(): string[] {
  const names = packedScripts().flatMap(({ text }) =>
    Array.from(text.matchAll(NAMED_SDK_IMPORT)).flatMap((match) => (match[1] ? [] : match[2].split(','))),
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

  it("declares Play's schema, id, version, htmlClass, minWidth, base, tone, routes and slots", () => {
    expect(manifest).toMatchObject({
      schema: 'automatos-theme/v1',
      id: 'automatos/play',
      version: '1.2.0',
      htmlClass: 'play',
      minWidth: 1024,
      base: 'studio',
      tone: 'from-look',
      routes: ['conversations'],
    })
    expect([...manifest.slots].sort()).toEqual(['asleep@1', 'frame@1', 'lookEditor@1', 'notFound@1', 'styleSheet@1'])
  })

  it("names Auto's states as the mascot field: MASCOT_STATES, in their order", () => {
    expect(manifest.mascot).toEqual({ states: [...MASCOT_STATES] })
  })

  it("gives the phone the look's colours and Auto's clips, and no phone fonts (Play's faces are woff2 only)", () => {
    expect(manifest.mobile).toEqual({ fromLooks: true, mascot: 'clips' })
  })

  it('keeps the core page for the links core keeps it for', () => {
    expect(manifest.pages).toEqual({
      '/chat': { mode: 'own', keepCorePage: ['repo', 'runtime', 'mode'] },
      '/deliverables': { mode: 'own', keepCorePage: ['tab', 'post', 'artifact_type'] },
    })
  })

  it("declares in uses exactly the SDK areas the code imports, as core's review check reads them", () => {
    expect(packedScripts().filter(({ text }) => WIDE_SDK_IMPORT.test(text)).map(({ rel }) => rel)).toEqual([])
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
  it("points in one line at the kit's history (K-21), and keeps no rule from before A-19", () => {
    const section = readmeSection(WHERE_FROM)
    expect(section).toHaveLength(1)
    expect(section[0]).toContain('docs/PLAY-HISTORY.md')
    expect(readThemeFile('README.md')).not.toContain('Until A-19')
  })

  it("the kit's history names the core commit Play's code was copied from, the lines changed and the A-19 merge", () => {
    const history = readFileSync(PLAY_HISTORY, 'utf8')
    expect(history).toContain(CORE_SHA)
    expect(history).toContain(CHANGED_LINES_HEADER)
    expect(history).toContain(A19_MERGE)
  })

  it.each(['lucide-react', 'zustand', 'use-sync-external-store'])('vendors %s with its licence', (name) => {
    expect(existsSync(join(SOURCE_ROOT, 'vendor', name, 'LICENSE.txt'))).toBe(true)
  })

  it('declares CSS modules outside src/, so the package source holds only the theme', () => {
    expect(existsSync(join(THEME_ROOT, 'types', 'css-modules.d.ts'))).toBe(true)
  })
})
