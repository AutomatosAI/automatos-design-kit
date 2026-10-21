// The harness's own tests run under its preset, as a theme's do.
import { defineConfig } from 'vitest/config'
import { harnessTestConfig } from './src/vitest-preset.ts'

export default defineConfig(harnessTestConfig())
