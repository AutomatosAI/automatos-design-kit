// HUD's tests run on the kit's harness preset (packages/theme-harness): jsdom by default, with React, Testing
// Library and the jest-dom matchers; a test that only reads files names the node environment in its header. The
// harness's setup runs first, then HUD's own (test/setup.ts). The host serves @automatos/theme-sdk at run time,
// so the tests get the harness's fake SDK, driven through @automatos/theme-harness/host. The tests never load
// the vite preset's build, so this config stands in for vite.config.ts.
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
