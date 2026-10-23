/**
 * PRD-261 B-02a: the vitest config a theme's tests run under, so they need no Automatos host.
 *
 * - jsdom for every test file; a file that only reads files names the node environment in its own
 *   header comment instead (vitest's per-file environment comment).
 * - React's automatic JSX runtime, as the vite-preset builds the theme.
 * - The harness's setup (src/setup.ts) and its network refusal (src/no-network.ts, B-02b) first, then the
 *   theme's own setup files.
 * - `@automatos/theme-sdk` resolved to the harness's fake SDK (src/sdk/index.ts, B-02b), or to `sdk` when
 *   given: the host serves the real SDK only at run time, and the kit vendors its types alone. Only the bare
 *   name is aliased, so `@automatos/theme-sdk/package.json` is still the vendored package's.
 *
 * `vitest.config.ts` in a theme folder: `export default defineConfig(harnessTestConfig({ setupFiles: [<own setup>] }))`;
 * a test drives the fake host through `@automatos/theme-harness/host`.
 */
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { ViteUserConfig } from 'vitest/config'

/** The module a theme imports from the host. */
export const SDK_MODULE = '@automatos/theme-sdk'
/** The environment a test file gets unless its header names another. */
export const HARNESS_ENVIRONMENT = 'jsdom'
/** Every test file under the theme's test/ folder. */
export const DEFAULT_INCLUDE: readonly string[] = ['test/**/*.test.{ts,tsx}']
/** The harness's own setup, run before the theme's. */
export const HARNESS_SETUP = fileURLToPath(new URL('./setup.ts', import.meta.url))
/**
 * A file of the harness by its real path. A theme reaches the harness through its workspace link
 * (node_modules/@automatos/theme-harness), and its tests import @automatos/theme-harness/host, which resolves
 * to the real path: the fake SDK and the network refusal must be those same modules, not a second copy.
 */
const harnessFile = (rel: string): string => realpathSync(fileURLToPath(new URL(rel, import.meta.url)))

/** The harness's network refusal, run after its setup and before the theme's (B-02b). */
export const HARNESS_NO_NETWORK = harnessFile('./no-network.ts')
/** The harness's fake of the SDK, what the tests get for SDK_MODULE unless `sdk` names another (B-02b). */
export const HARNESS_SDK = harnessFile('./sdk/index.ts')

/** SDK_MODULE itself, not a path under it. */
const SDK_SPECIFIER = new RegExp(`^${SDK_MODULE.replace(/[/.]/g, (char) => `\\${char}`)}$`)

export interface HarnessOptions {
  /** Absolute path of the module the tests get for `@automatos/theme-sdk`; left out, the harness's fake SDK. */
  readonly sdk?: string
  /** The theme's own setup files (absolute paths), run after the harness's. */
  readonly setupFiles?: readonly string[]
  /** Test file globs, relative to the theme folder. Default DEFAULT_INCLUDE. */
  readonly include?: readonly string[]
}

/** The vitest config for a theme's tests. */
export function harnessTestConfig(options: HarnessOptions = {}): ViteUserConfig {
  return {
    resolve: { alias: [{ find: SDK_SPECIFIER, replacement: options.sdk ?? HARNESS_SDK }] },
    oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
    test: {
      environment: HARNESS_ENVIRONMENT,
      include: [...(options.include ?? DEFAULT_INCLUDE)],
      setupFiles: [HARNESS_SETUP, HARNESS_NO_NETWORK, ...(options.setupFiles ?? [])],
    },
  }
}
