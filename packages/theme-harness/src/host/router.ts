/**
 * PRD-261 B-02e: the browser harness's addresses, with no DOM and no React, so the app, its build config and the
 * shots spec (Node) read the same ones.
 *
 * - Where the harness serves (HARNESS_ORIGIN; `automatos-theme dev` on DEV_ORIGIN, PRD-261 B-02i), and the global the
 *   app publishes what it drew on (HARNESS_GLOBAL).
 * - The views: every slot, page and route the theme both declares in theme.json and registers, each at the path
 *   the host draws it on (core: lookEditor@1 on /looks, styleSheet@1 on /looks/style, a page on its own route, a
 *   route under /x/; frame@1's own view on /, or on a harness path of its own when the theme owns /), and the view a
 *   path shows. A path the theme draws nothing for is the host's own page inside the theme's frame, as core's
 *   MainLayout draws a core page under a theme.
 * - The shots' plan: each view's file name, and the files a set must hold, read from the theme folder (the groups, and
 *   the address each shot opens, are src/host/shot-groups.ts's).
 * - The widths: the two desktop widths, a phone's (PHONE_VIEWPORT), and the one just below the theme's minWidth.
 * - The settings the toolbar switches (the voice phase among them), as the query string a reload or a shot opens the
 *   harness with.
 * - The page's two addresses (PAGE_PATHS): `/`, the mock host, and PHONE_PATH, the phone view (app/phone/), whose
 *   own settings are src/phone/settings.ts's.
 */

export const HARNESS_HOST = '127.0.0.1'
export const HARNESS_PORT = 4318
export const HARNESS_ORIGIN = `http://${HARNESS_HOST}:${HARNESS_PORT}`
/** Where `automatos-theme dev` serves the harness unless --port names another: beside the shots' port, so both can run. */
export const DEV_PORT = 4319
export const DEV_ORIGIN = `http://${HARNESS_HOST}:${DEV_PORT}`
/** The global the app sets once the theme has loaded: HarnessReport. */
export const HARNESS_GLOBAL = '__AUTOMATOS_HARNESS__'
/** The folder the harness serves the theme folder's assets/ under, which the SDK's assetUrl names (host.setFilesRoot). */
export const FILES_ROOT = '/'
/** The phone view's address (app/phone/page.tsx): Automatos Go's screens for the theme, beside its contrast. */
export const PHONE_PATH = '/phone'
/** Every address the harness page answers on: the mock host on `/`, the phone view on PHONE_PATH. */
export const PAGE_PATHS: readonly string[] = Object.freeze(['/', PHONE_PATH])
/** The element the theme draws in; what the shots' axe scan reads. */
export const STAGE_ID = 'harness-stage'
/** The theme folder the build and the shots draw (`automatos-theme shots` sets both). */
export const THEME_ENV = 'AUTOMATOS_HARNESS_THEME'
/** The folder the shots write their PNGs and axe.json files to. */
export const OUT_ENV = 'AUTOMATOS_HARNESS_OUT'

/** The frame every theme registers; its own view is the host's home page inside it. */
export const FRAME_SLOT = 'frame@1'
export const HOME_PATH = '/'
/** A path no page answers, where the theme's notFound@1 draws. */
export const NOT_FOUND_PATH = '/harness/not-found'
/** core's theme routes: /x/<path> (THEME_ROUTE_PATTERN). */
export const ROUTE_PREFIX = '/x/'
/** A slot with no page of its own is drawn on its own harness path. */
export const SLOT_PREFIX = '/harness/slot/'
/** The id a page with a dynamic segment ('/missions/[id]') is drawn with: fake data. */
export const SAMPLE_SEGMENT = 'sample-1'

/** The slots the host draws on a page of its own (core's /looks pages, and the 404). */
const SLOT_PATHS: Readonly<Record<string, string>> = Object.freeze({
  [FRAME_SLOT]: HOME_PATH,
  'lookEditor@1': '/looks',
  'styleSheet@1': '/looks/style',
  'notFound@1': NOT_FOUND_PATH,
})
const DYNAMIC_SEGMENT = /\[[a-z]+\]/g

export type ViewKind = 'slot' | 'page' | 'route' | 'base'

/** One thing the harness draws: a slot, page or route of the theme, or the host's own page ('base'). */
export interface View {
  readonly kind: ViewKind
  /** The slot id, the page's route, the route's path, or the path the host's page answers. */
  readonly key: string
  readonly path: string
}

/** What the theme serves: declared in theme.json and registered, each in theme.json's order. */
export interface Served {
  readonly slots: readonly string[]
  readonly pages: readonly string[]
  readonly routes: readonly string[]
}

/** Nothing served: a theme that failed, or a report with nothing missing. */
export const EMPTY_SERVED: Served = Object.freeze({ slots: [], pages: [], routes: [] })

const own = (record: Readonly<Record<string, string>>, key: string): boolean => Object.prototype.hasOwnProperty.call(record, key)

/**
 * The path the host draws a slot on. frame@1's own view is the host's home page inside the frame, unless one of the
 * theme's `pages` answers on HOME_PATH ('/' is a page a theme may own): then the frame's own view is drawn on its own
 * harness path, so no two views share a path.
 */
export function slotPath(slot: string, pages: readonly string[] = []): string {
  if (slot === FRAME_SLOT && ownsHome(pages)) return `${SLOT_PREFIX}${slot}`
  return own(SLOT_PATHS, slot) ? SLOT_PATHS[slot] : `${SLOT_PREFIX}${slot}`
}

export function pagePath(page: string): string {
  return page.replace(DYNAMIC_SEGMENT, SAMPLE_SEGMENT)
}

/** True when one of the theme's pages is drawn on HOME_PATH. */
function ownsHome(pages: readonly string[]): boolean {
  return pages.some((page) => pagePath(page) === HOME_PATH)
}

export function routePath(route: string): string {
  return `${ROUTE_PREFIX}${route}`
}

/** Every slot, page and route the theme serves, each once, at its path: slots first, then pages, then routes. */
export function viewsOf(served: Served): View[] {
  return [
    ...served.slots.map((key): View => ({ kind: 'slot', key, path: slotPath(key, served.pages) })),
    ...served.pages.map((key): View => ({ kind: 'page', key, path: pagePath(key) })),
    ...served.routes.map((key): View => ({ kind: 'route', key, path: routePath(key) })),
  ]
}

/** The view a path shows: the theme's page, route or slot there, else the host's own page for that path. */
export function viewOfPath(path: string, served: Served): View {
  const views = viewsOf(served)
  const page = views.find((view) => view.kind === 'page' && view.path === path)
  if (page !== undefined) return page
  const drawn = views.find((view) => view.path === path)
  return drawn ?? { kind: 'base', key: path, path }
}

/** A route's '/' in a file name: '_', which no route holds (THEME_ROUTE_PATTERN), so 'a/b' and 'a-b' get two files. */
const ROUTE_SEPARATOR = /\//g
const ROUTE_SEPARATOR_IN_SLUG = '_'
const NOT_IN_SLUG = /[^A-Za-z0-9_]+/g
const SLUG_EDGES = /^[-_]+|[-_]+$/g

/**
 * A view as a file name: its kind and key in letters, digits and dashes ('page-chat', 'slot-lookEditor-1'), a route's
 * segments joined by '_' ('route-notes_today'). No two slots, pages or routes core knows share one.
 */
export function viewSlug(view: View): string {
  const spelled = view.kind === 'route' ? view.key.replace(ROUTE_SEPARATOR, ROUTE_SEPARATOR_IN_SLUG) : view.key
  const key = spelled.replace(NOT_IN_SLUG, '-').replace(SLUG_EDGES, '')
  return `${view.kind}-${key === '' ? 'root' : key}`
}

/** A preset's file under the theme's looks/presets/. */
export const PRESET_SUFFIX = '.look.json'

const byFileName = (a: string, b: string): number => {
  const [left, right] = [`${a}${PRESET_SUFFIX}`, `${b}${PRESET_SUFFIX}`]
  return left < right ? -1 : left > right ? 1 : 0
}

/** A theme's presets (by id) in the order the host's boot carries them: the default look first, the rest by file name. */
export function presetOrder(ids: readonly string[], defaultLook: string | undefined): string[] {
  const rest = ids.filter((id) => id !== defaultLook).sort(byFileName)
  return defaultLook !== undefined && ids.includes(defaultLook) ? [defaultLook, ...rest] : rest
}

// ---- widths ----

/** The two desktop widths the toolbar offers and the shots draw at. */
export const SHOT_WIDTHS: readonly number[] = Object.freeze([1440, 1024])
/**
 * A phone's screen: an iPhone's 390 × 844 points, a point a CSS pixel, as the Command design draws its phone and the
 * phone view (app/phone/frame.tsx) draws Automatos Go. The toolbar offers its width, and the shots draw a theme whose
 * minWidth fits it in a viewport of this size (src/host/shot-groups.ts).
 */
export const PHONE_VIEWPORT: Readonly<{ width: number; height: number }> = Object.freeze({ width: 390, height: 844 })
/** The narrowest stage the harness draws. */
export const MIN_STAGE_WIDTH = 320
export const MAX_STAGE_WIDTH = 3840

/** A width just below the theme's minWidth, where the host draws its own pages; null when none is below it. */
export function belowWidth(minWidth: number): number | null {
  return minWidth > MIN_STAGE_WIDTH ? minWidth - 1 : null
}

export interface WidthChoice {
  readonly value: string
  readonly label: string
  /** null: the window's own width. */
  readonly width: number | null
}

export const WINDOW_WIDTH = 'window'

const widestFirst = (a: WidthChoice, b: WidthChoice): number => (b.width ?? 0) - (a.width ?? 0)

/**
 * The toolbar's widths: the window's, then, widest first, the two desktop widths, the phone's, and one below the
 * theme's minWidth (left out when it is one of the others).
 */
export function widthChoices(minWidth: number): WidthChoice[] {
  const below = belowWidth(minWidth)
  const phone = PHONE_VIEWPORT.width
  const fixed = SHOT_WIDTHS.map((width): WidthChoice => ({ value: String(width), label: `${width} px`, width }))
  const phoneChoice: WidthChoice = { value: String(phone), label: `${phone} px (phone)`, width: phone }
  const narrow: WidthChoice[] = below === null || SHOT_WIDTHS.includes(below) || below === phone
    ? []
    : [{ value: String(below), label: `${below} px (below minWidth)`, width: below }]
  const sized = [...fixed, phoneChoice, ...narrow].sort(widestFirst)
  return [{ value: WINDOW_WIDTH, label: 'The window', width: null }, ...sized]
}

// ---- settings in the query string ----

export type HarnessTone = 'light' | 'dark'

/** The voice phases the toolbar and the shots show a theme's voice in (src/host/voice.ts holds each one's session). */
export const VOICE_PHASES = Object.freeze(['idle', 'listening', 'thinking', 'speaking', 'error'] as const)
export type HarnessVoicePhase = (typeof VOICE_PHASES)[number]

/** What the toolbar switches; the path is the fake host's (useHostPathname), so the theme's own links move it too. */
export interface HarnessSettings {
  readonly path: string
  /** A preset's id; null: the theme's default look. */
  readonly preset: string | null
  /** The stage's width in pixels; null: the window's. */
  readonly width: number | null
  /** The tone the user chose; a look or the theme's tone policy may force another. */
  readonly tone: HarnessTone
  readonly reducedMotion: boolean
  readonly forcedColors: boolean
  /** True opens the chat on a made-up conversation (src/host/transcript.ts); false on a new chat. */
  readonly transcript: boolean
  /** The host's voice session: none ('idle'), or a made-up one in that phase (src/host/voice.ts). */
  readonly voice: HarnessVoicePhase
  /** False hides the toolbar (the shots draw the theme alone). */
  readonly toolbar: boolean
}

export const DEFAULT_SETTINGS: HarnessSettings = Object.freeze({
  path: HOME_PATH,
  preset: null,
  width: null,
  tone: 'light',
  reducedMotion: false,
  forcedColors: false,
  transcript: false,
  voice: 'idle',
  toolbar: true,
})

const PARAM = Object.freeze({
  path: 'path', preset: 'preset', width: 'width', tone: 'tone', motion: 'motion', forced: 'forced', chat: 'chat', voice: 'voice',
  toolbar: 'toolbar',
})
const TRANSCRIPT = 'transcript'
const REDUCE = 'reduce'
const ACTIVE = 'active'
const OFF = 'off'
/** A path inside the app: letters, digits and - _ . / [ ] only. */
const SAFE_PATH = /^\/[A-Za-z0-9\-_./[\]@]*$/
/** core's LOOK_ID_PATTERN. */
const PRESET_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/
const WHOLE_NUMBER = /^\d{1,4}$/

function widthOf(value: string | null): number | null {
  if (value === null || !WHOLE_NUMBER.test(value)) return null
  const width = Number(value)
  return width >= MIN_STAGE_WIDTH && width <= MAX_STAGE_WIDTH ? width : null
}

function voiceOf(value: string | null): HarnessVoicePhase {
  return VOICE_PHASES.find((phase) => phase === value) ?? DEFAULT_SETTINGS.voice
}

/** The settings a query string names; a missing or malformed value is the default's. */
export function readSettings(search: string): HarnessSettings {
  const params = new URLSearchParams(search)
  const path = params.get(PARAM.path)
  const preset = params.get(PARAM.preset)
  const tone = params.get(PARAM.tone)
  return Object.freeze({
    path: path !== null && SAFE_PATH.test(path) ? path : DEFAULT_SETTINGS.path,
    preset: preset !== null && PRESET_ID.test(preset) ? preset : DEFAULT_SETTINGS.preset,
    width: widthOf(params.get(PARAM.width)),
    tone: tone === 'dark' || tone === 'light' ? tone : DEFAULT_SETTINGS.tone,
    reducedMotion: params.get(PARAM.motion) === REDUCE,
    forcedColors: params.get(PARAM.forced) === ACTIVE,
    transcript: params.get(PARAM.chat) === TRANSCRIPT,
    voice: voiceOf(params.get(PARAM.voice)),
    toolbar: params.get(PARAM.toolbar) !== OFF,
  })
}

/** The query string (with its '?', or '' for the defaults) that readSettings reads back as `settings`. */
export function settingsQuery(settings: HarnessSettings): string {
  const params = new URLSearchParams()
  if (settings.path !== DEFAULT_SETTINGS.path) params.set(PARAM.path, settings.path)
  if (settings.preset !== null) params.set(PARAM.preset, settings.preset)
  if (settings.width !== null) params.set(PARAM.width, String(settings.width))
  if (settings.tone !== DEFAULT_SETTINGS.tone) params.set(PARAM.tone, settings.tone)
  if (settings.reducedMotion) params.set(PARAM.motion, REDUCE)
  if (settings.forcedColors) params.set(PARAM.forced, ACTIVE)
  if (settings.transcript) params.set(PARAM.chat, TRANSCRIPT)
  if (settings.voice !== DEFAULT_SETTINGS.voice) params.set(PARAM.voice, settings.voice)
  if (!settings.toolbar) params.set(PARAM.toolbar, OFF)
  const query = params.toString()
  return query === '' ? '' : `?${query}`
}

// ---- the shots ----

/** Inline data never leaves the page. */
const INLINE_SCHEME = 'data:'

/** The URLs that left `origin`: every one but its own and inline data (a blob: URL has its page's origin). */
export function offOrigin(urls: readonly string[], origin: string = HARNESS_ORIGIN): string[] {
  return urls.filter((url) => {
    if (url.startsWith(INLINE_SCHEME)) return false
    try {
      return new URL(url).origin !== origin
    } catch {
      return true
    }
  })
}

/** What the app publishes on HARNESS_GLOBAL once the theme has loaded (or failed), for the shots. */
export interface HarnessReport {
  readonly status: 'active' | 'failed'
  readonly views: readonly View[]
  /** What theme.json declares that the theme did not register (none for a theme that failed). */
  readonly missing: Served
  readonly presets: readonly string[]
  readonly minWidth: number
}

/** Each shot's file: <view slug>.png. */
export const SHOT_SUFFIX = '.png'

const textList = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [])

/** What a theme.json declares, in its order: its slots, its pages' routes and its routes (read leniently: the app checks the file). */
export function declaredIn(manifest: unknown): Served {
  const fields = (manifest !== null && typeof manifest === 'object' ? manifest : {}) as Readonly<Record<string, unknown>>
  const pages = fields.pages
  const pageRoutes = pages !== null && typeof pages === 'object' && !Array.isArray(pages) ? Object.keys(pages) : []
  return { slots: textList(fields.slots), pages: pageRoutes, routes: textList(fields.routes) }
}

/** The SDK areas a theme.json's `uses` names, read leniently (the app checks the file): none when it names none. */
export function usesIn(manifest: unknown): string[] {
  const uses = manifest !== null && typeof manifest === 'object' ? (manifest as Readonly<Record<string, unknown>>).uses : undefined
  return textList(uses)
}

/**
 * The PNG files one shot group must hold, from the theme folder rather than from the views the page drew: one per
 * view of what theme.json declares, less what the page reports the theme did not register. Two views with one file
 * name would show here twice.
 */
export function expectedShots(declared: Served, missing: Served): string[] {
  const kept = (keys: readonly string[], gone: readonly string[]): string[] => keys.filter((key) => !gone.includes(key))
  const served: Served = {
    slots: kept(declared.slots, missing.slots),
    pages: kept(declared.pages, missing.pages),
    routes: kept(declared.routes, missing.routes),
  }
  return viewsOf(served).map((view) => `${viewSlug(view)}${SHOT_SUFFIX}`)
}

/** The presets the shots draw, the default look first; a throw when theme.json names a default look with no file. */
export function shotPresets(ids: readonly string[], defaultLook: string | undefined): string[] {
  if (defaultLook !== undefined && !ids.includes(defaultLook)) {
    throw new Error(`looks/presets has no ${defaultLook}${PRESET_SUFFIX}, the default look theme.json names: build the theme first.`)
  }
  return presetOrder(ids, defaultLook)
}
