/**
 * PRD-261 B-02f: one PNG per slot, page and route the theme serves, for each of its presets at 1440 and 1024 px,
 * plus one set just below its minWidth (the host's own pages there), each scanned with axe.
 *
 * One test per preset and width (and one below minWidth), so a failure names its group: it opens the harness,
 * reads the views the app drew the theme with (HARNESS_GLOBAL), then for each view opens its address, waits until
 * the harness settled (the host's status, the network idle, the fonts and every image in; no fixed sleep), shoots
 * the page and scans the theme's stage. The folder gets <project>/<preset>/<width>/<view>.png and its axe.json.
 * The test fails when the theme did not start, when a view's PNG is missing, when any request went to another
 * origin than the harness's (every request is recorded), and on a critical axe violation (after every shot is
 * written, so the artefact holds them all).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { HTML_ATTRS } from '../src/host/prepaint.ts'
import {
  HARNESS_GLOBAL, HARNESS_ORIGIN, HOME_PATH, OUT_ENV, PRESET_SUFFIX, STAGE_ID, THEME_ENV, offOrigin, presetOrder, shotAddress,
  shotGroups, viewSlug, type HarnessReport, type ShotGroup, type View,
} from '../src/host/router.ts'
import { AXE_FILE, criticalViolations, scanShot, writeAxeReport, type ShotScan } from './axe.ts'

const VIEWPORT_HEIGHT = 900
const SHOT_SUFFIX = '.png'
const SETTLED_STATUSES: readonly string[] = ['active', 'failed']

function required(name: string): string {
  const value = process.env[name]
  if (value === undefined || value === '') throw new Error(`${name} is not set: run the shots with shots/playwright.config.ts.`)
  return value
}

/** The theme's shot groups, from its folder: its presets (looks/presets, default first) and its minWidth. */
function themeGroups(themeDir: string): ShotGroup[] {
  const manifest = JSON.parse(readFileSync(join(themeDir, 'theme.json'), 'utf8')) as { look?: unknown; minWidth?: unknown }
  const dir = join(themeDir, 'looks/presets')
  const ids = existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith(PRESET_SUFFIX)).map((name) => name.slice(0, -PRESET_SUFFIX.length)) : []
  const presets = presetOrder(ids, typeof manifest.look === 'string' ? manifest.look : undefined)
  return shotGroups(presets, typeof manifest.minWidth === 'number' ? manifest.minWidth : 0)
}

const OUT_DIR = required(OUT_ENV)
const GROUPS = themeGroups(required(THEME_ENV))

/** Every URL the page asks for, from now on. */
function recordRequests(page: Page): string[] {
  const urls: string[] = []
  page.on('request', (request) => urls.push(request.url()))
  return urls
}

/** Opens an address and waits until the harness drew it: the host's status, the network, the fonts, the images. */
async function openSettled(page: Page, address: string): Promise<void> {
  await page.goto(address)
  await page.waitForFunction(
    ({ attribute, settled }) => settled.includes(document.documentElement.getAttribute(attribute) ?? ''),
    { attribute: HTML_ATTRS.status, settled: [...SETTLED_STATUSES] },
  )
  await page.waitForLoadState('networkidle')
  await page.evaluate(async () => {
    await document.fonts.ready
  })
  await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete))
}

async function harnessReport(page: Page): Promise<HarnessReport> {
  const handle = await page.waitForFunction((name) => Reflect.get(window, name) as unknown, HARNESS_GLOBAL)
  return (await handle.jsonValue()) as HarnessReport
}

/** Shoots and scans every view, in order, into `folder`. */
async function shootViews(page: Page, group: ShotGroup, views: readonly View[], folder: string): Promise<ShotScan[]> {
  const scans: ShotScan[] = []
  for (const view of views) {
    await openSettled(page, shotAddress(group, view.path))
    await expect(page.locator(`#${STAGE_ID}`)).toHaveAttribute('data-harness-view', `${view.kind}:${view.key}`)
    const shot = `${viewSlug(view)}${SHOT_SUFFIX}`
    await page.screenshot({ path: join(folder, shot), animations: 'disabled', caret: 'hide' })
    scans.push(await scanShot(page, shot))
  }
  return scans
}

for (const group of GROUPS) {
  test(`${group.folder}: a shot and an axe scan of every slot, page and route`, async ({ page }, testInfo) => {
    const requests = recordRequests(page)
    await page.setViewportSize({ width: group.width, height: VIEWPORT_HEIGHT })
    await openSettled(page, shotAddress(group, HOME_PATH))
    const report = await harnessReport(page)
    expect(report.status, 'the theme started in the harness').toBe('active')
    expect(report.views.length, 'the theme serves a slot, page or route').toBeGreaterThan(0)
    const folder = join(OUT_DIR, testInfo.project.name, group.folder)
    mkdirSync(folder, { recursive: true })
    const scans = await shootViews(page, group, report.views, folder)
    writeAxeReport(join(folder, AXE_FILE), scans)
    const missing = report.views.map((view) => `${viewSlug(view)}${SHOT_SUFFIX}`).filter((shot) => !existsSync(join(folder, shot)))
    expect(missing, 'every view has its PNG').toEqual([])
    expect(offOrigin(requests), `every request went to ${HARNESS_ORIGIN}`).toEqual([])
    expect(criticalViolations(scans), 'no critical axe violation').toEqual([])
  })
}
