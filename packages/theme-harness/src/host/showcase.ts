/**
 * The showcase shots: clean images of the kit's two themes, HUD and Play, for READMEs, docs and the product site,
 * made in kit CI's harness job (shots/showcase.config.ts runs shots/showcase.spec.ts) and uploaded as the
 * `kit-showcase` artefact. No DOM and no React, so the spec (Node) and the tests read the same plan.
 *
 * The regression shots (src/host/shot-groups.ts) draw every view of every preset on the local edition and scan each
 * with axe. A showcase shot is one chosen view in one chosen look, drawn as a customer of the hosted edition sees it:
 * - on the hosted (SaaS) edition (`edition=saas`), so core's local-only first-run nudge is not over the chat;
 * - at twice the pixel density (SHOWCASE_SCALE), with reduced motion and a fixed clock (SHOWCASE_TIME, in
 *   SHOWCASE_TIMEZONE: the fixtures' made-up morning, after the conversation and before the first scheduled run), so
 *   each image is the same on every run;
 * - on the harness's own made-up data: the laptop-shortlist conversation with its Deliverable (src/host/transcript.ts),
 *   the running Mission and the board's cards (src/host/sample-data.ts), and the made-up voice session
 *   (src/host/voice.ts).
 * No axe scan: the regression shots scan the same views. HUD draws no Command Centre of its own (its theme.json
 * declares no such page, so the host's page would stand in its frame), so none is shot.
 *
 * Each shot's file is `<theme>-<width>-<what>-<look>.png` (showcaseFile), in SHOWCASE_FOLDER of the harness package.
 */
import {
  DEFAULT_SETTINGS, HARNESS_HOST, pagePath, PHONE_VIEWPORT, routePath, settingsQuery, SHOT_SUFFIX, SHOT_WIDTHS, slotPath,
  type HarnessEdition, type HarnessVoicePhase, type View,
} from './router.ts'
import { CHAT_PAGE, DESKTOP_HEIGHT, type Viewport } from './shot-groups.ts'

/** The kit's themes the showcase draws, by their folder under themes/. */
export const SHOWCASE_THEMES = Object.freeze(['hud', 'play'] as const)
export type ShowcaseTheme = (typeof SHOWCASE_THEMES)[number]

/**
 * Each theme's `automatos-theme dev` port: one server per theme, beside the shots' 4318 and `dev`'s own 4319, so the
 * showcase never meets the smoke's or the phone shots' server.
 */
export const SHOWCASE_PORTS: Readonly<Record<ShowcaseTheme, number>> = Object.freeze({ hud: 4320, play: 4321 })
/** Where the shots go, under the harness package: their own folder, apart from the regression shots' dist/shots. */
export const SHOWCASE_FOLDER = 'dist/showcase'
export const SHOWCASE_EDITION: HarnessEdition = 'saas'
/** Device pixels per CSS pixel: a 1440 × 900 shot is 2880 × 1800 pixels. */
export const SHOWCASE_SCALE = 2
/** The fixed clock: 14 Oct 2026, the fixtures' made-up morning (fixtures/agents/stats.json's 09:05 UTC), at 10:24. */
export const SHOWCASE_TIME = '2026-10-14T10:24:00Z'
export const SHOWCASE_TIMEZONE = 'UTC'
export const SHOWCASE_LOCALE = 'en-GB'
export const SHOWCASE_DESKTOP: Viewport = Object.freeze({ width: SHOT_WIDTHS[0], height: DESKTOP_HEIGHT })
export const SHOWCASE_PHONE: Viewport = PHONE_VIEWPORT

/** What the spec does on the page before the shot: nothing, or open the theme's phone menu (its Menu button). */
export type ShowcaseStep = 'none' | 'open-menu'

/** One showcase image: a theme's view in one look and viewport, with the host's chat and voice as given. */
export interface ShowcaseShot {
  readonly theme: ShowcaseTheme
  readonly viewport: Viewport
  /** The shot's subject in the file name: 'chat', 'voice-listening', 'look-editor', ... */
  readonly what: string
  /** The preset's id. */
  readonly look: string
  /** The view on the stage: a slot, page or route the theme serves. */
  readonly view: View
  /** True opens the chat on the laptop-shortlist conversation; false on a new chat. */
  readonly transcript: boolean
  readonly voice: HarnessVoicePhase
  readonly step: ShowcaseStep
  /** A heading the view must show (the first open's greeting), when the shot is one the theme names so. */
  readonly heading?: string
}

const LOOK_EDITOR_SLOT = 'lookEditor@1'
const CONVERSATIONS_ROUTE = 'conversations'
/** Play's first open (themes/play/src/components/play/chat/first-open.tsx HELLO_TITLE). */
const PLAY_HELLO = "Hi, I'm Auto."

const CHAT: View = Object.freeze<View>({ kind: 'page', key: CHAT_PAGE, path: pagePath(CHAT_PAGE) })
const LOOK_EDITOR: View = Object.freeze<View>({ kind: 'slot', key: LOOK_EDITOR_SLOT, path: slotPath(LOOK_EDITOR_SLOT) })
const CONVERSATIONS: View = Object.freeze<View>({ kind: 'route', key: CONVERSATIONS_ROUTE, path: routePath(CONVERSATIONS_ROUTE) })

type ShotChanges = Partial<Pick<ShowcaseShot, 'transcript' | 'voice' | 'step' | 'heading'>>

/** A shot on a new chat with no voice session and nothing pressed, but for `changes`. */
function planned(
  theme: ShowcaseTheme, viewport: Viewport, what: string, look: string, view: View, changes: ShotChanges = {},
): ShowcaseShot {
  const made: ShowcaseShot = { theme, viewport, what, look, view, transcript: false, voice: DEFAULT_SETTINGS.voice, step: 'none' }
  return Object.freeze({ ...made, ...changes })
}

const DESKTOP = SHOWCASE_DESKTOP
const PHONE = SHOWCASE_PHONE
const ON_TRANSCRIPT: ShotChanges = Object.freeze<ShotChanges>({ transcript: true })
const LISTENING: ShotChanges = Object.freeze<ShotChanges>({ transcript: true, voice: 'listening' })
const SPEAKING: ShotChanges = Object.freeze<ShotChanges>({ transcript: true, voice: 'speaking' })

/** Every showcase shot, theme by theme, the desktop's before the phone's. */
export const SHOWCASE_SHOTS: readonly ShowcaseShot[] = Object.freeze([
  planned('hud', DESKTOP, 'chat', 'arc', CHAT, ON_TRANSCRIPT),
  planned('hud', DESKTOP, 'voice-listening', 'arc', CHAT, LISTENING),
  planned('hud', DESKTOP, 'voice-speaking', 'forge', CHAT, SPEAKING),
  planned('hud', DESKTOP, 'look-editor', 'arc', LOOK_EDITOR),
  planned('hud', PHONE, 'chat', 'arc', CHAT, ON_TRANSCRIPT),
  planned('hud', PHONE, 'voice-listening', 'forge', CHAT, LISTENING),
  planned('hud', PHONE, 'look-editor', 'arc', LOOK_EDITOR),
  planned('hud', PHONE, 'chat', 'ghost', CHAT, ON_TRANSCRIPT),
  planned('play', DESKTOP, 'first-open', 'ember', CHAT, { heading: PLAY_HELLO }),
  planned('play', DESKTOP, 'chat', 'ember', CHAT, ON_TRANSCRIPT),
  planned('play', DESKTOP, 'voice-speaking', 'ember', CHAT, SPEAKING),
  planned('play', DESKTOP, 'chat', 'daylight', CHAT, ON_TRANSCRIPT),
  planned('play', DESKTOP, 'look-editor', 'ember', LOOK_EDITOR),
  planned('play', PHONE, 'chat', 'ember', CHAT, ON_TRANSCRIPT),
  planned('play', PHONE, 'menu', 'ember', CHAT, { transcript: true, step: 'open-menu' }),
  planned('play', PHONE, 'conversations', 'ember', CONVERSATIONS, ON_TRANSCRIPT),
  planned('play', PHONE, 'voice-listening', 'ember', CHAT, LISTENING),
])

/** A shot's file name: `<theme>-<width>-<what>-<look>.png`. */
export function showcaseFile(shot: ShowcaseShot): string {
  return `${shot.theme}-${shot.viewport.width}-${shot.what}-${shot.look}${SHOT_SUFFIX}`
}

/** Where a theme's `automatos-theme dev` serves its harness. */
export function showcaseOrigin(theme: ShowcaseTheme): string {
  return `http://${HARNESS_HOST}:${SHOWCASE_PORTS[theme]}`
}

/**
 * The address a shot opens on its theme's server: its view's path in its look at its width, with reduced motion, its
 * conversation and voice phase, no toolbar, on the hosted edition.
 */
export function showcaseUrl(shot: ShowcaseShot): string {
  const { view, look, viewport, transcript, voice } = shot
  const settings = {
    ...DEFAULT_SETTINGS, path: view.path, preset: look, width: viewport.width, reducedMotion: true, transcript, voice, toolbar: false,
    edition: SHOWCASE_EDITION,
  }
  return `${showcaseOrigin(shot.theme)}/${settingsQuery(settings)}`
}
