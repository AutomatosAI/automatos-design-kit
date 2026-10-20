// Play's own tests read files (the theme's source, theme.json, the stylesheets and the assets) and run
// the few pure modules that need no host; they never load the vite preset's build, so this config
// stands in for vite.config.ts. The host serves @automatos/theme-sdk at run time, so the tests get a
// stand-in (test/sdk-stub.ts).
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@automatos/theme-sdk': fileURLToPath(new URL('./test/sdk-stub.ts', import.meta.url)),
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
})
