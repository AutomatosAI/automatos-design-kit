// The look runtime's tests run in node: colour math and file reads. They hold the runtime to Play's catalogue,
// presets and stylesheet (themes/play, the kit's reference theme), as they did among Play's own tests.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
})
