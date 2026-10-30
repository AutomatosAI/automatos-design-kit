/**
 * PRD-261 B-02h: Lighthouse over the kit's themes drawn in the browser harness, report only. The plan, with no
 * browser and no server, so the runner (run.ts) and the tests read the same one.
 *
 * Every folder under themes/ that holds a theme.json is drawn by `automatos-theme dev` (the harness the shots draw
 * in, served on 127.0.0.1) in its default look with the toolbar off, and measured by Lighthouse's own command on the
 * Chromium the harness job installs for the shots (Playwright's), headless: the theme's home view (`/`, its frame with
 * the host's home page in it) and, when theme.json declares one, its /chat page, each at the desktop width the shots
 * draw first (1440 × 900, with Lighthouse's desktop preset) and at the phone's 390 × 844 (Lighthouse's mobile
 * scoring). Each run writes its HTML and JSON reports to REPORT_DIR, which kit.yml uploads as kit-lighthouse.
 */
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  declaredIn, DEFAULT_SETTINGS, HOME_PATH, PHONE_VIEWPORT, settingsQuery, SHOT_WIDTHS,
} from '@automatos/theme-harness/router'
import { CHAT_PAGE, DESKTOP_HEIGHT } from '../../packages/theme-harness/src/host/shot-groups.ts'

export const THEMES_DIR = 'themes'
export const MANIFEST_FILE = 'theme.json'
/** Where the reports go, under the harness package's dist/ (git ignores it), apart from the shots and the showcase. */
export const REPORT_DIR = 'packages/theme-harness/dist/lighthouse'
/**
 * The port `automatos-theme dev` serves each theme on, one at a time: beside the shots' 4318, dev's 4319, and the
 * showcase's 4320 and 4321.
 */
export const LIGHTHOUSE_PORT = 4322
export const JSON_REPORT_SUFFIX = '.report.json'
/**
 * Chromium's own switches: headless, and no sandbox (a CI runner's kernel refuses Chromium's; Playwright's launch
 * turns it off too).
 */
export const CHROME_FLAGS = '--headless=new --no-sandbox'
/** The device pixels per CSS pixel of each width: a desktop screen's one, and an iPhone's three at PHONE_VIEWPORT. */
export const DESKTOP_SCALE = 1
export const PHONE_SCALE = 3
const HOME_SLUG = 'home'
const NOT_IN_SLUG = /[^A-Za-z0-9]+/g
const SLUG_EDGES = /^-+|-+$/g

export interface FormFactor {
  readonly name: 'desktop' | 'phone'
  readonly width: number
  readonly height: number
  readonly scale: number
  /** True scores the page as Lighthouse scores a phone (its mobile form factor). */
  readonly mobile: boolean
}

/** The two widths each page is measured at: the shots' first desktop width, and the phone's. */
export const FORM_FACTORS: readonly FormFactor[] = Object.freeze([
  { name: 'desktop', width: SHOT_WIDTHS[0], height: DESKTOP_HEIGHT, scale: DESKTOP_SCALE, mobile: false },
  { name: 'phone', width: PHONE_VIEWPORT.width, height: PHONE_VIEWPORT.height, scale: PHONE_SCALE, mobile: true },
])

/** Lighthouse's four categories (the ones version 13 has), in the order the summary table shows them. */
export const CATEGORIES: readonly { readonly id: string; readonly label: string }[] = Object.freeze([
  { id: 'performance', label: 'Performance' },
  { id: 'accessibility', label: 'Accessibility' },
  { id: 'best-practices', label: 'Best practices' },
  { id: 'seo', label: 'SEO' },
])

/** One Lighthouse run: a theme's page at one width. */
export interface LighthouseRun {
  /** The theme's folder name under themes/. */
  readonly theme: string
  readonly factor: FormFactor
  /** The harness path the page answers on: `/` or `/chat`. */
  readonly page: string
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

/** Every folder under `themesDir` that holds a theme.json, by name, sorted: the themes the kit ships, and any added. */
export function themeFolders(themesDir: string): string[] {
  return readdirSync(themesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && isFile(join(themesDir, entry.name, MANIFEST_FILE)))
    .map((entry) => entry.name)
    .sort()
}

/** The pages measured for a theme: its home view, then its /chat page when theme.json declares one. */
export function auditedPages(manifest: unknown): string[] {
  return declaredIn(manifest).pages.includes(CHAT_PAGE) ? [HOME_PATH, CHAT_PAGE] : [HOME_PATH]
}

/** Every run for one theme: each page at each width, in that order. */
export function runsOf(theme: string, manifest: unknown): LighthouseRun[] {
  return auditedPages(manifest).flatMap((page) => FORM_FACTORS.map((factor): LighthouseRun => ({ theme, factor, page })))
}

/** The harness address Lighthouse opens: the page, in the theme's default look, the toolbar off, at the window's width. */
export function pageAddress(origin: string, page: string): string {
  return `${origin}/${settingsQuery({ ...DEFAULT_SETTINGS, path: page, toolbar: false })}`
}

/** A page as part of a file name: `home` for `/`, its path's words joined by dashes otherwise. */
export function pageSlug(page: string): string {
  const slug = page.replace(NOT_IN_SLUG, '-').replace(SLUG_EDGES, '')
  return slug === '' ? HOME_SLUG : slug
}

/** The run's reports, without their suffixes: `<reportDir>/<theme>-<width>-<page>`. */
export function reportBase(reportDir: string, run: LighthouseRun): string {
  return join(reportDir, `${run.theme}-${run.factor.name}-${pageSlug(run.page)}`)
}

/** The width's emulation: Lighthouse's desktop preset or its mobile scoring, on the width's own screen. */
function emulationArgs(factor: FormFactor): string[] {
  return [
    factor.mobile ? '--form-factor=mobile' : '--preset=desktop',
    `--screenEmulation.mobile=${String(factor.mobile)}`,
    `--screenEmulation.width=${factor.width}`,
    `--screenEmulation.height=${factor.height}`,
    `--screenEmulation.deviceScaleFactor=${factor.scale}`,
  ]
}

/**
 * Lighthouse's command line for one run: the address, the width, its four categories, an HTML and a JSON report at
 * `base` (`<base>.report.html`, `<base>.report.json`), headless Chromium, and no error reporting (nothing is sent).
 */
export function lighthouseArgs(address: string, factor: FormFactor, base: string): string[] {
  return [
    address,
    ...emulationArgs(factor),
    `--only-categories=${CATEGORIES.map((category) => category.id).join(',')}`,
    '--output=json',
    '--output=html',
    `--output-path=${base}`,
    `--chrome-flags=${CHROME_FLAGS}`,
    '--no-enable-error-reporting',
  ]
}
