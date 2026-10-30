// @vitest-environment node
// The showcase shots' plan (src/host/showcase.ts), which shots/showcase.spec.ts shoots: the images of HUD and Play for
// READMEs, docs and the product site. Each is one view a theme declares, in a preset it has, at the desktop's
// 1440 × 900 or the phone's 390 × 844, named `<theme>-<width>-<what>-<look>.png`, and opened on the hosted edition
// with reduced motion and no toolbar, on its theme's own server, under a clock fixed inside the fixtures' made-up day,
// with the demo extras a workspace in use shows: every agent active; Play's hello played before each of its
// conversations (its first open keeps it), under the key and state Play keeps it in; older conversations on its list.
// SDK 1.3.0's proactive area: the sample day's brief on every shot but the first open (a day without one) and HUD's
// chat, voice, panel and approval shots (its screen once the brief has folded back); Play's proactive shots (PRD-268
// US-K01): the brief, the suggestion opened from its pinned line, and an approval its recorded answer raises, at 1440
// and at 390; HUD's (US-K02): BRIEFING on every look at both widths, one at each width while Auto reads it, MISSIONS and
// SYSTEMS scrolled into view, and the same approval, its phone's message box opened from TYPE.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { declaredIn, DEV_PORT, HARNESS_PORT, PHONE_VIEWPORT, PRESET_SUFFIX, readSettings, type View } from '../src/host/router.ts'
import { HELLO_KEY, HELLO_STATE } from '../src/host/demo.ts'
import { DESKTOP_HEIGHT } from '../src/host/shot-groups.ts'
import {
  APPROVAL_ASK, BRIEF_LISTEN, HUD_MESSAGE_BOX, HUD_MISSIONS, HUD_SYSTEMS, HUD_TYPE, PLAY_HELLO, PLAY_MESSAGE_BOX, SHOWCASE_EDITION,
  SHOWCASE_FOLDER, SHOWCASE_PORTS, SHOWCASE_SCALE, SHOWCASE_SHOTS, SHOWCASE_THEMES, SHOWCASE_TIME,
  showcaseFile, showcaseOrigin, showcaseUrl, type ShowcaseShot, type ShowcaseTheme,
} from '../src/host/showcase.ts'

const HARNESS_DIR = fileURLToPath(new URL('..', import.meta.url))
const THEMES_DIR = join(HARNESS_DIR, '../../themes')
/** Play's presets are built from its catalogue (its looks/ is generated): the ids it names. */
const PLAY_PRESETS = join(THEMES_DIR, 'play/src/lib/looks/presets.ts')
const HUD_PRESETS = join(THEMES_DIR, 'hud/looks/presets')
const ARCADE_PRESETS = join(THEMES_DIR, 'arcade/looks/presets')
const CANDY_PRESETS = join(THEMES_DIR, 'candy/looks/presets')
const TRANSCRIPT = join(HARNESS_DIR, 'fixtures/conversations/transcript.json')
const OLDER_CHATS = join(HARNESS_DIR, 'fixtures/conversations/showcase.json')
/** Where Play keeps its hello in theme state, and where its first open names it. */
const PLAY_SESSION = join(THEMES_DIR, 'play/src/lib/mascot/session.ts')
const PLAY_FIRST_OPEN = join(THEMES_DIR, 'play/src/components/play/chat/first-open.tsx')
const PLAY_MESSAGE_BOX_SOURCE = join(THEMES_DIR, 'play/src/components/play/chat/message-box.tsx')
const TURNS = join(HARNESS_DIR, 'fixtures/streams/turns.json')
const SCHEDULE = join(HARNESS_DIR, 'fixtures/activity/schedule.json')
/** The host's Listen stand-in, which names its button, and HUD's two panels the showcase scrolls to. */
const BRIEF_VOICE = join(HARNESS_DIR, 'src/sdk/brief-voice.tsx')
const HUD_PANELS = join(THEMES_DIR, 'hud/src/chat/panels')
/** HUD's chat, whose message box and phone TYPE the approval shots name. */
const HUD_CHAT = join(THEMES_DIR, 'hud/src/chat')

/** The shot list, as the showcase is asked for: HUD's, Play's, Arcade's, then Candy's, the desktop's before the phone's. */
const EXPECTED_FILES = [
  'hud-1440-chat-arc.png',
  'hud-1440-chat-forge.png',
  'hud-1440-chat-ghost.png',
  'hud-1440-chat-nova.png',
  'hud-1440-chat-signal.png',
  'hud-1440-voice-listening-arc.png',
  'hud-1440-voice-speaking-forge.png',
  'hud-1440-look-editor-arc.png',
  'hud-1440-briefing-arc.png',
  'hud-1440-briefing-forge.png',
  'hud-1440-briefing-ghost.png',
  'hud-1440-briefing-nova.png',
  'hud-1440-briefing-signal.png',
  'hud-1440-briefing-speaking-arc.png',
  'hud-1440-missions-arc.png',
  'hud-1440-systems-arc.png',
  'hud-1440-approval-arc.png',
  'hud-390-chat-arc.png',
  'hud-390-voice-listening-forge.png',
  'hud-390-look-editor-arc.png',
  'hud-390-voice-speaking-arc.png',
  'hud-390-briefing-arc.png',
  'hud-390-briefing-forge.png',
  'hud-390-briefing-ghost.png',
  'hud-390-briefing-nova.png',
  'hud-390-briefing-signal.png',
  'hud-390-briefing-speaking-arc.png',
  'hud-390-approval-arc.png',
  'play-1440-first-open-ember.png',
  'play-1440-chat-ember.png',
  'play-1440-voice-speaking-ember.png',
  'play-1440-chat-daylight.png',
  'play-1440-look-editor-ember.png',
  'play-1440-brief-ember.png',
  'play-1440-brief-daylight.png',
  'play-1440-suggestion-ember.png',
  'play-1440-approval-ember.png',
  'play-390-chat-ember.png',
  'play-390-menu-ember.png',
  'play-390-conversations-ember.png',
  'play-390-voice-listening-ember.png',
  'play-390-brief-ember.png',
  'play-390-suggestion-ember.png',
  'play-390-approval-ember.png',
  'arcade-1440-chat-overworld.png',
  'arcade-1440-chat-dungeon.png',
  'arcade-1440-chat-neon.png',
  'arcade-1440-chat-nightcity.png',
  'arcade-1440-chat-handheld.png',
  'arcade-1440-quests-overworld.png',
  'arcade-1440-inventory-overworld.png',
  'arcade-1440-look-editor-overworld.png',
  'arcade-390-chat-overworld.png',
  'arcade-390-chat-handheld.png',
  'candy-1440-today-blush.png',
  'candy-1440-today-lilac.png',
  'candy-1440-today-nightbloom.png',
  'candy-1440-chat-blush.png',
  'candy-1440-deliverables-blush.png',
  'candy-1440-team-blush.png',
  'candy-1440-look-editor-blush.png',
  'candy-1440-chat-nightbloom.png',
  'candy-390-today-blush.png',
  'candy-390-chat-blush.png',
]

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown
}

/** True when `theme` has a preset `look`: HUD's, Arcade's and Candy's committed preset files, Play's catalogue entry. */
function hasPreset(theme: ShowcaseTheme, look: string): boolean {
  if (theme === 'hud') return existsSync(join(HUD_PRESETS, `${look}${PRESET_SUFFIX}`))
  if (theme === 'arcade') return existsSync(join(ARCADE_PRESETS, `${look}${PRESET_SUFFIX}`))
  if (theme === 'candy') return existsSync(join(CANDY_PRESETS, `${look}${PRESET_SUFFIX}`))
  return readFileSync(PLAY_PRESETS, 'utf8').includes(`id: '${look}'`)
}

/** True when the theme's theme.json declares the view: the slot, the page or the route. */
function declares(theme: ShowcaseTheme, view: View): boolean {
  const declared = declaredIn(readJson(join(THEMES_DIR, theme, 'theme.json')))
  if (view.kind === 'slot') return declared.slots.includes(view.key)
  if (view.kind === 'page') return declared.pages.includes(view.key)
  return view.kind === 'route' && declared.routes.includes(view.key)
}

/** Each shot by its file name, for the tests that run once per shot. */
const BY_FILE: Array<[string, ShowcaseShot]> = SHOWCASE_SHOTS.map((shot): [string, ShowcaseShot] => [showcaseFile(shot), shot])

describe('the showcase shots', () => {
  it('are the shot list asked for, each named <theme>-<width>-<what>-<look>.png, no two on one name', () => {
    const files = SHOWCASE_SHOTS.map(showcaseFile)
    expect(files).toEqual(EXPECTED_FILES)
    expect(new Set(files).size).toBe(files.length)
    files.forEach((file) => expect(file).toMatch(/^(hud|play|arcade|candy)-(1440|390)-[a-z]+(-[a-z]+)*-[a-z]+\.png$/))
  })

  it("draw only the kit's HUD, Play, Arcade and Candy, at the desktop's 1440 × 900 or the phone's 390 × 844", () => {
    expect(SHOWCASE_THEMES).toEqual(['hud', 'play', 'arcade', 'candy'])
    const sizes = new Set(SHOWCASE_SHOTS.map((shot) => `${shot.viewport.width}x${shot.viewport.height}`))
    expect([...sizes].sort()).toEqual([`1440x${DESKTOP_HEIGHT}`, `${PHONE_VIEWPORT.width}x${PHONE_VIEWPORT.height}`].sort())
  })

  it.each(BY_FILE)('%s: a view its theme declares, in a preset it has', (_file, shot) => {
    expect(declares(shot.theme, shot.view)).toBe(true)
    expect(hasPreset(shot.theme, shot.look)).toBe(true)
  })

  it.each(BY_FILE)("%s: opens on its theme's server, on the hosted edition, with reduced motion and no toolbar", (_file, shot) => {
    const url = new URL(showcaseUrl(shot))
    expect(url.origin).toBe(showcaseOrigin(shot.theme))
    expect(url.pathname).toBe('/')
    expect(readSettings(url.search)).toEqual({
      path: shot.view.path, preset: shot.look, width: shot.viewport.width, tone: 'light', reducedMotion: true, forcedColors: false,
      transcript: shot.transcript, voice: shot.voice, brief: shot.brief, toolbar: false, edition: 'saas', demo: shot.demo,
    })
  })

  it('draw every agent active, and Play after its hello on each of its conversations, older ones on its list', () => {
    expect(SHOWCASE_SHOTS.every((shot) => shot.demo.includes('healthy-agents'))).toBe(true)
    const afterHello = SHOWCASE_SHOTS.filter((shot) => shot.demo.includes('hello-played'))
    const playOnAConversation = SHOWCASE_SHOTS.filter((shot) => shot.theme === 'play' && shot.transcript)
    expect(afterHello.map(showcaseFile)).toEqual(playOnAConversation.map(showcaseFile))
    expect(SHOWCASE_SHOTS.filter((shot) => shot.demo.includes('older-chats')).map(showcaseFile)).toEqual(['play-390-conversations-ember.png'])
  })

  it('show the laptop-shortlist conversation on every chat but the first open and the brief, and the voice only on the chat', () => {
    const chats = SHOWCASE_SHOTS.filter((shot) => shot.view.key === '/chat')
    expect(chats.filter((shot) => !shot.transcript).map(showcaseFile)).toEqual([
      'play-1440-first-open-ember.png', 'play-1440-brief-ember.png', 'play-1440-brief-daylight.png', 'play-390-brief-ember.png',
    ])
    const voiced = SHOWCASE_SHOTS.filter((shot) => shot.voice !== 'idle')
    expect(voiced.length).toBeGreaterThan(0)
    expect(voiced.every((shot) => shot.view.key === '/chat' && shot.transcript)).toBe(true)
    expect(SHOWCASE_SHOTS.filter((shot) => shot.step === 'open-menu').map(showcaseFile)).toEqual(['play-390-menu-ember.png'])
  })

  it("draw HUD's BRIEFING on every look at both widths, with the brief, and Auto reading it at each width", () => {
    const hudChats = SHOWCASE_SHOTS.filter((shot) => shot.theme === 'hud' && shot.view.key === '/chat')
    const briefed = hudChats.filter((shot) => shot.brief).map(showcaseFile)
    const looks = ['arc', 'forge', 'ghost', 'nova', 'signal']
    expect(briefed).toEqual([
      ...looks.map((look) => `hud-1440-briefing-${look}.png`), 'hud-1440-briefing-speaking-arc.png',
      ...looks.map((look) => `hud-390-briefing-${look}.png`), 'hud-390-briefing-speaking-arc.png',
    ])
    expect(SHOWCASE_SHOTS.filter((shot) => shot.step === 'listen').map(showcaseFile)).toEqual([
      'hud-1440-briefing-speaking-arc.png', 'hud-390-briefing-speaking-arc.png',
    ])
    expect(SHOWCASE_SHOTS.filter((shot) => shot.step === 'listen').every((shot) => shot.brief && shot.voice === 'idle')).toBe(true)
  })

  it("draw the day's brief on every shot but the first open and HUD's screen once its brief has folded back", () => {
    expect(SHOWCASE_SHOTS.filter((shot) => !shot.brief).map(showcaseFile)).toEqual([
      'hud-1440-chat-arc.png', 'hud-1440-chat-forge.png', 'hud-1440-chat-ghost.png', 'hud-1440-chat-nova.png',
      'hud-1440-chat-signal.png', 'hud-1440-voice-listening-arc.png', 'hud-1440-voice-speaking-forge.png',
      'hud-1440-missions-arc.png', 'hud-1440-systems-arc.png', 'hud-1440-approval-arc.png',
      'hud-390-chat-arc.png', 'hud-390-voice-listening-forge.png', 'hud-390-voice-speaking-arc.png', 'hud-390-approval-arc.png',
      'play-1440-first-open-ember.png',
    ])
    const scrolled = SHOWCASE_SHOTS.filter((shot) => shot.step === 'scroll-to-heading')
    expect(scrolled.map((shot) => [showcaseFile(shot), shot.heading])).toEqual([
      ['hud-1440-missions-arc.png', HUD_MISSIONS],
      ['hud-1440-systems-arc.png', HUD_SYSTEMS],
    ])
  })

  it("open the pinned suggestion, and ask for an approval in each theme's message box with its recorded answer, on a conversation", () => {
    const opened = SHOWCASE_SHOTS.filter((shot) => shot.step === 'open-suggestion')
    expect(opened.map(showcaseFile)).toEqual(['play-1440-suggestion-ember.png', 'play-390-suggestion-ember.png'])
    const asked = SHOWCASE_SHOTS.filter((shot) => shot.step === 'ask-approval')
    expect(asked.map(showcaseFile)).toEqual([
      'hud-1440-approval-arc.png', 'hud-390-approval-arc.png', 'play-1440-approval-ember.png', 'play-390-approval-ember.png',
    ])
    expect([...opened, ...asked].every((shot) => shot.transcript)).toBe(true)
    const boxOf = (shot: ShowcaseShot): string => (shot.theme === 'hud' ? HUD_MESSAGE_BOX : PLAY_MESSAGE_BOX)
    expect(asked.every((shot) => shot.composer === boxOf(shot) && shot.demo.includes('approval-turn'))).toBe(true)
    expect(SHOWCASE_SHOTS.filter((shot) => shot.demo.includes('approval-turn'))).toEqual(asked)
    expect(SHOWCASE_SHOTS.filter((shot) => shot.composer !== undefined)).toEqual(asked)
    expect(SHOWCASE_SHOTS.filter((shot) => shot.opensComposer !== undefined).map((shot) => [showcaseFile(shot), shot.opensComposer]))
      .toEqual([['hud-390-approval-arc.png', HUD_TYPE]])
  })
})

describe('the names the steps look for', () => {
  it("are the host's Listen, HUD's MISSIONS and SYSTEMS headings, and HUD's message box and the phone's TYPE", () => {
    expect(readFileSync(BRIEF_VOICE, 'utf8')).toContain(`export const LISTEN_TO_THE_BRIEF = '${BRIEF_LISTEN}'`)
    expect(readFileSync(join(HUD_PANELS, 'missions-panel.tsx'), 'utf8')).toContain(`export const MISSIONS_TITLE = '${HUD_MISSIONS}'`)
    expect(readFileSync(join(HUD_PANELS, 'systems-panel.tsx'), 'utf8')).toContain(`export const SYSTEMS_TITLE = '${HUD_SYSTEMS}'`)
    expect(readFileSync(join(HUD_CHAT, 'composer.tsx'), 'utf8')).toContain(`export const PLACEHOLDER = '${HUD_MESSAGE_BOX}'`)
    expect(readFileSync(join(HUD_CHAT, 'phone/phone-controls.tsx'), 'utf8')).toContain(`export const TYPE_LABEL = '${HUD_TYPE}'`)
  })
})

describe("the demo extras' data", () => {
  it("marks Play's hello played under the key and state Play keeps it in, and names it as Play's first open does", () => {
    const session = readFileSync(PLAY_SESSION, 'utf8')
    expect(session).toContain(`export const HELLO_KEY = '${HELLO_KEY}'`)
    expect(session).toContain(`Object.freeze({ lifetime: '${HELLO_STATE.lifetime}', within: '${HELLO_STATE.within}' })`)
    expect(readFileSync(PLAY_FIRST_OPEN, 'utf8')).toContain(`export const HELLO_TITLE = ${JSON.stringify(PLAY_HELLO)}`)
  })

  it("names Play's message box as Play does, and asks in words of its own the recorded approval turn answers", () => {
    expect(readFileSync(PLAY_MESSAGE_BOX_SOURCE, 'utf8')).toContain(`export const PLACEHOLDER = ${JSON.stringify(PLAY_MESSAGE_BOX)}`)
    expect(APPROVAL_ASK.trim()).not.toBe('')
    const turns = (readJson(TURNS) as { readonly turns: Readonly<Record<string, unknown>> }).turns
    expect(JSON.stringify(turns.approvalView)).toContain('approval_view')
  })

  it("holds the older conversations inside the fixtures' made-up days, before the shots' clock", () => {
    const older = readJson(OLDER_CHATS) as ReadonlyArray<{ readonly updatedAt: string }>
    expect(older).toHaveLength(5)
    older.forEach((conversation) => expect(Date.parse(conversation.updatedAt)).toBeLessThan(Date.parse(SHOWCASE_TIME)))
  })
})

describe('how the showcase is drawn', () => {
  it('on the hosted edition, at twice the pixel density, into its own folder apart from the regression shots', () => {
    expect(SHOWCASE_EDITION).toBe('saas')
    expect(SHOWCASE_SCALE).toBe(2)
    expect(SHOWCASE_FOLDER).toBe('dist/showcase')
  })

  it("serves each theme on a port of its own, apart from the shots' and dev's", () => {
    const ports = SHOWCASE_THEMES.map((theme) => SHOWCASE_PORTS[theme])
    expect(new Set([...ports, HARNESS_PORT, DEV_PORT]).size).toBe(ports.length + 2)
    SHOWCASE_THEMES.forEach((theme) => expect(showcaseOrigin(theme)).toBe(`http://127.0.0.1:${SHOWCASE_PORTS[theme]}`))
  })

  it("fixes the clock inside the fixtures' made-up day: after the conversation, before the first scheduled run", () => {
    const now = Date.parse(SHOWCASE_TIME)
    const transcript = readJson(TRANSCRIPT) as ReadonlyArray<{ readonly updatedAt: string }>
    const schedule = readFileSync(SCHEDULE, 'utf8')
    const runs = Array.from(schedule.matchAll(/"next_run_at": "([^"]+)"/g), (match) => Date.parse(match[1] ?? ''))
    expect(runs.length).toBeGreaterThan(0)
    expect(now).toBeGreaterThan(Math.max(...transcript.map((conversation) => Date.parse(conversation.updatedAt))))
    expect(now).toBeLessThan(Math.min(...runs))
  })
})
