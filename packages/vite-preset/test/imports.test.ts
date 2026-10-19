/**
 * The bundle leaves exactly the import map's specifiers to the host, and refuses sonner, other
 * entry points of React or the SDK, and stylesheets imported as text.
 */
import type { UserConfig } from 'vite'
import { describe, expect, it } from 'vitest'
import { DEFAULT_ENTRY, presetConfig } from '../src/index.ts'
import { importRefusal, isSharedModule, SHARED_MODULES } from '../src/imports.ts'

/** core frontend/lib/theme-host/shared-modules.json `modules[].specifier`, in order. */
const IMPORT_MAP = ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@automatos/theme-sdk']

describe('the shared modules', () => {
  it('are exactly the import map specifiers', () => {
    expect(SHARED_MODULES).toEqual(IMPORT_MAP)
    IMPORT_MAP.forEach((specifier) => {
      expect(isSharedModule(specifier)).toBe(true)
      expect(importRefusal(specifier)).toBeNull()
    })
  })

  it('do not include sonner', () => {
    expect(isSharedModule('sonner')).toBe(false)
  })
})

describe('importRefusal', () => {
  it.each([
    ['sonner', /sonner/],
    ['sonner/dist/index.mjs', /notices/],
    ['react-dom/server', /shares only/],
    ['react/jsx-dev-runtime', /shares only/],
    ['@automatos/theme-sdk/internal', /shares only/],
    ['./theme.css?inline', /scope check/],
    ['./theme.module.css?raw', /scope check/],
    ['../styles/a.scss?url', /scope check/],
    ['./a.css?used&inline', /scope check/],
  ])('refuses %s', (source, reason) => {
    expect(importRefusal(source)).toMatch(reason)
  })

  it.each(['zustand', 'clsx', './frame.module.css', './theme.css', '../lib/look.ts', 'react-colorful', 'sonnet'])(
    'allows %s',
    (source) => {
      expect(importRefusal(source)).toBeNull()
    },
  )
})

describe('presetConfig', () => {
  const config = presetConfig({}, '/themes/hello', 'hello')
  const build: NonNullable<UserConfig['build']> = config.build ?? {}

  it('builds an ES library to dist/entry.js and dist/theme.css', () => {
    const lib = build.lib
    if (lib === false || lib === undefined) throw new Error('the preset must build a library')
    expect(lib.formats).toEqual(['es'])
    expect(lib.entry).toBe(`/themes/hello/${DEFAULT_ENTRY}`)
    expect(typeof lib.fileName === 'function' ? lib.fileName('es', 'entry') : lib.fileName).toBe('entry.js')
    expect(lib.cssFileName).toBe('theme')
    expect(build.outDir).toBe('dist')
    expect(build.cssCodeSplit).toBe(false)
    expect(build.sourcemap).toBe(false)
  })

  it('keeps every shared module external and nothing else', () => {
    const external = build.rolldownOptions?.external
    if (typeof external !== 'function') throw new Error('the preset must give rolldown an external function')
    IMPORT_MAP.forEach((specifier) => expect(external(specifier, undefined, false)).toBe(true))
    ;['sonner', 'zustand', 'react-dom/server', './entry.ts'].forEach((source) => {
      expect(external(source, undefined, false)).toBe(false)
    })
  })

  it("names CSS-module classes and keyframes '<htmlClass>-[local]-[hash]'", () => {
    const modules = config.css?.modules
    if (modules === false || modules === undefined) throw new Error('the preset must configure CSS modules')
    expect(modules.generateScopedName).toBe('hello-[local]-[hash:base64:5]')
  })

  it('compiles JSX for production React', () => {
    const oxc = config.oxc
    if (oxc === false || oxc === undefined || typeof oxc.jsx !== 'object') throw new Error('the preset must set oxc.jsx')
    expect(oxc.jsx).toMatchObject({ runtime: 'automatic', importSource: 'react', development: false })
  })
})
