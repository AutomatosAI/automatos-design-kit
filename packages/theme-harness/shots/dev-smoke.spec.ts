/**
 * PRD-261 B-02i: `automatos-theme dev themes/play` serves the harness and /chat renders (dev-smoke.config.ts starts the
 * command). The page opens on /chat with the toolbar, as a developer opens it: the theme starts (the host's status and
 * the report the app publishes), the stage shows Play's own /chat page, and on it Auto says hello over the message
 * box, the screen Play's render-all test reads in jsdom. Every request goes to the dev server's origin. The page's
 * shot goes to the test's output folder.
 *
 * Then the phone view on PHONE_PATH (app/phone/page.tsx), which the dev server answers with the same page: for Play,
 * Automatos Go's built-in Play layout, so the view says so, draws Play's own /chat at the phone's width, and shows the
 * contrast panel beside it.
 */
import { expect, test } from '@playwright/test'
import { HTML_ATTRS } from '../src/host/prepaint.ts'
import {
  DEFAULT_SETTINGS, DEV_ORIGIN, HARNESS_GLOBAL, offOrigin, PHONE_PATH, settingsQuery, STAGE_ID, type HarnessReport,
} from '../src/host/router.ts'

const CHAT_PATH = '/chat'
const SETTLED_STATUSES: readonly string[] = ['active', 'failed']
/** The /chat screen as a member sees it (themes/play/test/harness/render-all.test.tsx SEEN). */
const SAY_HELLO = 'Say hello'
const MESSAGE_AUTO = 'Message Auto'
const SHOT = 'page-chat.png'
const PHONE_SHOT = 'phone.png'
const CONTRAST_HEADING = /^Contrast, as automatos-theme check measures it/

test('automatos-theme dev serves the harness, and /chat renders', async ({ page }, testInfo) => {
  const requests: string[] = []
  page.on('request', (request) => requests.push(request.url()))
  await page.goto(`/${settingsQuery({ ...DEFAULT_SETTINGS, path: CHAT_PATH })}`)
  await page.waitForFunction(
    ({ attribute, settled }) => settled.includes(document.documentElement.getAttribute(attribute) ?? ''),
    { attribute: HTML_ATTRS.status, settled: [...SETTLED_STATUSES] },
  )
  const published = await page.waitForFunction((name) => Reflect.get(window, name) as unknown, HARNESS_GLOBAL)
  const report = (await published.jsonValue()) as HarnessReport
  expect(report.status, 'Play started in the harness').toBe('active')
  const stage = page.locator(`#${STAGE_ID}`)
  await expect(stage).toHaveAttribute('data-harness-view', `page:${CHAT_PATH}`)
  await expect(stage.getByRole('region', { name: SAY_HELLO, exact: true })).toBeVisible()
  await expect(stage.getByRole('textbox', { name: MESSAGE_AUTO, exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath(SHOT) })
  expect(offOrigin(requests, DEV_ORIGIN), `every request went to ${DEV_ORIGIN}`).toEqual([])
})

test('automatos-theme dev serves the phone view, and Play is the built-in layout there', async ({ page }, testInfo) => {
  const requests: string[] = []
  page.on('request', (request) => requests.push(request.url()))
  await page.goto(PHONE_PATH)
  await expect(page.locator('[data-phone-mode]')).toHaveAttribute('data-phone-mode', 'built-in')
  await expect(page.locator('[data-phone-notice]')).toContainText('built-in Play layout')
  await expect(page.getByRole('heading', { name: CONTRAST_HEADING })).toBeVisible()
  const stage = page.locator(`#${STAGE_ID}`)
  await expect(stage).toHaveAttribute('data-harness-view', `page:${CHAT_PATH}`)
  await expect(stage.getByRole('textbox', { name: MESSAGE_AUTO, exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath(PHONE_SHOT) })
  expect(offOrigin(requests, DEV_ORIGIN), `every request went to ${DEV_ORIGIN}`).toEqual([])
})
