// The mascot's tests run on the kit's harness preset (packages/theme-harness), as a theme's do: jsdom with React and
// Testing Library, and the harness's fake SDK for @automatos/theme-sdk (media.ts asks it for the clips' URLs). A test
// that only computes names the node environment in its header. Several read Play's files (themes/play), the kit's
// reference theme, as they did among Play's own tests.
import { harnessTestConfig } from '@automatos/theme-harness/vitest-preset'
import { defineConfig } from 'vitest/config'

export default defineConfig(harnessTestConfig())
