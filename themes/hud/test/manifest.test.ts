// @vitest-environment node
// HUD's theme.json, entry, package.json and build config agree with each other and with core's manifest validator
// (vendored in the theme CLI). `uses` declares exactly the SDK areas the packed source imports (HUD's src/ and the
// src/ of each kit library it bundles, which the package carries under source/packages/): every one, so core's
// review warns of none undeclared, and only those, so it reports none declared and unused. HUD 1.1.0 uses the SDK's
// voice area (SDK 1.2.0); HUD 1.1.3 runs on SDK 1.3.0 and peers the vendored SDK at 1.3.0; HUD 1.2.0 uses its proactive
// area. Files are read, not built.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, posix } from 'node:path'
import { validateManifest } from '@automatos/theme-cli/manifest'
import { bundledPackages } from '@automatos/vite-preset'
import { describe, expect, it } from 'vitest'
import { MASCOT_STATES } from '@automatos/mascot/types'
import {
  importSpecifiers,
  isRelative,
  KIT_ROOT,
  readSource,
  readThemeFile,
  readThemeJson,
  sourceScripts,
  THEME_ROOT,
} from './support/files.ts'

interface Manifest {
  readonly [field: string]: unknown
  readonly slots: readonly string[]
  readonly uses: readonly string[]
  readonly pages?: Readonly<Record<string, unknown>>
  readonly routes?: readonly string[]
  readonly engines: { readonly automatos: string; readonly sdk: string }
}

interface PackageJson {
  readonly name: string
  readonly version: string
  readonly scripts: Readonly<Record<string, string>>
  readonly engines: Readonly<Record<string, string>>
  readonly dependencies: Readonly<Record<string, string>>
  readonly devDependencies: Readonly<Record<string, string>>
  readonly peerDependencies: Readonly<Record<string, string>>
}

const manifest = readThemeJson<Manifest>('theme.json')
const pkg = readThemeJson<PackageJson>('package.json')
const sdkPackage = JSON.parse(readFileSync(join(KIT_ROOT, 'packages', 'theme-sdk', 'package.json'), 'utf8')) as PackageJson
/** The host contract HUD runs on, and the SDK it runs on (SDK 1.3.0; its voice area is SDK 1.2.0's). */
const HUD_ENGINES = { automatos: '^1.1.0', sdk: '^1.3.0' }
const SDK_NAME = '@automatos/theme-sdk'
const play = JSON.parse(readFileSync(join(KIT_ROOT, 'themes', 'play', 'package.json'), 'utf8')) as PackageJson
const entry = readSource('entry.ts')

const SDK_AREAS = join(KIT_ROOT, 'packages', 'theme-sdk', 'areas')
const SDK = String.raw`['"]@automatos/theme-sdk['"]`
/** `import { a, type B, c as d } from '@automatos/theme-sdk'` (or `export { … } from`), over several lines too. */
const NAMED_SDK_IMPORT = new RegExp(String.raw`\b(?:import|export)\s+(type\s+)?\{([^{}]*)\}\s*from\s*` + SDK, 'g')
/** A namespace or dynamic import of the SDK: it names no list, so `uses` could not be checked against it. */
const WIDE_SDK_IMPORT = new RegExp(String.raw`\bimport\s*\*\s*as\s+\w+\s+from\s*${SDK}|\bimport\s*\(\s*${SDK}`)
const SCRIPT_FILE = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/
/** The host's import map (react, react-dom, the SDK) and the two kit libraries HUD bundles, by module. */
const HOST_MODULES: readonly string[] = ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@automatos/theme-sdk']
const KIT_LIBRARY_MODULE = /^@automatos\/(?:look-kit|mascot)\/[a-z-]+$/

function isAllowedBare(specifier: string): boolean {
  return HOST_MODULES.includes(specifier) || KIT_LIBRARY_MODULE.test(specifier)
}

/** True when a relative import of `rel` (a path under src/) climbs out of src/. */
function leavesSource(rel: string, specifier: string): boolean {
  return posix.normalize(posix.join(posix.dirname(rel), specifier)).startsWith('..')
}

/** The first arguments of every `host.<method>('…', …)` call in the entry, in order. */
function registered(method: string): string[] {
  return Array.from(entry.matchAll(new RegExp(String.raw`host\.${method}\(\s*'([^']+)'`, 'g')), (m) => m[1])
}

/** Each value name the SDK exports, mapped to the area whose file declares it ('pages-agents' for pages/agents). */
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

function sdkAreas(): string[] {
  return readdirSync(SDK_AREAS).filter((name) => name.endsWith('.d.ts')).map((name) => name.slice(0, -'.d.ts'.length))
}

/** Every script the package carries as source/: HUD's src/ and each bundled kit package's src/. */
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

  it("declares HUD's schema, id, name, version, htmlClass, minWidth, base, tone and default look", () => {
    expect(manifest).toMatchObject({
      schema: 'automatos-theme/v1',
      id: 'automatos/hud',
      name: 'HUD',
      version: '1.2.0',
      htmlClass: 'hud',
      minWidth: 360,
      base: 'studio',
      tone: 'from-look',
      look: 'arc',
    })
  })

  it("runs on today's host contract and on SDK 1.3.0, the vendored SDK's version, with the voice and proactive areas", () => {
    expect(manifest.engines).toEqual(HUD_ENGINES)
    expect(manifest.uses).toContain('voice')
    expect(manifest.uses).toContain('proactive')
    expect(`^${sdkPackage.version}`).toBe(manifest.engines.sdk)
  })

  it('declares the frame, the look editor and the style sheet as slots', () => {
    expect([...manifest.slots].sort()).toEqual(['frame@1', 'lookEditor@1', 'styleSheet@1'])
  })

  it("names Auto's states as the mascot field: MASCOT_STATES, in their order", () => {
    expect(manifest.mascot).toEqual({ states: [...MASCOT_STATES] })
  })

  it('lists its display faces, each a file in the package', () => {
    const fonts = manifest.fonts as readonly string[]
    expect(fonts.length).toBe(2)
    expect(fonts.filter((path) => !existsSync(join(THEME_ROOT, path)))).toEqual([])
  })

  it('declares in uses exactly the SDK areas the packed source imports, each a real SDK area', () => {
    expect(packedScripts().filter(({ text }) => WIDE_SDK_IMPORT.test(text)).map(({ rel }) => rel)).toEqual([])
    const owner = sdkAreaOfName()
    const imported = sdkValueImports()
    expect(imported.filter((name) => !owner.has(name))).toEqual([])
    const used = new Set(imported.map((name) => owner.get(name) as string))
    expect([...used].filter((area) => !manifest.uses.includes(area))).toEqual([])
    expect(manifest.uses.filter((area) => !used.has(area))).toEqual([])
    expect(manifest.uses.filter((area) => !sdkAreas().includes(area))).toEqual([])
  })

  it("has the workspace package's version", () => {
    expect(pkg.version).toBe(manifest.version)
  })
})

describe('entry.ts', () => {
  it('is a defineTheme default export', () => {
    expect(entry).toMatch(/import \{ defineTheme \} from '@automatos\/theme-sdk'/)
    expect(entry).toMatch(/export default defineTheme\(\{/)
  })

  it('registers every slot theme.json declares, and nothing else', () => {
    expect(registered('registerSlot').sort()).toEqual([...manifest.slots].sort())
  })

  it("registers theme.json's pages and routes", () => {
    expect(registered('registerPage').sort()).toEqual(Object.keys(manifest.pages ?? {}).sort())
    expect(registered('registerRoute')).toEqual([...(manifest.routes ?? [])])
  })

  it('brings in the faces, then the tokens, before any component', () => {
    const fonts = entry.indexOf("import './app/hud-fonts.css'")
    const tokens = entry.indexOf("import './app/hud-theme.css'")
    expect(fonts).toBeGreaterThan(-1)
    expect(tokens).toBeGreaterThan(fonts)
    expect(entry.indexOf("from './slots/")).toBeGreaterThan(tokens)
  })
})

describe('package.json', () => {
  it('is the private workspace @automatos/theme-hud, Apache-2.0', () => {
    expect(pkg).toMatchObject({ name: '@automatos/theme-hud', private: true, license: 'Apache-2.0', type: 'module' })
  })

  it('bundles look-kit and mascot at their own versions, and nothing else', () => {
    const library = (name: string): string =>
      (JSON.parse(readFileSync(join(KIT_ROOT, 'packages', name, 'package.json'), 'utf8')) as PackageJson).version
    expect(pkg.dependencies).toEqual({ '@automatos/look-kit': library('look-kit'), '@automatos/mascot': library('mascot') })
    expect(bundledPackages(THEME_ROOT).map((item) => item.name).sort()).toEqual(['@automatos/look-kit', '@automatos/mascot'])
  })

  it("has Play's dev dependencies, peers, engines and scripts, but the vendored SDK as its peer and its own build and pack", () => {
    expect(pkg.devDependencies).toEqual(play.devDependencies)
    expect(pkg.peerDependencies).toEqual({ ...play.peerDependencies, [SDK_NAME]: sdkPackage.version })
    expect(pkg.peerDependencies[SDK_NAME]).toBe('1.3.0')
    expect(pkg.engines).toEqual(play.engines)
    expect(pkg.scripts).toEqual({
      ...play.scripts,
      build: 'vite build',
      pack: 'automatos-theme check design . && automatos-theme pack . --out out',
    })
  })
})

describe('the build', () => {
  it('wraps every rule under html.hud', () => {
    expect(readThemeFile('vite.config.ts')).toContain(`automatosTheme({ htmlClass: '${String(manifest.htmlClass)}', wrap: 'html' })`)
  })

  it('declares CSS modules outside src/, so the package source holds only the theme', () => {
    expect(existsSync(join(THEME_ROOT, 'types', 'css-modules.d.ts'))).toBe(true)
  })

  it('imports only the host modules, the two kit libraries and its own src/, never another theme', () => {
    const imports = sourceScripts().flatMap((rel) => importSpecifiers(readSource(rel)).map((specifier) => ({ rel, specifier })))
    expect(imports.length).toBeGreaterThan(0)
    const refused = imports.filter(({ rel, specifier }) => (isRelative(specifier) ? leavesSource(rel, specifier) : !isAllowedBare(specifier)))
    expect(refused.map(({ rel, specifier }) => `${rel}: ${specifier}`)).toEqual([])
  })
})
