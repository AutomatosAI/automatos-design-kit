// Arcade's tests run on the kit's harness preset (packages/theme-harness): jsdom, React, Testing Library and the
// jest-dom matchers, with @automatos/theme-sdk resolved to the harness's fake SDK, driven through
// @automatos/theme-harness/host. The harness's setup runs first, then the theme's own (test/setup.ts).
import { fileURLToPath } from 'node:url'
import { harnessTestConfig } from '@automatos/theme-harness/vitest-preset'
import { defineConfig } from 'vitest/config'

/** An absolute path for a file of this theme folder. */
const local = (path: string): string => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig(
  harnessTestConfig({
    setupFiles: [local('./test/setup.ts')],
    include: ['test/**/*.test.{ts,tsx}'],
  }),
)
