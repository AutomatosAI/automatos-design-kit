/**
 * The showcase shots: clean images of the kit's themes, HUD, Play, Arcade and Candy, for READMEs, docs, the product site and
 * the Marketplace listings' previews,
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
 *   (src/host/voice.ts);
 * - with the demo extras over it (src/host/demo.ts) that a member's workspace in use shows: every agent active on every
 *   shot; on each of Play's shots on a conversation, the session's hello already played, so Auto is at rest beside it,
 *   as Play greets on its first open (the first-open shot keeps his hello); and on Play's Conversations, five older
 *   conversations beside the shortlist.
 * No axe scan: the regression shots scan the same views. HUD draws no Command Centre of its own (its theme.json
 * declares no such page, so the host's page would stand in its frame), so none is shot.
 *
 * The proactive area (SDK 1.3.0): every shot has the sample day's brief and its open suggestions (src/host/sample-data.ts)
 * but the first open, which is the day without one (`brief: false`, the workspace's brief off), so Play greets as it
 * does on a first open, and HUD's chat, voice, panel and approval shots, which are its screen once the brief has folded
 * back. Play's proactive shots (PRD-268 US-K01) draw the brief on an empty chat in Ember and in Daylight (the Paper
 * ground), the newest suggestion opened from its line pinned above the message box (`open-suggestion`), and an
 * approval waiting in Auto's reply: the shot sends the member's words (`ask-approval`, into the theme's message box
 * named by `composer`, after the button named by `opensComposer` where the box opens from one) and the demo extra
 * `approval-turn` answers them with the recorded turn that raises one. HUD's (US-K02) draw BRIEFING on every look at
 * both widths, one at each width after a press of the host's Listen (`listen`: Auto reading it, `▸ SPEAKING`), its
 * MISSIONS and SYSTEMS panels with each heading scrolled into view first (`scroll-to-heading`), and the same approval
 * (its suggestion, the `▸ NEXT` line, is on every one of its chat shots).
 *
 * SDK 1.4.0, the message parts (HUD 1.3.0, PRD-268): the transcript's reply carries a suggestion and reply
 * chips, so HUD's chat shots on it show its SAY chips under Auto's reply and his suggestion's card in it. HUD's own
 * shots of them scroll the chips into view (`scroll-to-replies`, in ARC and SIGNAL at 1440, ARC at 390) or the card's
 * heading (`thread-suggestion`); draw the brief as a message in the conversation, the chat opened on Auto's thread
 * holding the brief (the demo extra `brief-thread`) with its heading scrolled into view; and draw BRIEFING mid-reading,
 * Auto on the brief's third row from the page's start (the demo extra `brief-row`), the row marked where it is read.
 *
 * Each shot's file is `<theme>-<width>-<what>-<look>.png` (showcaseFile), in SHOWCASE_FOLDER of the harness package.
 */
import {
  DEFAULT_SETTINGS, HARNESS_HOST, pagePath, PHONE_VIEWPORT, routePath, settingsQuery, SHOT_SUFFIX, SHOT_WIDTHS, slotPath,
  type HarnessEdition, type HarnessVoicePhase, type View,
} from './router.ts'
import type { DemoExtra } from './demo.ts'
import { CHAT_PAGE, DESKTOP_HEIGHT, type Viewport } from './shot-groups.ts'

/** The kit's themes the showcase draws, by their folder under themes/. */
export const SHOWCASE_THEMES = Object.freeze(['hud', 'play', 'arcade', 'candy'] as const)
export type ShowcaseTheme = (typeof SHOWCASE_THEMES)[number]

/**
 * Each theme's `automatos-theme dev` port: one server per theme, beside the shots' 4318 and `dev`'s own 4319, so the
 * showcase never meets the smoke's or the phone shots' server.
 */
export const SHOWCASE_PORTS: Readonly<Record<ShowcaseTheme, number>> = Object.freeze({ hud: 4320, play: 4321, arcade: 4322, candy: 4323 })
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

/**
 * What the spec does on the page before the shot: nothing; open the theme's phone menu (its Menu button); open the
 * pinned suggestion's full card from its line; send APPROVAL_ASK from the theme's message box and wait for the
 * approval card the answer raises; press the host's Listen for the day's brief and wait until Auto reads it; scroll
 * the shot's heading into view; or scroll the reply chips (the group HUD_REPLIES) into view.
 */
export type ShowcaseStep = 'none' | 'open-menu' | 'open-suggestion' | 'ask-approval' | 'listen' | 'scroll-to-heading' | 'scroll-to-replies'

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
  /** True: the sample day's brief (the harness page's default); false: no brief today (`brief=off`, the workspace's brief off). */
  readonly brief: boolean
  readonly step: ShowcaseStep
  /** The theme's message box, by its accessible name, that `ask-approval` types into. */
  readonly composer?: string
  /** A button that opens the theme's message box first, by its accessible name (HUD's phone opens it from TYPE). */
  readonly opensComposer?: string
  /** A heading the view must show (the first open's greeting), when the shot is one the theme names so. */
  readonly heading?: string
  /** The demo extras over the sample data. */
  readonly demo: readonly DemoExtra[]
}

const LOOK_EDITOR_SLOT = 'lookEditor@1'
const CONVERSATIONS_ROUTE = 'conversations'
const QUESTS_ROUTE = 'quests'
const DELIVERABLES_PAGE = '/deliverables'
/** Play's message box, by its name (themes/play/src/components/play/chat/message-box.tsx PLACEHOLDER). */
export const PLAY_MESSAGE_BOX = 'Message Auto'
/** HUD's message box and the phone's TYPE that opens it (themes/hud/src/chat/composer.tsx PLACEHOLDER, phone-controls.tsx TYPE_LABEL). */
export const HUD_MESSAGE_BOX = 'Message Auto'
export const HUD_TYPE = 'Type'
/** What `ask-approval` sends: the made-up request the recorded approval turn answers. */
export const APPROVAL_ASK = "Remind the parents' group about the bake sale"

/**
 * Play's hello: the first open's heading (themes/play/src/components/play/chat/first-open.tsx HELLO_TITLE), and Auto's
 * caption while he plays it (packages/mascot/src/media.ts), which no shot after the hello shows.
 */
export const PLAY_HELLO = "Hi, I'm Auto."
/** The host's Listen for the day's brief, by its name (src/sdk/brief-voice.tsx LISTEN_TO_THE_BRIEF). */
export const BRIEF_LISTEN = 'Listen to the brief'
/** HUD's MISSIONS and SYSTEMS panels, by their headings (themes/hud/src/chat/panels/missions-panel.tsx, systems-panel.tsx). */
export const HUD_MISSIONS = 'Missions'
export const HUD_SYSTEMS = 'Systems'
/**
 * HUD 1.3.0's parts of a message, by their names: the reply chips' group (themes/hud/src/chat/thread/say-replies.tsx),
 * the brief's heading in the conversation (thread-brief.tsx) and a suggestion card's (thread-suggestion.tsx).
 */
export const HUD_REPLIES = 'Replies'
export const HUD_THREAD_BRIEF = 'Brief'
export const HUD_SUGGESTS = 'Auto suggests'

const CHAT: View = Object.freeze<View>({ kind: 'page', key: CHAT_PAGE, path: pagePath(CHAT_PAGE) })
const LOOK_EDITOR: View = Object.freeze<View>({ kind: 'slot', key: LOOK_EDITOR_SLOT, path: slotPath(LOOK_EDITOR_SLOT) })
const CONVERSATIONS: View = Object.freeze<View>({ kind: 'route', key: CONVERSATIONS_ROUTE, path: routePath(CONVERSATIONS_ROUTE) })
const QUESTS: View = Object.freeze<View>({ kind: 'route', key: QUESTS_ROUTE, path: routePath(QUESTS_ROUTE) })
const INVENTORY: View = Object.freeze<View>({ kind: 'page', key: DELIVERABLES_PAGE, path: pagePath(DELIVERABLES_PAGE) })
const TODAY_ROUTE = 'today'
const AGENTS_ROUTE = 'agents'
const TODAY: View = Object.freeze<View>({ kind: 'route', key: TODAY_ROUTE, path: routePath(TODAY_ROUTE) })
const TEAM: View = Object.freeze<View>({ kind: 'route', key: AGENTS_ROUTE, path: routePath(AGENTS_ROUTE) })

type ShotChanges = Partial<Pick<ShowcaseShot, 'transcript' | 'voice' | 'brief' | 'step' | 'composer' | 'opensComposer' | 'heading' | 'demo'>>

/** Every shot's extra: the roster with every agent active, as HUD's AGENTS panel lists it. */
const HEALTHY: readonly DemoExtra[] = Object.freeze(['healthy-agents'])

/** A shot on a new chat with no voice session and nothing pressed, every agent active, but for `changes`. */
function planned(
  theme: ShowcaseTheme, viewport: Viewport, what: string, look: string, view: View, changes: ShotChanges = {},
): ShowcaseShot {
  const made: ShowcaseShot = {
    theme, viewport, what, look, view, transcript: false, voice: DEFAULT_SETTINGS.voice, brief: DEFAULT_SETTINGS.brief, step: 'none',
    demo: HEALTHY,
  }
  return Object.freeze({ ...made, ...changes })
}

/** Play on a conversation: `changes`, with the session's hello already played, and any more extras. */
function afterHello(changes: ShotChanges, ...more: readonly DemoExtra[]): ShotChanges {
  const demo: readonly DemoExtra[] = Object.freeze([...HEALTHY, ...more, 'hello-played'])
  return Object.freeze({ ...changes, demo })
}

const DESKTOP = SHOWCASE_DESKTOP
const PHONE = SHOWCASE_PHONE
const ON_TRANSCRIPT: ShotChanges = Object.freeze<ShotChanges>({ transcript: true })
const LISTENING: ShotChanges = Object.freeze<ShotChanges>({ transcript: true, voice: 'listening' })
const SPEAKING: ShotChanges = Object.freeze<ShotChanges>({ transcript: true, voice: 'speaking' })
const MENU: ShotChanges = Object.freeze<ShotChanges>({ transcript: true, step: 'open-menu' })
/** The first open: an empty chat on a day without a brief, so the greeting stands where the brief would. */
const FIRST_OPEN: ShotChanges = Object.freeze<ShotChanges>({ heading: PLAY_HELLO, brief: false })
const OPEN_SUGGESTION: ShotChanges = Object.freeze<ShotChanges>({ transcript: true, step: 'open-suggestion' })
const ASK_APPROVAL: ShotChanges = Object.freeze<ShotChanges>({ transcript: true, step: 'ask-approval', composer: PLAY_MESSAGE_BOX })
/** HUD's screen once the brief has folded back: its chat and voice shots. */
const FOLDED: ShotChanges = Object.freeze<ShotChanges>({ ...ON_TRANSCRIPT, brief: false })
const FOLDED_LISTENING: ShotChanges = Object.freeze<ShotChanges>({ ...LISTENING, brief: false })
const FOLDED_SPEAKING: ShotChanges = Object.freeze<ShotChanges>({ ...SPEAKING, brief: false })
/** HUD's BRIEFING on the conversation, and while Auto reads it. */
const BRIEFING: ShotChanges = Object.freeze<ShotChanges>({ transcript: true, brief: true })
const BRIEFING_READ: ShotChanges = Object.freeze<ShotChanges>({ ...BRIEFING, step: 'listen' })
/** A HUD panel scrolled into view, on the folded screen. */
const PANEL = (heading: string): ShotChanges => Object.freeze<ShotChanges>({ ...FOLDED, step: 'scroll-to-heading', heading })
/** HUD's approval, on the folded screen, answered by the recorded approval turn; on the phone its box opens from TYPE. */
const APPROVAL_DEMO: readonly DemoExtra[] = Object.freeze([...HEALTHY, 'approval-turn'])
const HUD_APPROVAL: ShotChanges = Object.freeze<ShotChanges>({ ...FOLDED, step: 'ask-approval', composer: HUD_MESSAGE_BOX, demo: APPROVAL_DEMO })
const HUD_PHONE_APPROVAL: ShotChanges = Object.freeze<ShotChanges>({ ...HUD_APPROVAL, opensComposer: HUD_TYPE })
/** HUD's five looks, for the shots drawn on each. */
const HUD_LOOKS = Object.freeze(['arc', 'forge', 'ghost', 'nova', 'signal'] as const)
/** HUD 1.3.0: its SAY chips under Auto's reply, and his suggestion's card, on the folded screen, each scrolled into view. */
const HUD_SAY: ShotChanges = Object.freeze<ShotChanges>({ ...FOLDED, step: 'scroll-to-replies' })
const HUD_THREAD_SUGGESTION: ShotChanges = Object.freeze<ShotChanges>({ ...FOLDED, step: 'scroll-to-heading', heading: HUD_SUGGESTS })
/** The brief as a message: the chat on Auto's thread holding it, BRIEFING folded, the brief's heading in view. */
const BRIEF_THREAD_DEMO: readonly DemoExtra[] = Object.freeze([...HEALTHY, 'brief-thread'])
const HUD_THREAD_BRIEF_SHOT: ShotChanges = Object.freeze<ShotChanges>({
  brief: false, step: 'scroll-to-heading', heading: HUD_THREAD_BRIEF, demo: BRIEF_THREAD_DEMO,
})
/** BRIEFING while Auto reads a row of the brief. */
const BRIEF_ROW_DEMO: readonly DemoExtra[] = Object.freeze([...HEALTHY, 'brief-row'])
const HUD_BRIEFING_ROW: ShotChanges = Object.freeze<ShotChanges>({ ...BRIEFING, demo: BRIEF_ROW_DEMO })

/** Every showcase shot, theme by theme, the desktop's before the phone's. */
export const SHOWCASE_SHOTS: readonly ShowcaseShot[] = Object.freeze([
  planned('hud', DESKTOP, 'chat', 'arc', CHAT, FOLDED),
  planned('hud', DESKTOP, 'chat', 'forge', CHAT, FOLDED),
  planned('hud', DESKTOP, 'chat', 'ghost', CHAT, FOLDED),
  planned('hud', DESKTOP, 'chat', 'nova', CHAT, FOLDED),
  planned('hud', DESKTOP, 'chat', 'signal', CHAT, FOLDED),
  planned('hud', DESKTOP, 'voice-listening', 'arc', CHAT, FOLDED_LISTENING),
  planned('hud', DESKTOP, 'voice-speaking', 'forge', CHAT, FOLDED_SPEAKING),
  planned('hud', DESKTOP, 'look-editor', 'arc', LOOK_EDITOR),
  ...HUD_LOOKS.map((look) => planned('hud', DESKTOP, 'briefing', look, CHAT, BRIEFING)),
  planned('hud', DESKTOP, 'briefing-speaking', 'arc', CHAT, BRIEFING_READ),
  planned('hud', DESKTOP, 'missions', 'arc', CHAT, PANEL(HUD_MISSIONS)),
  planned('hud', DESKTOP, 'systems', 'arc', CHAT, PANEL(HUD_SYSTEMS)),
  planned('hud', DESKTOP, 'approval', 'arc', CHAT, HUD_APPROVAL),
  planned('hud', DESKTOP, 'say', 'arc', CHAT, HUD_SAY),
  planned('hud', DESKTOP, 'say', 'signal', CHAT, HUD_SAY),
  planned('hud', DESKTOP, 'thread-brief', 'arc', CHAT, HUD_THREAD_BRIEF_SHOT),
  planned('hud', DESKTOP, 'thread-suggestion', 'arc', CHAT, HUD_THREAD_SUGGESTION),
  planned('hud', DESKTOP, 'briefing-row', 'arc', CHAT, HUD_BRIEFING_ROW),
  planned('hud', PHONE, 'chat', 'arc', CHAT, FOLDED),
  planned('hud', PHONE, 'voice-listening', 'forge', CHAT, FOLDED_LISTENING),
  planned('hud', PHONE, 'look-editor', 'arc', LOOK_EDITOR),
  planned('hud', PHONE, 'voice-speaking', 'arc', CHAT, FOLDED_SPEAKING),
  ...HUD_LOOKS.map((look) => planned('hud', PHONE, 'briefing', look, CHAT, BRIEFING)),
  planned('hud', PHONE, 'briefing-speaking', 'arc', CHAT, BRIEFING_READ),
  planned('hud', PHONE, 'approval', 'arc', CHAT, HUD_PHONE_APPROVAL),
  planned('hud', PHONE, 'say', 'arc', CHAT, HUD_SAY),
  planned('hud', PHONE, 'thread-brief', 'arc', CHAT, HUD_THREAD_BRIEF_SHOT),
  planned('hud', PHONE, 'thread-suggestion', 'arc', CHAT, HUD_THREAD_SUGGESTION),
  planned('hud', PHONE, 'briefing-row', 'arc', CHAT, HUD_BRIEFING_ROW),
  planned('play', DESKTOP, 'first-open', 'ember', CHAT, FIRST_OPEN),
  planned('play', DESKTOP, 'chat', 'ember', CHAT, afterHello(ON_TRANSCRIPT)),
  planned('play', DESKTOP, 'voice-speaking', 'ember', CHAT, afterHello(SPEAKING)),
  planned('play', DESKTOP, 'chat', 'daylight', CHAT, afterHello(ON_TRANSCRIPT)),
  planned('play', DESKTOP, 'look-editor', 'ember', LOOK_EDITOR),
  planned('play', DESKTOP, 'brief', 'ember', CHAT),
  planned('play', DESKTOP, 'brief', 'daylight', CHAT),
  planned('play', DESKTOP, 'suggestion', 'ember', CHAT, afterHello(OPEN_SUGGESTION)),
  planned('play', DESKTOP, 'approval', 'ember', CHAT, afterHello(ASK_APPROVAL, 'approval-turn')),
  planned('play', PHONE, 'chat', 'ember', CHAT, afterHello(ON_TRANSCRIPT)),
  planned('play', PHONE, 'menu', 'ember', CHAT, afterHello(MENU)),
  planned('play', PHONE, 'conversations', 'ember', CONVERSATIONS, afterHello(ON_TRANSCRIPT, 'older-chats')),
  planned('play', PHONE, 'voice-listening', 'ember', CHAT, afterHello(LISTENING)),
  planned('play', PHONE, 'brief', 'ember', CHAT),
  planned('play', PHONE, 'suggestion', 'ember', CHAT, afterHello(OPEN_SUGGESTION)),
  planned('play', PHONE, 'approval', 'ember', CHAT, afterHello(ASK_APPROVAL, 'approval-turn')),
  planned('arcade', DESKTOP, 'chat', 'overworld', CHAT, ON_TRANSCRIPT),
  planned('arcade', DESKTOP, 'chat', 'dungeon', CHAT, ON_TRANSCRIPT),
  planned('arcade', DESKTOP, 'chat', 'neon', CHAT, ON_TRANSCRIPT),
  planned('arcade', DESKTOP, 'chat', 'nightcity', CHAT, ON_TRANSCRIPT),
  planned('arcade', DESKTOP, 'chat', 'handheld', CHAT, ON_TRANSCRIPT),
  planned('arcade', DESKTOP, 'quests', 'overworld', QUESTS),
  planned('arcade', DESKTOP, 'inventory', 'overworld', INVENTORY),
  planned('arcade', DESKTOP, 'look-editor', 'overworld', LOOK_EDITOR),
  planned('arcade', PHONE, 'chat', 'overworld', CHAT, ON_TRANSCRIPT),
  planned('arcade', PHONE, 'chat', 'handheld', CHAT, ON_TRANSCRIPT),
  planned('candy', DESKTOP, 'today', 'blush', TODAY),
  planned('candy', DESKTOP, 'today', 'lilac', TODAY),
  planned('candy', DESKTOP, 'today', 'nightbloom', TODAY),
  planned('candy', DESKTOP, 'chat', 'blush', CHAT, ON_TRANSCRIPT),
  planned('candy', DESKTOP, 'deliverables', 'blush', INVENTORY),
  planned('candy', DESKTOP, 'team', 'blush', TEAM),
  planned('candy', DESKTOP, 'look-editor', 'blush', LOOK_EDITOR),
  planned('candy', DESKTOP, 'chat', 'nightbloom', CHAT, ON_TRANSCRIPT),
  planned('candy', PHONE, 'today', 'blush', TODAY),
  planned('candy', PHONE, 'chat', 'blush', CHAT, ON_TRANSCRIPT),
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
 * conversation, voice phase and brief, no toolbar, on the hosted edition, with its demo extras.
 */
export function showcaseUrl(shot: ShowcaseShot): string {
  const { view, look, viewport, transcript, voice, brief, demo } = shot
  const settings = {
    ...DEFAULT_SETTINGS, path: view.path, preset: look, width: viewport.width, reducedMotion: true, transcript, voice, brief,
    toolbar: false, edition: SHOWCASE_EDITION, demo,
  }
  return `${showcaseOrigin(shot.theme)}/${settingsQuery(settings)}`
}
