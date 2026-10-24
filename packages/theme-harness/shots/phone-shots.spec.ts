/**
 * The phone view's shots (phone-shots.config.ts serves the made-up phone skin with `automatos-theme dev`): /phone draws
 * the theme as Automatos Go draws its theme.json `mobile` block, on the app's Studio layout, beside the block's
 * contrast as `check` measures it and the skin designer.
 *
 * One test per scheme opens Chat, the Command Centre and First open in turn, by the phone view's address
 * (src/phone/settings.ts), waits until the screen is drawn (the view's mode, the screen and scheme it says it drew, the
 * network idle, the fonts and every image in; no fixed sleep), shoots the phone and scans the phone's screen with axe
 * (the panels beside it are the harness's, as the toolbar is in the theme shots). The folder gets
 * <scheme>/<screen>.png and its axe.json. It fails when the phone does not paint the skin, when the scheme's pairs
 * are not measured and passing, when the designer would not offer the theme's own block as skin.json, when First open
 * does not show the theme's still of Auto, when the folder's PNGs are not exactly the three screens, when any request
 * left DEV_ORIGIN, and on a critical axe violation (after every shot is written).
 *
 * Then the skin designer, holding a draft of the block (in the address) whose muted text is too faint on its fill:
 * the contrast panel fails that pair and offers its nearest passing value, and the export names the reasons and gives
 * no file. The whole page is shot as designer/failing-pair.png, with the phone's axe scan in designer/axe.json.
 */
import { mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { DEV_ORIGIN, offOrigin, PHONE_PATH, SHOT_SUFFIX } from '../src/host/router.ts'
import { AXE_FILE, criticalViolations, scanShot, writeAxeReport, type ShotScan } from './axe.ts'

const SKIN_MANIFEST = fileURLToPath(new URL('../fixtures/phone-skin/theme.json', import.meta.url))
/** src/phone/settings.ts: the screens, the schemes and the address's names for them and for the designer's draft. */
const SCREENS = ['chat', 'command-centre', 'first-open'] as const
const SCHEMES = ['light', 'dark'] as const
const PARAMS = Object.freeze({ screen: 'screen', scheme: 'scheme', skin: 'skin' })
const FIRST_OPEN = 'first-open'
/** The phone (app/phone/frame.tsx): what the shots photograph and axe scans. */
const PHONE = '[data-phone-frame]'
const CONTRAST_PANEL = 'section[aria-labelledby="phone-contrast-heading"]'
const DESIGNER_FOLDER = 'designer'
const DESIGNER_SHOT = `failing-pair${SHOT_SUFFIX}`
/** The pair the designer's draft breaks: muted text on its muted fill (1.57:1 against 4.5:1). */
const FAILING = Object.freeze({ token: '--muted-foreground', background: '--muted', value: '40 12% 72%' })
const SETTLE = Object.freeze({ timeout: 30_000 })
const SHOT_OPTIONS = Object.freeze({ animations: 'disabled', caret: 'hide' } as const)

type Scheme = (typeof SCHEMES)[number]
type Screen = (typeof SCREENS)[number]
type Colours = Readonly<Record<string, string>>

/** The fixture's `mobile` block, as theme.json holds it. */
interface SkinBlock {
  readonly tokens: { readonly light: Colours; readonly dark: Colours }
  readonly mascot: string
}

function skinBlock(): SkinBlock {
  const manifest = JSON.parse(readFileSync(SKIN_MANIFEST, 'utf8')) as { readonly mobile: SkinBlock }
  return manifest.mobile
}

/** The phone view's address for a screen and scheme, with the designer's draft when one is given. */
function phoneAddress(screen: Screen, scheme: Scheme, draft?: unknown): string {
  const params = new URLSearchParams({ [PARAMS.screen]: screen, [PARAMS.scheme]: scheme })
  if (draft !== undefined) params.set(PARAMS.skin, JSON.stringify(draft))
  return `${PHONE_PATH}?${params.toString()}`
}

/** Every URL the page asks for, from now on. */
function recordRequests(page: Page): string[] {
  const urls: string[] = []
  page.on('request', (request) => urls.push(request.url()))
  return urls
}

/** The folder a test's files go to, emptied first, so a file an earlier run wrote can't stand in for a missing one. */
function freshFolder(outDir: string, name: string): string {
  const folder = join(outDir, name)
  rmSync(folder, { recursive: true, force: true })
  mkdirSync(folder, { recursive: true })
  return folder
}

const pngsIn = (folder: string): string[] => readdirSync(folder).filter((name) => name.endsWith(SHOT_SUFFIX)).sort()
const contrastPanel = (page: Page): Locator => page.locator(CONTRAST_PANEL)

/** Opens the phone view and waits until it drew the skin on the screen and scheme asked for, every font and image in. */
async function openPhone(page: Page, address: string, screen: Screen, scheme: Scheme): Promise<void> {
  await page.goto(address)
  await expect(page.locator('main[data-phone-mode]')).toHaveAttribute('data-phone-mode', 'skin')
  const drawn = page.locator('[data-go-screen]')
  await expect(drawn).toHaveAttribute('data-go-screen', screen)
  await expect(drawn).toHaveAttribute('data-go-scheme', scheme)
  await page.waitForLoadState('networkidle', SETTLE)
  await page.evaluate(async () => {
    await document.fonts.ready
  })
  await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete), undefined, SETTLE)
}

/** Shoots and scans the phone on each screen of one scheme, into `folder`. */
async function shootScreens(page: Page, scheme: Scheme, folder: string): Promise<ShotScan[]> {
  const scans: ShotScan[] = []
  for (const screen of SCREENS) {
    await openPhone(page, phoneAddress(screen, scheme), screen, scheme)
    if (screen === FIRST_OPEN) await expect(page.locator('[data-go-mascot]')).toHaveAttribute('data-go-mascot', 'still')
    const shot = `${screen}${SHOT_SUFFIX}`
    await page.locator(PHONE).screenshot({ path: join(folder, shot), ...SHOT_OPTIONS })
    scans.push(await scanShot(page, shot, PHONE))
  }
  return scans
}

for (const scheme of SCHEMES) {
  test(`the phone paints the skin on Chat, the Command Centre and First open, ${scheme}`, async ({ page }, testInfo) => {
    const requests = recordRequests(page)
    const folder = freshFolder(testInfo.project.outputDir, scheme)
    const scans = await shootScreens(page, scheme, folder)
    writeAxeReport(join(folder, AXE_FILE), scans)
    await expect(page.locator('[data-phone-notice]')).toContainText("paints this theme's mobile block (tokens)")
    await expect(contrastPanel(page)).toHaveAttribute('data-outcome', 'pass')
    await expect(page.getByRole('table', { name: `The pairs of mobile.tokens.${scheme}`, exact: true })).toBeVisible()
    await expect(page.locator('[data-skin-export]')).toHaveAttribute('data-skin-export', 'ready')
    expect(pngsIn(folder), 'one PNG per screen').toEqual(SCREENS.map((screen) => `${screen}${SHOT_SUFFIX}`).sort())
    expect(offOrigin(requests, DEV_ORIGIN), `every request went to ${DEV_ORIGIN}`).toEqual([])
    expect(criticalViolations(scans), 'no critical axe violation').toEqual([])
  })
}

test('the skin designer shows a failing pair with its nearest passing fix, and offers no file', async ({ page }, testInfo) => {
  const requests = recordRequests(page)
  const folder = freshFolder(testInfo.project.outputDir, DESIGNER_FOLDER)
  const { tokens, mascot } = skinBlock()
  const draft = { source: 'tokens', light: { ...tokens.light, [FAILING.token]: FAILING.value }, dark: tokens.dark, fonts: {}, mascot }
  await openPhone(page, phoneAddress('chat', 'light', draft), 'chat', 'light')
  await expect(page.locator('[data-skin-designer]')).toHaveAttribute('data-skin-designer', 'edited')
  await expect(page.getByRole('textbox', { name: `${FAILING.token} value`, exact: true })).toHaveValue(FAILING.value)
  await expect(contrastPanel(page)).toHaveAttribute('data-outcome', 'fail')
  const pair = contrastPanel(page).locator(`tr[data-pair="${FAILING.token} on ${FAILING.background}"]`)
  await expect(pair).toHaveAttribute('data-status', 'fail')
  // The button's name ends in the computed value (contrast-panel.tsx fixLabel), so it is matched from its start.
  const fix = new RegExp(`^Nearest passing for ${FAILING.token} on ${FAILING.background}: \\S`)
  await expect(pair.getByRole('button', { name: fix })).toBeVisible()
  await expect(page.locator('[data-skin-export]')).toHaveAttribute('data-skin-export', 'refused')
  await page.screenshot({ path: join(folder, DESIGNER_SHOT), fullPage: true, ...SHOT_OPTIONS })
  const scans = [await scanShot(page, DESIGNER_SHOT, PHONE)]
  writeAxeReport(join(folder, AXE_FILE), scans)
  expect(pngsIn(folder)).toEqual([DESIGNER_SHOT])
  expect(offOrigin(requests, DEV_ORIGIN), `every request went to ${DEV_ORIGIN}`).toEqual([])
  expect(criticalViolations(scans), 'no critical axe violation').toEqual([])
})
