/**
 * PRD-261 B-02e: the browser harness's import map. Read by vite.harness.config.ts (Node), not by the app.
 *
 * Core's host page maps a theme's bare imports to its own modules with an import map
 * (frontend/lib/theme-host/import-map.ts at 101a0bf33f64fb4f89af81b4293415be60b661ac, `THEME_IMPORT_MAP`, built from
 * shared-modules.json alone): React, its JSX runtime, react-dom, react-dom/client and @automatos/theme-sdk, each to
 * the host's own instance (host-modules.ts, which throws for a specifier it has no instance of). The harness maps
 * the same specifiers, in the same order (the vite-preset's SHARED_MODULES, which the preset leaves external for
 * exactly that map), to its own: React's modules from the kit's install, the one copy the harness draws with, and
 * @automatos/theme-sdk to the harness's fake SDK (src/sdk/index.ts), as core maps it to the real one. The build
 * reads the table as aliases (a bundler's import map), so the theme's src/entry.ts gets the harness's instances.
 */
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { SHARED_MODULES } from '@automatos/vite-preset'

/** core's ThemeImportMapTable, without the integrity block (the harness builds the theme itself). */
export interface HarnessImportMap {
  readonly imports: Readonly<Record<string, string>>
}

/** The fake SDK by its real path, so the app's own imports of it and the theme's are one module. */
export const HARNESS_SDK_ENTRY = realpathSync(fileURLToPath(new URL('../sdk/index.ts', import.meta.url)))

const SDK_SPECIFIER = '@automatos/theme-sdk'

/** The harness's module for each specifier it shares with a theme (host-modules.ts HOST_INSTANCES). */
const HOST_MODULES: Readonly<Record<string, string>> = Object.freeze({
  react: 'react',
  'react/jsx-runtime': 'react/jsx-runtime',
  'react-dom': 'react-dom',
  'react-dom/client': 'react-dom/client',
  [SDK_SPECIFIER]: HARNESS_SDK_ENTRY,
})

/** host-modules.ts hostInstance: the module for one specifier, or a throw naming the one it has none for. */
function hostModule(specifier: string): string {
  if (!Object.prototype.hasOwnProperty.call(HOST_MODULES, specifier)) {
    throw new Error(`Automatos theme harness: no module for "${specifier}".`)
  }
  return HOST_MODULES[specifier]
}

/** The map for `specifiers` (default: the preset's shared modules, in their order). */
export function harnessImportMap(specifiers: readonly string[] = SHARED_MODULES): HarnessImportMap {
  return Object.freeze({ imports: Object.freeze(Object.fromEntries(specifiers.map((name) => [name, hostModule(name)]))) })
}

export const HARNESS_IMPORT_MAP: HarnessImportMap = harnessImportMap()

export interface ImportAlias {
  readonly find: RegExp
  readonly replacement: string
}

const escaped = (text: string): string => text.replace(/[.*+?^${}()|[\]\\/]/g, (char) => `\\${char}`)

/**
 * The map as Vite aliases: each specifier that maps elsewhere, matched exactly (so `@automatos/theme-sdk/package.json`
 * stays the vendored package's, as in the vitest preset). A specifier mapped to itself needs no alias.
 */
export function importMapAliases(map: HarnessImportMap = HARNESS_IMPORT_MAP): ImportAlias[] {
  return Object.entries(map.imports)
    .filter(([specifier, target]) => specifier !== target)
    .map(([specifier, target]) => ({ find: new RegExp(`^${escaped(specifier)}$`), replacement: target }))
}

/** The package a bare specifier names: `@scope/name` or `name`. */
function packageName(specifier: string): string {
  const parts = specifier.split('/')
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

/** The packages the map leaves to the install, kept to one copy (Vite's resolve.dedupe). */
export function dedupedPackages(map: HarnessImportMap = HARNESS_IMPORT_MAP): string[] {
  const kept = Object.entries(map.imports).filter(([specifier, target]) => specifier === target).map(([specifier]) => packageName(specifier))
  return kept.filter((name, index) => kept.indexOf(name) === index)
}
