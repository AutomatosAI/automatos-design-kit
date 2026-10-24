/**
 * The phone view's shots, on Chromium. The web server is `automatos-theme dev fixtures/phone-skin` (the theme CLI's
 * own executable, by Node): a made-up theme whose theme.json has a `mobile` block (fixtures/README.md), served on
 * DEV_ORIGIN (127.0.0.1:4319), answering 503 until its build is in. phone-shots.spec.ts opens /phone there and shoots
 * the phone's Chat, Command Centre and First open in Light and in Dark, then the skin designer holding a draft with a
 * failing pair, each with an axe scan of the phone's screen. Kit CI's harness job runs it after the dev smoke, whose
 * server on the same port has stopped by then:
 *
 *   npx playwright test --config packages/theme-harness/shots/phone-shots.config.ts
 *
 * Its output folder, with the shots, their axe.json files and a failed test's trace, is <out>/phone/: the shots' out
 * folder (AUTOMATOS_HARNESS_OUT, default dist/shots), so the job's kit-harness artefact carries it, and Playwright
 * empties only that one folder of it. Every context asks for reduced motion, as the theme shots' do.
 */
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'
import { DEV_ORIGIN, OUT_ENV } from '../src/host/router.ts'
import { themeCli } from './theme-cli.ts'

const HARNESS_DIR = fileURLToPath(new URL('..', import.meta.url))
const SKIN_DIR = resolve(HARNESS_DIR, 'fixtures/phone-skin')
const DEFAULT_OUT_DIR = join(HARNESS_DIR, 'dist/shots')
/** The phone shots' own folder in the shots' out folder. */
const PHONE_FOLDER = 'phone'
/** Tall enough for the 868-pixel phone (its 844-point screen in its bezel) under the view's controls. */
const VIEWPORT = Object.freeze({ width: 1440, height: 1000 })
const TEST_TIMEOUT_MS = 120_000
const EXPECT_TIMEOUT_MS = 30_000
/** The command builds the harness before it serves: a cold CI runner's build, with room to spare. */
const SERVER_TIMEOUT_MS = 300_000

const OUT_DIR = join(resolve(process.env[OUT_ENV] ?? DEFAULT_OUT_DIR), PHONE_FOLDER)

const serve = [process.execPath, themeCli(), 'dev', SKIN_DIR].map((part) => JSON.stringify(part)).join(' ')

export default defineConfig({
  testDir: '.',
  testMatch: 'phone-shots.spec.ts',
  outputDir: OUT_DIR,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: TEST_TIMEOUT_MS,
  expect: { timeout: EXPECT_TIMEOUT_MS },
  reporter: process.env.CI ? [['list'], ['github']] : [['list']],
  use: {
    baseURL: DEV_ORIGIN,
    contextOptions: { reducedMotion: 'reduce' },
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
