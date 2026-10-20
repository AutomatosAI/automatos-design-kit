/**
 * PRD-261 B-02a: the vitest config a theme's tests run under, so they need no Automatos host.
 *
 * - jsdom for every test file; a file that only reads files names the node environment in its own
 *   header comment instead (vitest's per-file environment comment).
 * - React's automatic JSX runtime, as the vite-preset builds the theme.
 * - The harness's setup (src/setup.ts) first, then the theme's own setup files.
 * - `@automatos/theme-sdk` resolved to `sdk` when given: the host serves the real SDK only at run time,
 *   and the kit vendors its types alone, so a theme's tests import a stand-in under the SDK's name.
 *
 * `vitest.config.ts` in a theme folder:
 * `export default defineConfig(harnessTestConfig({ sdk: <stand-in path>, setupFiles: [<own setup>] }))`.
 */
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

export interface HarnessOptions {
  /** Absolute path of the module the tests get for `@automatos/theme-sdk`; left out, the name is not aliased. */
  readonly sdk?: string
  /** The theme's own setup files (absolute paths), run after the harness's. */
  readonly setupFiles?: readonly string[]
  /** Test file globs, relative to the theme folder. Default DEFAULT_INCLUDE. */
  readonly include?: readonly string[]
}

/** The vitest config for a theme's tests. */
export function harnessTestConfig(options: HarnessOptions = {}): ViteUserConfig {
  const alias = options.sdk === undefined ? {} : { [SDK_MODULE]: options.sdk }
  return {
    resolve: { alias },
    oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
    test: {
      environment: HARNESS_ENVIRONMENT,
      include: [...(options.include ?? DEFAULT_INCLUDE)],
      setupFiles: [HARNESS_SETUP, ...(options.setupFiles ?? [])],
    },
  }
}
