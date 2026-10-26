// Theme voice in the browser harness (src/host/voice.ts, src/host/router.ts, src/host/shot-groups.ts): the voice phase is
// a setting in the address (`voice=<phase>`), each phase but idle a made-up quick-ask session every VoiceButton owns, so
// a theme's voice states draw with the host's caption; the levels move with the clock while someone speaks, and hold
// still under reduced motion, which every voice shot asks for; and a theme whose theme.json `uses` names the voice area
// gets one shot group per phase but idle, on its chat page (or every view) in the default look at 1440 px. Made-up data.
import { readVoiceLevels, VoiceButton } from '@automatos/theme-sdk'
import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { host } from '../src/host.ts'
import {
  DEFAULT_SETTINGS, EMPTY_SERVED, expectedShots, readSettings, settingsQuery, usesIn, VOICE_PHASES, type Served,
} from '../src/host/router.ts'
import { groupShots, shotAddress, shotGroups, VOICE_SHOT_PHASES } from '../src/host/shot-groups.ts'
import { driveVoiceLevels, HELD_LEVEL, heldLevels, movingLevels, showVoice, VOICE_HEARD, VOICE_REPLY, voiceSessionOf } from '../src/host/voice.ts'

const PRESETS = ['ember', 'aurora']
const PAGES = ['/chat', '/deliverables']
const DECLARED: Served = { slots: ['frame@1', 'lookEditor@1'], pages: PAGES, routes: ['notes'] }
const VOICE_USES = ['chat', 'voice']
/** Two moments a fifth of a second apart, in milliseconds since the page opened. */
const MOMENTS = [1_000, 1_200]

beforeEach(() => {
  host.reset()
})

describe('the voice setting', () => {
  it('is in the address, idle by default, and a phase it does not know reads as idle', () => {
    expect(VOICE_PHASES).toEqual(['idle', 'listening', 'thinking', 'speaking', 'error'])
    expect(DEFAULT_SETTINGS.voice).toBe('idle')
    expect(settingsQuery({ ...DEFAULT_SETTINGS, voice: 'listening' })).toBe('?voice=listening')
    VOICE_PHASES.forEach((voice) => expect(readSettings(settingsQuery({ ...DEFAULT_SETTINGS, voice })).voice).toBe(voice))
    expect(readSettings('?voice=shouting').voice).toBe('idle')
  })
})

describe('the made-up sessions', () => {
  it('are quick-ask on the conversation on screen, with the words each phase has; idle is none', () => {
    expect(voiceSessionOf('idle')).toMatchObject({ phase: 'idle', mode: null })
    expect(voiceSessionOf('listening')).toMatchObject({ phase: 'listening', mode: 'quick', micOpen: true, heard: VOICE_HEARD, chatId: null })
    expect(voiceSessionOf('thinking')).toMatchObject({ phase: 'thinking', micOpen: false, heard: VOICE_HEARD, reply: '' })
    expect(voiceSessionOf('speaking')).toMatchObject({ phase: 'speaking', heard: VOICE_HEARD, reply: VOICE_REPLY })
    expect(voiceSessionOf('error')).toMatchObject({ phase: 'error', error: 'Voice stopped. Try again.' })
  })

  it("each draw a theme's VoiceButton in its phase, with the host's caption; idle without", () => {
    render(<VoiceButton />)
    const root = (): Element | null => document.querySelector('[data-voice-button="root"]')
    VOICE_SHOT_PHASES.forEach((phase) => {
      act(() => showVoice(phase))
      expect(root()?.getAttribute('data-voice-state')).toBe(phase)
      expect(screen.getByRole('note', { name: 'AI voice assistant' })).toBeInTheDocument()
    })
    act(() => showVoice('idle'))
    expect(root()?.getAttribute('data-voice-state')).toBe('idle')
    expect(screen.queryByRole('note', { name: 'AI voice assistant' })).toBeNull()
  })
})

describe('the levels on the page', () => {
  it("move the speaker's level with the clock, between 0.1 and 0.9, and leave the other's at 0", () => {
    const [first, second] = MOMENTS.map((ms) => movingLevels('listening', ms / 1_000))
    expect(first?.user).not.toBe(second?.user)
    expect([first?.agent, second?.agent]).toEqual([0, 0])
    const sweep = Array.from({ length: 200 }, (_, index) => movingLevels('speaking', index / 10).agent)
    expect(Math.min(...sweep)).toBeGreaterThanOrEqual(0.1)
    expect(Math.max(...sweep)).toBeLessThanOrEqual(0.9)
    expect(movingLevels('thinking', 1)).toEqual({ user: 0, agent: 0 })
  })

  it('hold still under reduced motion, as every voice shot asks for', () => {
    expect(heldLevels('listening')).toEqual({ user: HELD_LEVEL, agent: 0 })
    expect(heldLevels('speaking')).toEqual({ user: 0, agent: HELD_LEVEL })
    let now = MOMENTS[0] ?? 0
    driveVoiceLevels(true, () => now)
    showVoice('speaking')
    const before = readVoiceLevels()
    now = MOMENTS[1] ?? 0
    expect(readVoiceLevels()).toEqual(before)
    expect(before).toEqual({ user: 0, agent: HELD_LEVEL })
  })

  it('move in dev with motion allowed, follow the phase a press moves the session to, and are zeros at rest', () => {
    let now = MOMENTS[0] ?? 0
    driveVoiceLevels(false, () => now)
    showVoice('listening')
    const before = readVoiceLevels()
    now = MOMENTS[1] ?? 0
    expect(readVoiceLevels().user).not.toBe(before.user)
    expect(readVoiceLevels().agent).toBe(0)
    showVoice('thinking')
    expect(readVoiceLevels()).toEqual({ user: 0, agent: 0 })
    showVoice('idle')
    expect(readVoiceLevels()).toEqual({ user: 0, agent: 0 })
  })
})

describe('the voice shot groups', () => {
  const groups = shotGroups(PRESETS, 1024, PAGES, VOICE_USES)
  const voice = groups.filter((group) => group.voice !== undefined)

  it('shoot the chat page in each phase but idle, in the default look at 1440 px with reduced motion', () => {
    expect(VOICE_SHOT_PHASES).toEqual(['listening', 'thinking', 'speaking', 'error'])
    expect(voice).toEqual(VOICE_SHOT_PHASES.map((phase) => ({
      folder: `ember/1440-voice-${phase}`, preset: 'ember', width: 1440, height: 900, reducedMotion: true, page: '/chat', transcript: false,
      voice: phase,
    })))
    expect(new Set(groups.map((group) => group.folder)).size).toBe(groups.length)
  })

  it('open each shot in its phase, with reduced motion and no toolbar, and hold the chat page alone', () => {
    voice.forEach((group) => {
      expect(readSettings(shotAddress(group, '/chat').slice(1))).toMatchObject({ voice: group.voice, reducedMotion: true, toolbar: false })
      expect(groupShots(group, DECLARED, EMPTY_SERVED)).toEqual(['page-chat.png'])
    })
    const plain = groups.find((group) => group.voice === undefined)
    if (plain === undefined) throw new Error('no other group')
    expect(readSettings(shotAddress(plain, '/chat').slice(1)).voice).toBe('idle')
  })

  it('shoot every view for a theme with no /chat page, and none for a theme whose uses has no voice', () => {
    const noChat: Served = { ...DECLARED, pages: ['/deliverables'] }
    const everyView = shotGroups(PRESETS, 1024, noChat.pages, VOICE_USES).filter((group) => group.voice !== undefined)
    expect(everyView.map((group) => group.page)).toEqual([null, null, null, null])
    everyView.forEach((group) => expect(groupShots(group, noChat, EMPTY_SERVED)).toEqual(expectedShots(noChat, EMPTY_SERVED)))
    expect(shotGroups(PRESETS, 1024, PAGES, ['chat']).filter((group) => group.voice !== undefined)).toEqual([])
    expect(shotGroups(PRESETS, 1024, PAGES).filter((group) => group.voice !== undefined)).toEqual([])
  })

  it("read the areas from theme.json's uses, leniently", () => {
    expect(usesIn({ uses: ['chat', 'voice', 7] })).toEqual(['chat', 'voice'])
    expect([usesIn({ uses: 'voice' }), usesIn(null), usesIn({})]).toEqual([[], [], []])
  })

  it('come before the phone-width groups, which stay last', () => {
    const phone = shotGroups(PRESETS, 360, PAGES, VOICE_USES)
    expect(phone.slice(-3).map((group) => group.folder)).toEqual(['ember/390', 'aurora/390', 'ember/390-transcript'])
    expect(phone.filter((group) => group.voice !== undefined)).toHaveLength(VOICE_SHOT_PHASES.length)
  })
})
