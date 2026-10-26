/**
 * PRD-261 B-02f: the shots' groups (one Playwright test each, shots/shots.spec.ts) and the address each shot opens.
 * No DOM and no React, so the spec (Node) and the tests read the same plan. Each group names its viewport, which the
 * spec sizes the page to: DESKTOP_HEIGHT tall at its width, but the phone-width group's, a phone's 390 × 844.
 *
 * - Each preset, the default look first, at 1440 and 1024 px, then the default look just below the theme's minWidth:
 *   every view the theme serves, with reduced motion, as the shots' determinism asks.
 * - For a theme with a /chat page, the chat page twice more in the default look at 1440 px: once with motion allowed
 *   (the host's reduced motion off, and the browser asked for none), so the shots show what only moves: Auto's clip and
 *   the Pause Auto control beside it (WCAG 2.2.2), which reduced motion never draws; and once on the transcript
 *   (src/host/transcript.ts: the owner's words, Auto's reply with a tool line and a Deliverable), so a chat with a
 *   conversation on it is shot, not only an empty one.
 * - For a theme whose minWidth is at most a phone's width (router.ts PHONE_VIEWPORT), each preset at the phone's
 *   390 × 844, every view with reduced motion, into `<preset>/390/`; and with a /chat page, the chat page on the
 *   transcript there in the default look (`<preset>/390-transcript/`). So a theme's phone layout is drawn and scanned,
 *   its media queries answered by a phone-sized viewport. A theme whose minWidth is above it gets none: below its
 *   minWidth the host draws its own pages, which its below-minWidth group already shows.
 * - For a theme whose theme.json `uses` names the SDK's `voice` area (SDK 1.2.0), its voice states: the chat page (or,
 *   with no /chat page, every view) on the transcript in the default look at 1440 px, with reduced motion, once for
 *   each phase of the host's made-up voice session but idle (src/host/voice.ts: listening, thinking, speaking,
 *   failed), into `<preset>/1440-voice-<phase>/`. The session runs on the transcript's conversation, so the shots show
 *   its words as core's chat draws them, the conversation's last two messages. Idle is every other group. Reduced
 *   motion holds the voice levels still, so the shots are the same on every run.
 */
import {
  belowWidth, DEFAULT_SETTINGS, expectedShots, pagePath, PHONE_VIEWPORT, settingsQuery, SHOT_SUFFIX, SHOT_WIDTHS, viewSlug, VOICE_PHASES,
  type HarnessVoicePhase, type Served, type View,
} from './router.ts'

/** The page the chat groups shoot. */
export const CHAT_PAGE = '/chat'
/** The width the chat groups shoot at: the wider desktop width. */
export const CHAT_GROUP_WIDTH = SHOT_WIDTHS[0]
/** The viewport's height in every group but the phone-width ones: the Command design's desktop, 1440 × 900. */
export const DESKTOP_HEIGHT = 900
/** The motion group's folder beside its preset's 1440 folder: `<preset>/1440-motion`, which no preset or width takes. */
export const MOTION_SUFFIX = '-motion'
/** The transcript groups': `<preset>/1440-transcript`, and `<preset>/390-transcript` at the phone's width. */
export const TRANSCRIPT_SUFFIX = '-transcript'
/** The voice groups': `<preset>/1440-voice-<phase>`. */
export const VOICE_SUFFIX = '-voice-'
/** The SDK area a theme.json's `uses` names for the voice groups. */
export const VOICE_AREA = 'voice'
/** The phases the voice groups shoot: every one but idle, which every other group shows. */
export const VOICE_SHOT_PHASES: readonly HarnessVoicePhase[] = Object.freeze(VOICE_PHASES.filter((phase) => phase !== DEFAULT_SETTINGS.voice))

/** The page's size in a group, in CSS pixels. */
export interface Viewport {
  readonly width: number
  readonly height: number
}

/** One test of the shots: a preset (null for a theme with none) in one viewport, into its own folder. */
export interface ShotGroup extends Viewport {
  readonly folder: string
  readonly preset: string | null
  /** True for every group but the motion one: the host's reduced motion on, and the browser asked for it. */
  readonly reducedMotion: boolean
  /** The one page the group shoots; null for every view the theme serves. */
  readonly page: string | null
  /** True for the transcript and voice groups alone: the chat opened on the made-up exchange. */
  readonly transcript: boolean
  /** The voice groups' phase of the host's made-up voice session; left out (no session) in every other group. */
  readonly voice?: HarnessVoicePhase
}

const NO_PRESET_FOLDER = 'default'

const folderOf = (preset: string | null, width: number): string => `${preset ?? NO_PRESET_FOLDER}/${width}`

const desktop = (width: number): Viewport => ({ width, height: DESKTOP_HEIGHT })

/** A group of every view, with reduced motion. */
function everyView(folder: string, preset: string | null, viewport: Viewport): ShotGroup {
  return { folder, preset, ...viewport, reducedMotion: true, page: null, transcript: false }
}

/** The chat page on the transcript, with reduced motion, in `<preset>/<width>-transcript`. */
function transcriptGroup(preset: string | null, viewport: Viewport): ShotGroup {
  const folder = `${folderOf(preset, viewport.width)}${TRANSCRIPT_SUFFIX}`
  return { folder, preset, ...viewport, reducedMotion: true, page: CHAT_PAGE, transcript: true }
}

/**
 * The chat page in the default look at 1440 px, with motion allowed, then on the transcript; none for a theme without
 * a /chat page.
 */
function chatGroups(preset: string | null, pages: readonly string[]): ShotGroup[] {
  if (!pages.includes(CHAT_PAGE)) return []
  const viewport = desktop(CHAT_GROUP_WIDTH)
  const folder = `${folderOf(preset, CHAT_GROUP_WIDTH)}${MOTION_SUFFIX}`
  const motion: ShotGroup = { folder, preset, ...viewport, reducedMotion: false, page: CHAT_PAGE, transcript: false }
  return [motion, transcriptGroup(preset, viewport)]
}

/**
 * For a theme whose `uses` names the voice area: the chat page (every view with none) on the transcript in the default
 * look at 1440 px, with reduced motion, in each phase of VOICE_SHOT_PHASES; none for any other theme.
 */
function voiceGroups(preset: string | null, pages: readonly string[], uses: readonly string[]): ShotGroup[] {
  if (!uses.includes(VOICE_AREA)) return []
  const page = pages.includes(CHAT_PAGE) ? CHAT_PAGE : null
  return VOICE_SHOT_PHASES.map((voice): ShotGroup => ({
    folder: `${folderOf(preset, CHAT_GROUP_WIDTH)}${VOICE_SUFFIX}${voice}`,
    preset, ...desktop(CHAT_GROUP_WIDTH), reducedMotion: true, page, transcript: true, voice,
  }))
}

/** True for a theme drawn at a phone's width: its minWidth at most PHONE_VIEWPORT's width. */
export function fitsPhone(minWidth: number): boolean {
  return minWidth <= PHONE_VIEWPORT.width
}

/**
 * For a theme that fits a phone: each preset at the phone's viewport, then, with a /chat page, that page on the
 * transcript there in the default look; none for any other theme.
 */
function phoneGroups(looks: readonly (string | null)[], minWidth: number, pages: readonly string[]): ShotGroup[] {
  if (!fitsPhone(minWidth)) return []
  const views = looks.map((preset) => everyView(folderOf(preset, PHONE_VIEWPORT.width), preset, PHONE_VIEWPORT))
  return pages.includes(CHAT_PAGE) ? [...views, transcriptGroup(looks[0], PHONE_VIEWPORT)] : views
}

/**
 * Each preset (default first) at each desktop width, then the default look just below the theme's minWidth, then the
 * chat groups for a theme whose `pages` (theme.json's routes) hold /chat, then the voice groups for a theme whose
 * `uses` names the voice area, then the phone-width groups for a theme whose minWidth fits a phone.
 */
export function shotGroups(
  presets: readonly string[], minWidth: number, pages: readonly string[] = [], uses: readonly string[] = [],
): ShotGroup[] {
  const looks: readonly (string | null)[] = presets.length === 0 ? [null] : presets
  const wide = looks.flatMap((preset) => SHOT_WIDTHS.map((width) => everyView(folderOf(preset, width), preset, desktop(width))))
  const below = belowWidth(minWidth)
  const narrow = below === null ? [] : [everyView(`below-${below}`, looks[0], desktop(below))]
  const voice = voiceGroups(looks[0], pages, uses)
  return [...wide, ...narrow, ...chatGroups(looks[0], pages), ...voice, ...phoneGroups(looks, minWidth, pages)]
}

/** The address a shot opens: the view's path, the group's look, width, motion, conversation and voice, no toolbar. */
export function shotAddress(group: ShotGroup, path: string): string {
  const { preset, width, reducedMotion, transcript, voice = DEFAULT_SETTINGS.voice } = group
  return `/${settingsQuery({ ...DEFAULT_SETTINGS, path, preset, width, reducedMotion, transcript, voice, toolbar: false })}`
}

/** The views a group shoots, of those the page drew: every one, or its one page. */
export function groupViews(group: ShotGroup, views: readonly View[]): View[] {
  return group.page === null ? [...views] : views.filter((view) => view.kind === 'page' && view.key === group.page)
}

/** The PNG files a group must hold: every view's (expectedShots), or its one page's while the theme serves that page. */
export function groupShots(group: ShotGroup, declared: Served, missing: Served): string[] {
  const all = expectedShots(declared, missing)
  if (group.page === null) return all
  const file = `${viewSlug({ kind: 'page', key: group.page, path: pagePath(group.page) })}${SHOT_SUFFIX}`
  return all.filter((name) => name === file)
}
