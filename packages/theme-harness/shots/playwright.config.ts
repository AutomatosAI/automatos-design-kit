/**
 * PRD-261 B-02f: the harness shots, on Chromium and WebKit. `automatos-theme shots <theme folder>` builds the
 * harness for the folder (vite.harness.config.ts), then runs this config with AUTOMATOS_HARNESS_THEME and
 * AUTOMATOS_HARNESS_OUT set; run alone, it draws themes/play into packages/theme-harness/dist/shots.
 *
 * The web server is `vite preview` over the built harness on 127.0.0.1:4318, the one origin every request must go
 * to. Every context asks for reduced motion (the shots' first rule of determinism, with Playwright's own
 * `animations: 'disabled'`), and no test is retried: a flaky shot shows as red.
 */
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'
import { HARNESS_ORIGIN, OUT_ENV, THEME_ENV } from '../src/host/router.ts'

const HARNESS_DIR = fileURLToPath(new URL('..', import.meta.url))
const DEFAULT_THEME_DIR = resolve(HARNESS_DIR, '../../themes/play')
const DEFAULT_OUT_DIR = join(HARNESS_DIR, 'dist/shots')
const HARNESS_CONFIG = join(HARNESS_DIR, 'vite.harness.config.ts')
/** The default viewport; each test sets the width it shoots at. */
const VIEWPORT = Object.freeze({ width: 1440, height: 900 })
/** One test shoots and scans every view of one preset at one width. */
const TEST_TIMEOUT_MS = 300_000
const EXPECT_TIMEOUT_MS = 15_000
const SERVER_TIMEOUT_MS = 60_000
const WORKERS = 2

// The spec and the web server read the folders from the environment; set here, so a run without the CLI has them.
process.env[THEME_ENV] = resolve(process.env[THEME_ENV] ?? DEFAULT_THEME_DIR)
const OUT_DIR = resolve(process.env[OUT_ENV] ?? DEFAULT_OUT_DIR)
process.env[OUT_ENV] = OUT_DIR
/** A failed test's trace, in the out folder, so the artefact carries it beside the shots. */
const RESULTS_DIR = join(OUT_DIR, 'test-results')

/** Vite's command line, from the kit's install. */
function viteBin(): string {
  const require = createRequire(import.meta.url)
  const manifest = require.resolve('vite/package.json')
  const { bin } = require('vite/package.json') as { readonly bin: { readonly vite: string } }
  return join(dirname(manifest), bin.vite)
}

const serve = [process.execPath, viteBin(), 'preview', '--config', HARNESS_CONFIG].map((part) => JSON.stringify(part)).join(' ')

export default defineConfig({
  testDir: '.',
  testMatch: 'shots.spec.ts',
  outputDir: RESULTS_DIR,
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: WORKERS,
  timeout: TEST_TIMEOUT_MS,
  expect: { timeout: EXPECT_TIMEOUT_MS },
  reporter: process.env.CI ? [['list'], ['github']] : [['list']],
  use: {
    baseURL: HARNESS_ORIGIN,
    contextOptions: { reducedMotion: 'reduce' },
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: VIEWPORT } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: VIEWPORT } },
  ],
  webServer: {
    command: serve,
    cwd: HARNESS_DIR,
    url: HARNESS_ORIGIN,
    reuseExistingServer: false,
    timeout: SERVER_TIMEOUT_MS,
    stdout: 'pipe',
  },
})
