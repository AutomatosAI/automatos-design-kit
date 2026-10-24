// @vitest-environment node
// Play's source imports only what a theme can: its own files by relative path, the host's shared
// modules (React and the SDK), and the modules of the kit packages it bundles (PRD-261 B-01i: the ones its
// package.json names under dependencies, @automatos/look-kit and @automatos/mascot, as the vite-preset resolves
// them). Core-only modules are refused by name: the app's '@/' alias, Next.js, React Query, sonner and the API
// client. Play's tests, the ones moved from core included, refuse the same names: they run on the kit's harness
// (its fake SDK), never on core's modules. A static scan; nothing is built.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { bundledPackages, isSharedModule, packageModule } from '@automatos/vite-preset'
import { describe, expect, it } from 'vitest'
import { importSpecifiers, isRelative, readSource, sourceScripts, THEME_ROOT } from './source-files.ts'

const TEST_ROOT = join(THEME_ROOT, 'test')
/** The kit packages Play bundles, as its build finds them. */
const BUNDLED = bundledPackages(THEME_ROOT)
const SCRIPT_FILE = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/
/** Tests moved from core (test/moved-from-core/*.json names them), so the scan of test/ reads them too. */
const MOVED_TESTS: readonly string[] = [
  'mascot/pause.test.ts',
  'mascot/session.test.ts',
  'mascot/auto-mascot-pause.test.tsx',
  'lib/seen.test.ts',
  'lib/shelf.test.ts',
  'deliverables/play-shelf.test.tsx',
]

const BANNED: readonly { readonly name: string; readonly test: (specifier: string) => boolean }[] = [
  { name: "the app's @/ alias", test: (s) => s.startsWith('@/') },
  { name: 'Next.js', test: (s) => s === 'next' || s.startsWith('next/') },
  { name: 'React Query', test: (s) => s === '@tanstack/react-query' || s.startsWith('@tanstack/react-query/') },
  { name: 'sonner', test: (s) => s === 'sonner' || s.startsWith('sonner/') },
  { name: 'the API client', test: (s) => /(?:^|[/-])api-client(?:\.[cm]?[jt]sx?)?$/.test(s) },
]

/**
 * Each reason a specifier is refused: a banned module, a bare import the host doesn't share and no bundled package
 * has, or a module a bundled package doesn't have.
 */
function problems(specifier: string): string[] {
  const banned = BANNED.filter((rule) => rule.test(specifier)).map((rule) => `imports ${rule.name} ("${specifier}")`)
  if (banned.length > 0) return banned
  if (isRelative(specifier) || isSharedModule(specifier)) return []
  const bundled = packageModule(specifier, BUNDLED)
  if (bundled !== null) return 'problem' in bundled ? [bundled.problem] : []
  return [`imports "${specifier}", which is neither a file under src/, one of the host's shared modules nor a bundled kit package's`]
}

function fileProblems(rel: string): string[] {
  return importSpecifiers(readSource(rel)).flatMap((specifier) => problems(specifier).map((text) => `${rel} ${text}`))
}

/** Every script under test/, as a path relative to test/ with forward slashes. */
function testScripts(): string[] {
  return readdirSync(TEST_ROOT, { encoding: 'utf8', recursive: true })
    .map((rel) => rel.split('\\').join('/'))
    .filter((rel) => SCRIPT_FILE.test(rel))
    .sort()
}

/** Each core-only module a test file imports (a test may import its tools, so only the banned names count). */
function testFileProblems(rel: string): string[] {
  return importSpecifiers(readFileSync(join(TEST_ROOT, rel), 'utf8')).flatMap((specifier) =>
    BANNED.filter((rule) => rule.test(specifier)).map((rule) => `test/${rel} imports ${rule.name} ("${specifier}")`),
  )
}

describe('the import scan', () => {
  it('reads static, re-export, bare and dynamic imports', () => {
    const code = [
      "import { a } from './a'",
      "import type { B } from \"../b\"",
      "export { c } from './c'",
      "import './d.css'",
      "const e = import('./e')",
    ].join('\n')
    expect(importSpecifiers(code).sort()).toEqual(['../b', './a', './c', './d.css', './e'])
  })

  it.each([
    '@/lib/api-client',
    '@/components/x',
    'next/navigation',
    'next',
    '@tanstack/react-query',
    'sonner',
    '../../lib/api-client',
    'lucide-react',
    'zustand',
    'react-dom/server',
    '@automatos/vite-preset',
    '@automatos/look-kit/nope',
  ])('refuses %s', (specifier) => {
    expect(problems(specifier)).not.toEqual([])
  })

  it.each([
    'react',
    'react/jsx-runtime',
    'react-dom',
    'react-dom/client',
    '@automatos/theme-sdk',
    './x.module.css',
    '@automatos/look-kit/contrast',
    '@automatos/mascot/mascot-pause-button',
  ])(
    'allows %s',
    (specifier) => {
      expect(problems(specifier)).toEqual([])
    },
  )
})

describe("Play's source", () => {
  const scripts = sourceScripts()

  it('has the entry and the copied areas, the look runtime and the mascot core in the kit packages it bundles', () => {
    expect(scripts).toContain('entry.ts')
    const areas = ['components/play/', 'components/looks/', 'components/mascot/', 'lib/play/', 'lib/looks/', 'lib/mascot/', 'hooks/', 'stores/']
    areas.forEach((area) => expect(scripts.some((rel) => rel.startsWith(area))).toBe(true))
    expect(scripts.filter((rel) => rel.startsWith('lib/look-kit/'))).toEqual([])
    expect(BUNDLED.map((item) => item.name)).toEqual(['@automatos/look-kit', '@automatos/mascot'])
  })

  it("imports nothing but its own files, the host's shared modules and its bundled kit packages' modules", () => {
    expect(scripts.flatMap(fileProblems)).toEqual([])
  })

  it('ships no tests', () => {
    expect(scripts.filter((rel) => /(?:^|\/)__tests__\/|\.(?:test|spec)\.[jt]sx?$/.test(rel))).toEqual([])
  })
})

describe("Play's tests", () => {
  const scripts = testScripts()

  it('are read from every folder under test/, the tests moved from core included', () => {
    expect(scripts).toEqual(expect.arrayContaining([...MOVED_TESTS, 'imports.test.ts', 'setup.ts']))
  })

  it("import nothing of core's: no @/ alias, Next.js, React Query, sonner or the API client", () => {
    expect(scripts.flatMap(testFileProblems)).toEqual([])
  })
})
