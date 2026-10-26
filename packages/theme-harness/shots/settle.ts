/**
 * How a shot waits for the harness page, shared by the regression shots (shots.spec.ts) and the showcase shots
 * (showcase.spec.ts): open an address and wait until the harness drew it (the host's status, the network idle, the
 * fonts and every image in; no fixed sleep), and read what the app published once the theme loaded (HARNESS_GLOBAL).
 */
import type { Page } from '@playwright/test'
import { HTML_ATTRS } from '../src/host/prepaint.ts'
import { HARNESS_GLOBAL, type HarnessReport } from '../src/host/router.ts'

const SETTLED_STATUSES: readonly string[] = ['active', 'failed']
/** How long the harness may take to settle one view before the test fails, naming the wait. */
const SETTLE_TIMEOUT_MS = 30_000
export const SETTLE = Object.freeze({ timeout: SETTLE_TIMEOUT_MS })

/**
 * Opens an address and waits until the harness drew it: the host's status, the network, the fonts, and every image,
 * a lazy one (loading="lazy", which an image below the fold never starts) asked for now, so the shot never races it.
 */
export async function openSettled(page: Page, address: string): Promise<void> {
  await page.goto(address)
  await page.waitForFunction(
    ({ attribute, settled }) => settled.includes(document.documentElement.getAttribute(attribute) ?? ''),
    { attribute: HTML_ATTRS.status, settled: [...SETTLED_STATUSES] },
    SETTLE,
  )
  await page.waitForLoadState('networkidle', SETTLE)
  await page.evaluate(async () => {
    await document.fonts.ready
    document.querySelectorAll<HTMLImageElement>('img[loading="lazy"]').forEach((image) => {
      image.loading = 'eager'
    })
  })
  await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete), undefined, SETTLE)
}

/** What the app published on HARNESS_GLOBAL once the theme loaded or failed. */
export async function harnessReport(page: Page): Promise<HarnessReport> {
  const handle = await page.waitForFunction((name) => Reflect.get(window, name) as unknown, HARNESS_GLOBAL, SETTLE)
  return (await handle.jsonValue()) as HarnessReport
}
