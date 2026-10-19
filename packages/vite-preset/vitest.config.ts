import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // The build test runs a real Vite build; a cold CI runner needs more than the 5 s default.
    testTimeout: 60_000,
  },
})
