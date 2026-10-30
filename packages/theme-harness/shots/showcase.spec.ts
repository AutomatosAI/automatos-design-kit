/**
 * The showcase shots (showcase.config.ts serves HUD, Play and Arcade with `automatos-theme dev`; src/host/showcase.ts has the
 * plan): one test per image, so a failure names its file.
 *
 * Each test fixes the page's clock (SHOWCASE_TIME), sizes the page to its shot's viewport, opens the shot's address on
 * its theme's server (the hosted edition, its look, its conversation and voice phase, no toolbar) and waits until the
 * harness settled (settle.ts). It fails when the theme did not start, when the theme has no preset of the shot's look
 * (the harness would draw its default look under the shot's name), when the stage is not on the shot's view, when
 * core's first-run nudge is on the page (the hosted edition draws none), when the voice phase it asks for is not on the
 * host's voice button, when a heading the shot names is not shown, and when a shot after Play's hello (the demo extra
 * `hello-played`) still shows "Hi, I'm Auto." anywhere. A shot whose step opens the phone menu presses
 * the theme's Menu button and waits for its dialog; one that opens the suggestion presses the title on the line pinned
 * above the message box ("Open: <title>") and waits for the full card ("Auto suggests: <title>"); one that asks for an
 * approval types APPROVAL_ASK into the theme's message box (the shot's `composer`), sends it with Enter and waits for
 * the host's approval card the recorded answer raises (the demo extra `approval-turn`). Then it writes `<theme>-<width>-<what>-<look>.png` into
 * dist/showcase/ (Playwright makes the folder): the viewport as drawn, with animations off and the caret hidden. The
 * host's Auto widget stand-in (a labelled box where core draws its floating Auto) is hidden for the shot, since no host
 * draws that box.
 */
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
import { DEFAULT_SETTINGS, STAGE_ID } from '../src/host/router.ts'
import {
  APPROVAL_ASK, PLAY_HELLO, SHOWCASE_FOLDER, SHOWCASE_SHOTS, SHOWCASE_TIME, showcaseFile, showcaseUrl, type ShowcaseShot,
} from '../src/host/showcase.ts'
import { harnessReport, openSettled, SETTLE } from './settle.ts'

const OUT_DIR = join(fileURLToPath(new URL('..', import.meta.url)), SHOWCASE_FOLDER)
const NUDGE = '[data-protected-surface="first-run-nudge"]'
/** The harness's stand-in for core's floating Auto widget (app/host.tsx AUTO_WIDGET). */
const HIDDEN_FOR_THE_SHOT = '[data-harness-stand-in="auto-widget"] { display: none; }'
/** The theme's phone menu: its button and the dialog it opens (Play's phone-bar.tsx MENU_LABEL, phone-menu.tsx MENU_TITLE). */
const MENU_NAME = 'Menu'
/** The host's suggestion card (SuggestionCard): its pinned line, the title that opens it, and the full card. */
const SUGGESTS = /^Auto suggests: /
const OPEN_TITLE = /^Open: /
/** The host's tool approval card, a protected surface. */
const APPROVAL_CARD = '[data-protected-surface="tool-approval"]'
const SHOT_OPTIONS = Object.freeze({ animations: 'disabled', caret: 'hide', style: HIDDEN_FOR_THE_SHOT } as const)

/** The host's voice button in a phase: its root, once the session in that phase is the button's. */
const voiceButtonIn = (phase: string): string => `[data-voice-button="root"][data-voice-state="${phase}"]`

/** Checks the page drew what the shot asks for, before anything is pressed. */
async function expectDrawn(page: Page, shot: ShowcaseShot): Promise<void> {
  const report = await harnessReport(page)
  expect(report.status, 'the theme started in the harness').toBe('active')
  expect(report.presets, `the theme has the look ${shot.look}`).toContain(shot.look)
  await expect(page.locator(`#${STAGE_ID}`)).toHaveAttribute('data-harness-view', `${shot.view.kind}:${shot.view.key}`)
  await expect(page.locator(NUDGE), 'no first-run nudge on the hosted edition').toHaveCount(0)
  if (shot.voice !== DEFAULT_SETTINGS.voice) await expect(page.locator(voiceButtonIn(shot.voice)).first()).toBeAttached()
  if (shot.heading !== undefined) await expect(page.getByRole('heading', { name: shot.heading, exact: true })).toBeVisible()
  if (shot.demo.includes('hello-played')) await expect(page.getByText(PLAY_HELLO, { exact: true }), 'no hello after it played').toHaveCount(0)
}

/** Opens the theme's phone menu and waits until its dialog shows. */
async function openMenu(page: Page): Promise<void> {
  await page.getByRole('button', { name: MENU_NAME, exact: true }).click()
  await expect(page.getByRole('dialog', { name: MENU_NAME, exact: true })).toBeVisible(SETTLE)
}

/** Opens the pinned suggestion's full card from the title on its line, and waits until the card shows. */
async function openSuggestion(page: Page): Promise<void> {
  await page.getByRole('group', { name: SUGGESTS }).getByRole('button', { name: OPEN_TITLE }).click()
  await expect(page.getByRole('article', { name: SUGGESTS })).toBeVisible(SETTLE)
}

/** Sends APPROVAL_ASK from the theme's message box, and waits until the approval card its answer raises shows. */
async function askForApproval(page: Page, shot: ShowcaseShot): Promise<void> {
  if (shot.composer === undefined) throw new Error(`${showcaseFile(shot)} asks for an approval but names no message box`)
  const box = page.getByRole('textbox', { name: shot.composer, exact: true })
  await box.fill(APPROVAL_ASK)
  await box.press('Enter')
  await expect(page.locator(APPROVAL_CARD).first()).toBeVisible(SETTLE)
}

/** Does the shot's step on the page. */
async function takeStep(page: Page, shot: ShowcaseShot): Promise<void> {
  if (shot.step === 'open-menu') await openMenu(page)
  if (shot.step === 'open-suggestion') await openSuggestion(page)
  if (shot.step === 'ask-approval') await askForApproval(page, shot)
}

for (const shot of SHOWCASE_SHOTS) {
  const file = showcaseFile(shot)
  test(file, async ({ page }) => {
    await page.clock.setFixedTime(SHOWCASE_TIME)
    await page.setViewportSize({ width: shot.viewport.width, height: shot.viewport.height })
    await openSettled(page, showcaseUrl(shot))
    await expectDrawn(page, shot)
    await takeStep(page, shot)
    await page.screenshot({ path: join(OUT_DIR, file), ...SHOT_OPTIONS })
  })
}
