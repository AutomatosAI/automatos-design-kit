/**
 * PRD-261 B-02f: one PNG per slot, page and route the theme serves, for each of its presets at 1440 and 1024 px,
 * plus one set just below its minWidth (the host's own pages there), each scanned with axe; for a theme with a
 * /chat page, that page with motion allowed and on the transcript (src/host/shot-groups.ts), into
 * `<preset>/1440-motion/` and `<preset>/1440-transcript/`; and for a theme whose minWidth fits a phone, each preset at
 * the phone's 390 × 844 (`<preset>/390/`, with the chat on the transcript in `<preset>/390-transcript/`); and for a theme
 * whose `uses` names the voice area, its voice states: the chat page (every view with none) on the transcript in each
 * phase of the host's made-up voice session, its words in the conversation, in `<preset>/1440-voice-<phase>/`.
 *
 * One test per group, so a failure names its group. The page is sized to the group's viewport (its width, and its
 * height: 900, or the phone's 844), so a theme's own media queries see the width the group shoots, as a browser that
 * size would. Each test opens the harness, reads the views the app drew the theme with (HARNESS_GLOBAL), then for
 * each view opens its address, waits until the harness settled (settle.ts: the host's status, the network idle, the
 * fonts and every image in; no fixed sleep), shoots the page and scans the theme's stage. The folder gets
 * <project>/<preset>/<width>/<view>.png and its axe.json. Every context asks for reduced motion (playwright.config.ts);
 * the motion group's page asks the browser for none instead.
 *
 * What a group must hold is read from the theme folder, not from the views the page drew: theme.json's slots, pages
 * and routes, less what the page reports the theme did not register, one file name each (router.ts expectedShots).
 * The test fails when the theme did not start, when the page's presets are not the folder's, when the folder's PNGs
 * are not exactly those files (one missing, one extra, or two views on one name), when any request went to another
 * origin than the harness's (every request is recorded), and on a critical axe violation (after every shot is
 * written, so the artefact holds them all). A theme.json naming a default look that looks/presets lacks fails the
 * whole run before a test starts.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import {
  HARNESS_ORIGIN, HOME_PATH, OUT_ENV, PRESET_SUFFIX, SHOT_SUFFIX, STAGE_ID, THEME_ENV, declaredIn, offOrigin, shotPresets, usesIn,
  viewSlug, type Served, type View,
} from '../src/host/router.ts'
import { groupShots, groupViews, shotAddress, shotGroups, type ShotGroup } from '../src/host/shot-groups.ts'
import { AXE_FILE, criticalViolations, scanShot, writeAxeReport, type ShotScan } from './axe.ts'
import { harnessReport, openSettled } from './settle.ts'

const MANIFEST_FILE = 'theme.json'
const PRESETS_DIR = 'looks/presets'

function required(name: string): string {
  const value = process.env[name]
  if (value === undefined || value === '') throw new Error(`${name} is not set: run the shots with shots/playwright.config.ts.`)
  return value
}

/** The theme folder as the shots read it, apart from the page. */
interface ThemeFolder {
  /** What theme.json declares. */
  readonly declared: Served
  /** looks/presets by id, the default look first. */
  readonly presets: readonly string[]
  readonly groups: readonly ShotGroup[]
}

/** The folder's theme.json and presets; a throw when theme.json names a default look with no preset file. */
function readThemeFolder(themeDir: string): ThemeFolder {
  const manifest = JSON.parse(readFileSync(join(themeDir, MANIFEST_FILE), 'utf8')) as { look?: unknown; minWidth?: unknown }
  const dir = join(themeDir, PRESETS_DIR)
  const ids = existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith(PRESET_SUFFIX)).map((name) => name.slice(0, -PRESET_SUFFIX.length)) : []
  const presets = shotPresets(ids, typeof manifest.look === 'string' ? manifest.look : undefined)
  const declared = declaredIn(manifest)
  const groups = shotGroups(presets, typeof manifest.minWidth === 'number' ? manifest.minWidth : 0, declared.pages, usesIn(manifest))
  return { declared, presets, groups }
}

const OUT_DIR = required(OUT_ENV)
const THEME = readThemeFolder(required(THEME_ENV))

/** Every URL the page asks for, from now on. */
function recordRequests(page: Page): string[] {
  const urls: string[] = []
  page.on('request', (request) => urls.push(request.url()))
  return urls
}

/** The folder a group's files go to, emptied first, so a file an earlier run wrote can't stand in for a missing one. */
function freshFolder(...parts: readonly string[]): string {
  const folder = join(OUT_DIR, ...parts)
  rmSync(folder, { recursive: true, force: true })
  mkdirSync(folder, { recursive: true })
  return folder
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

/** What a group shoots, for its test's title. */
function groupSubject(group: ShotGroup): string {
  if (group.voice !== undefined) return `${group.page ?? 'every slot, page and route'} on the transcript with the voice ${group.voice}`
  if (group.page === null) return 'every slot, page and route'
  if (group.transcript) return `${group.page} on the transcript`
  return group.reducedMotion ? group.page : `${group.page} with motion allowed`
}

for (const group of THEME.groups) {
  test(`${group.folder}: a shot and an axe scan of ${groupSubject(group)}`, async ({ page }, testInfo) => {
    const requests = recordRequests(page)
    if (!group.reducedMotion) await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.setViewportSize({ width: group.width, height: group.height })
    await openSettled(page, shotAddress(group, HOME_PATH))
    const report = await harnessReport(page)
    expect(report.status, 'the theme started in the harness').toBe('active')
    expect(report.presets, "the page serves the folder's presets, the default look first").toEqual(THEME.presets)
    const expected = groupShots(group, THEME.declared, report.missing)
    if (group.page === null) expect(expected.length, 'the theme serves a slot, page or route').toBeGreaterThan(0)
    const folder = freshFolder(testInfo.project.name, group.folder)
    const scans = await shootViews(page, group, groupViews(group, report.views), folder)
    writeAxeReport(join(folder, AXE_FILE), scans)
    const written = readdirSync(folder).filter((name) => name.endsWith(SHOT_SUFFIX)).sort()
    expect(written, 'one PNG per slot, page and route theme.json declares and the theme registered').toEqual([...expected].sort())
    expect(offOrigin(requests), `every request went to ${HARNESS_ORIGIN}`).toEqual([])
    expect(criticalViolations(scans), 'no critical axe violation').toEqual([])
  })
}
