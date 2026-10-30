/**
 * The showcase shots, on Chromium (src/host/showcase.ts has the plan): clean images of HUD, Play and Arcade for
 * READMEs, docs, the product site and the listings' previews. Its web servers are `automatos-theme dev` (the theme CLI's
 * own executable, by Node) over themes/hud, themes/play and themes/arcade, one each on its own port (SHOWCASE_PORTS),
 * each answering 503 until its build is in.
 * showcase.spec.ts opens each shot's address on its theme's server. Kit CI's harness job runs it after the phone shots,
 * whose server on 4319 has stopped by then:
 *
 *   npx playwright test --config packages/theme-harness/shots/showcase.config.ts
 *
 * Every context asks for reduced motion, as the regression shots' do, at twice the pixel density (SHOWCASE_SCALE), in a
 * fixed time zone and locale; the spec fixes the clock. One project, Chromium: the regression shots cover WebKit and
 * the axe scans. The PNGs go to the harness's dist/showcase/ (SHOWCASE_FOLDER), which the job uploads as kit-showcase;
 * Playwright's own output (a failed test's trace) to its test-results/ folder, so the upload carries that too, and
 * Playwright empties only that folder.
 */
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'
import {
  SHOWCASE_DESKTOP, SHOWCASE_FOLDER, SHOWCASE_LOCALE, SHOWCASE_PORTS, SHOWCASE_SCALE, SHOWCASE_THEMES, SHOWCASE_TIMEZONE, showcaseOrigin,
  type ShowcaseTheme,
} from '../src/host/showcase.ts'
import { themeCli } from './theme-cli.ts'

const HARNESS_DIR = fileURLToPath(new URL('..', import.meta.url))
const THEMES_DIR = resolve(HARNESS_DIR, '../../themes')
const RESULTS_DIR = join(HARNESS_DIR, SHOWCASE_FOLDER, 'test-results')
/** The default viewport; each test sizes the page to its shot's (the phone's 390 × 844 too). */
const VIEWPORT = SHOWCASE_DESKTOP
const TEST_TIMEOUT_MS = 120_000
const EXPECT_TIMEOUT_MS = 30_000
/** Each command builds the harness before it serves, both at once: a cold CI runner's builds, with room to spare. */
const SERVER_TIMEOUT_MS = 300_000
const WORKERS = 2

/** `automatos-theme dev <theme> --port <its port>`, for one theme. */
function serve(theme: ShowcaseTheme) {
  const command = [process.execPath, themeCli(), 'dev', join(THEMES_DIR, theme), '--port', String(SHOWCASE_PORTS[theme])]
  return {
    command: command.map((part) => JSON.stringify(part)).join(' '),
    cwd: HARNESS_DIR,
    url: showcaseOrigin(theme),
    reuseExistingServer: false,
    timeout: SERVER_TIMEOUT_MS,
    stdout: 'pipe' as const,
  }
}

export default defineConfig({
  testDir: '.',
  testMatch: 'showcase.spec.ts',
  outputDir: RESULTS_DIR,
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: WORKERS,
  timeout: TEST_TIMEOUT_MS,
  expect: { timeout: EXPECT_TIMEOUT_MS },
  reporter: process.env.CI ? [['list'], ['github']] : [['list']],
  use: {
    contextOptions: { reducedMotion: 'reduce' },
    timezoneId: SHOWCASE_TIMEZONE,
    locale: SHOWCASE_LOCALE,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: VIEWPORT, deviceScaleFactor: SHOWCASE_SCALE } }],
  webServer: SHOWCASE_THEMES.map(serve),
})
