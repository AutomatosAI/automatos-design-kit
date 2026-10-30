// Candy's tests run on the kit's harness preset (packages/theme-harness): jsdom, React, Testing Library and the
// jest-dom matchers, with @automatos/theme-sdk resolved to the harness's fake SDK, driven through
// @automatos/theme-harness/host. The harness's setup runs first, then the theme's own (test/setup.ts). A test may take
// up to TEST_TIMEOUT_MS: the stills' rasteriser shares the machine with the rendering tests, and a busy runner slows both.
import { fileURLToPath } from 'node:url'
import { harnessTestConfig } from '@automatos/theme-harness/vitest-preset'
import { defineConfig } from 'vitest/config'

/** An absolute path for a file of this theme folder. */
const local = (path: string): string => fileURLToPath(new URL(path, import.meta.url))
const TEST_TIMEOUT_MS = 20_000

const harness = harnessTestConfig({
  setupFiles: [local('./test/setup.ts')],
  include: ['test/**/*.test.{ts,tsx}'],
})

export default defineConfig({ ...harness, test: { ...harness.test, testTimeout: TEST_TIMEOUT_MS } })
