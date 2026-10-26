// Play 1.2.0 — Auto's pose for each phase of the host's voice session (src/lib/voice/voice-pose.ts), and the words the
// chat shows while a session runs. Pure functions over the SDK's snapshot fields; the chat's own use is
// test/chat/voice-chat.test.tsx.
import type { HostVoicePhase } from '@automatos/theme-sdk'
import { describe, expect, it } from 'vitest'
import { captionFor } from '@automatos/mascot/media'
import { MASCOT_STATES } from '@automatos/mascot/types'
import { CONNECTING_CAPTION, SPEAKING_CAPTION, voicePose, voiceWords } from '../../src/lib/voice/voice-pose.ts'

const PHASES: readonly HostVoicePhase[] = ['idle', 'connecting', 'listening', 'thinking', 'speaking', 'ended', 'error']
/** The phases with no session running: no session, a call that ended, a failure. */
const OVER: readonly HostVoicePhase[] = ['idle', 'ended', 'error']

describe('voicePose', () => {
  it.each([
    ['listening', false, 'listening', captionFor('listening'), false],
    ['listening', true, 'listening', captionFor('listening'), false],
    ['connecting', true, 'listening', captionFor('listening'), false],
    ['connecting', false, 'loading', CONNECTING_CAPTION, false],
    ['thinking', false, 'thinking', captionFor('thinking'), false],
    ['thinking', true, 'thinking', captionFor('thinking'), false],
    ['speaking', false, 'idle', SPEAKING_CAPTION, true],
    ['speaking', true, 'idle', SPEAKING_CAPTION, true],
    ['error', false, 'oops', captionFor('oops'), false],
  ] as const)('%s (microphone open: %s) is %s, "%s", speaking %s', (phase, micOpen, mascot, caption, speaking) => {
    expect(voicePose({ phase, micOpen })).toEqual({ mascot, caption, speaking })
  })

  it('leaves Auto to the chat with no session and once a call has ended', () => {
    expect(voicePose({ phase: 'idle', micOpen: false })).toBeNull()
    expect(voicePose({ phase: 'ended', micOpen: false })).toBeNull()
  })

  it("names only states Auto has, and speaks in one phase alone", () => {
    const poses = PHASES.flatMap((phase) => [voicePose({ phase, micOpen: false }), voicePose({ phase, micOpen: true })])
    const shown = poses.flatMap((pose) => (pose === null ? [] : [pose]))
    expect(shown.filter((pose) => !MASCOT_STATES.includes(pose.mascot))).toEqual([])
    expect(PHASES.filter((phase) => voicePose({ phase, micOpen: true })?.speaking)).toEqual(['speaking'])
    expect(shown.every((pose) => Object.isFrozen(pose))).toBe(true)
  })
})

describe('voiceWords', () => {
  it('shows what was heard and said, trimmed, while a session runs', () => {
    expect(voiceWords({ phase: 'listening', heard: ' What is on ', reply: '' })).toEqual({ heard: 'What is on', reply: '' })
    expect(voiceWords({ phase: 'speaking', heard: 'What is on', reply: 'Three cards ' })).toEqual({ heard: 'What is on', reply: 'Three cards' })
    expect(voiceWords({ phase: 'connecting', heard: '', reply: 'Hello' })).toEqual({ heard: '', reply: 'Hello' })
  })

  it('shows nothing with no words yet, nor once the session is over or failed', () => {
    expect(voiceWords({ phase: 'listening', heard: '  ', reply: '' })).toBeNull()
    expect(OVER.map((phase) => voiceWords({ phase, heard: 'Hi', reply: 'Hello' }))).toEqual([null, null, null])
  })
})
