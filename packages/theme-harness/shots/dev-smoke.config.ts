/**
 * PRD-261 B-02i: the smoke of `automatos-theme dev`, on Chromium. The web server is the command itself,
 * `automatos-theme dev themes/play` (the theme CLI's own executable, by Node), which builds the harness for Play and
 * serves it on DEV_ORIGIN (127.0.0.1:4319), answering 503 until that build is in; dev-smoke.spec.ts opens /chat there.
 * Kit CI's harness job runs it after the shots, so Play's look data is built and the browsers are installed:
 *
 *   npx playwright test --config packages/theme-harness/shots/dev-smoke.config.ts
 *
 * Apart from shots/playwright.config.ts, which `automatos-theme shots` runs over any theme folder: this one is Play's
 * alone. Its output folder, with the page's shot and a failed test's trace, is <out>/dev-smoke/: the shots' out folder
 * (AUTOMATOS_HARNESS_OUT, default dist/shots), so the job's kit-harness artefact carries it, and Playwright empties
 * only that one folder of it.
 */
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'
import { DEV_ORIGIN, OUT_ENV } from '../src/host/router.ts'
import { themeCli } from './theme-cli.ts'

const HARNESS_DIR = fileURLToPath(new URL('..', import.meta.url))
const PLAY_DIR = resolve(HARNESS_DIR, '../../themes/play')
const DEFAULT_OUT_DIR = join(HARNESS_DIR, 'dist/shots')
/** The smoke's own folder in the shots' out folder. */
const SMOKE_FOLDER = 'dev-smoke'
const VIEWPORT = Object.freeze({ width: 1440, height: 900 })
const TEST_TIMEOUT_MS = 120_000
const EXPECT_TIMEOUT_MS = 30_000
/** The command builds the harness before it serves: a cold CI runner's build, with room to spare. */
const SERVER_TIMEOUT_MS = 300_000

const OUT_DIR = join(resolve(process.env[OUT_ENV] ?? DEFAULT_OUT_DIR), SMOKE_FOLDER)

const serve = [process.execPath, themeCli(), 'dev', PLAY_DIR].map((part) => JSON.stringify(part)).join(' ')

export default defineConfig({
  testDir: '.',
  testMatch: 'dev-smoke.spec.ts',
  outputDir: OUT_DIR,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: TEST_TIMEOUT_MS,
  expect: { timeout: EXPECT_TIMEOUT_MS },
  reporter: process.env.CI ? [['list'], ['github']] : [['list']],
  use: {
    baseURL: DEV_ORIGIN,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: VIEWPORT } }],
  webServer: {
    command: serve,
    cwd: HARNESS_DIR,
    url: DEV_ORIGIN,
    reuseExistingServer: false,
    timeout: SERVER_TIMEOUT_MS,
    stdout: 'pipe',
  },
})
