// The phone core screen's pure rules: the top line (a running Mission's agent, working, with the time since it
// started, as '02:14' and past the hour '1:02:14'; Auto and his state in a word otherwise, never "Listening", which
// would read as a microphone, but while the host's voice session listens, thinks or speaks, Auto and that word), and
// the last exchange the transcript shows (your newest message and the replies after it). Each is a plain function,
// read without rendering. Every value is made up.
import type { ActivityFeedItem, HostChatMessage } from '@automatos/theme-sdk'
import { describe, expect, it } from 'vitest'
import { MASCOT_STATES } from '@automatos/mascot/types'
import { lastExchange } from '../../src/chat/phone/phone-transcript.tsx'
import {
  AUTO_NAME, clockOf, elapsedSeconds, MISSION_WORKING, missionAgent, STATE_WORDS, statusLineWords,
} from '../../src/chat/phone/status-words.ts'
import { VOICE_STATE_WORDS, voiceStateWord } from '../../src/voice/session.ts'

const NOW = new Date('2026-10-14T09:02:14Z')
const STARTED = '2026-10-14T09:00:00Z'

function mission(fields: Partial<ActivityFeedItem>): ActivityFeedItem {
  return {
    id: 'run-1', type: 'mission', name: 'Laptop shortlist', status: 'running', started_at: STARTED, completed_at: null,
    duration_seconds: null, agent: null, agents: [], summary: '', source_id: 'm-7', source_url: null, trigger: null,
    error_message: null, ...fields,
  }
}

const agent = (name: string) => ({ id: 1, name, avatar_url: null })

function message(id: string, role: HostChatMessage['role']): HostChatMessage {
  return { id, role, text: id, error: null } as unknown as HostChatMessage
}

describe('the line', () => {
  it("is Auto and his state in a word while no Mission with an agent runs, with no time", () => {
    expect(statusLineWords('searching', null, NOW)).toEqual({ who: AUTO_NAME, doing: 'Searching', clock: null, duration: null })
    expect(statusLineWords('idle', mission({}), NOW).who).toBe(AUTO_NAME)
  })

  it("names a running Mission's agent, working, and the time since it started", () => {
    expect(statusLineWords('idle', mission({ agent: agent('Researcher') }), NOW)).toEqual({
      who: 'Researcher', doing: MISSION_WORKING, clock: '02:14', duration: 'PT134S',
    })
  })

  it("is Auto and the voice session's word while it listens, thinks or speaks, a running Mission's agent included", () => {
    const researching = mission({ agent: agent('Researcher') })
    expect(statusLineWords('listening', null, NOW, 'listening')).toEqual({ who: AUTO_NAME, doing: 'Listening', clock: null, duration: null })
    expect(statusLineWords('idle', researching, NOW, 'thinking')).toEqual({ who: AUTO_NAME, doing: 'Thinking', clock: null, duration: null })
    expect(statusLineWords('searching', null, NOW, 'speaking').doing).toBe('Speaking')
  })

  it("falls back to the chat's state and the Mission while the session connects, rests, has ended or failed", () => {
    expect((['connecting', 'idle', 'ended', 'error'] as const).map((voice) => statusLineWords('listening', null, NOW, voice).doing)).toEqual([
      'Waiting for you', 'Waiting for you', 'Waiting for you', 'Waiting for you',
    ])
    expect(statusLineWords('idle', mission({ agent: agent('Researcher') }), NOW, 'idle').who).toBe('Researcher')
  })

  it('has no time for a Mission without a start it can read', () => {
    expect(statusLineWords('idle', mission({ agent: agent('Researcher'), started_at: null }), NOW).clock).toBeNull()
    expect(statusLineWords('idle', mission({ agent: agent('Researcher'), started_at: 'soon' }), NOW).clock).toBeNull()
  })

  it("takes the Mission's first agent when it names no lead, and none that is blank", () => {
    expect(missionAgent(mission({ agents: [agent('Scout'), agent('Scribe')] }))).toBe('Scout')
    expect(missionAgent(mission({ agent: agent('  ') }))).toBeNull()
    expect(missionAgent(null)).toBeNull()
  })

  it('counts whole seconds, never below none, and reads the hour when there is one, and the day from a day on', () => {
    expect(elapsedSeconds(STARTED, NOW)).toBe(134)
    expect(elapsedSeconds('2026-10-14T09:05:00Z', NOW)).toBe(0)
    expect(elapsedSeconds(null, NOW)).toBeNull()
    expect(clockOf(0)).toBe('00:00')
    expect(clockOf(134)).toBe('02:14')
    expect(clockOf(3734)).toBe('1:02:14')
    expect(clockOf(86_399)).toBe('23:59:59')
    expect(clockOf(86_400)).toBe('1d 00h')
    expect(clockOf(288 * 3600 + 27 * 60 + 26)).toBe('12d 00h')
    expect(clockOf(12 * 86_400 + 4 * 3600 + 59)).toBe('12d 04h')
  })

  it("says every one of Auto's states in a word, and an approval card waiting never as listening", () => {
    expect(Object.keys(STATE_WORDS).sort()).toEqual([...MASCOT_STATES].sort())
    expect(STATE_WORDS.listening).toBe('Waiting for you')
    expect(Object.values(STATE_WORDS).some((word) => /listen/i.test(word))).toBe(false)
  })

  it('says "Listening" for the voice session alone, while the microphone is open', () => {
    expect(VOICE_STATE_WORDS).toEqual({ listening: 'Listening', thinking: 'Thinking', speaking: 'Speaking' })
    expect([voiceStateWord('connecting'), voiceStateWord('idle'), voiceStateWord(undefined)]).toEqual([null, null, null])
  })
})

describe('the last exchange', () => {
  it('is your newest message and every reply after it', () => {
    const said = [message('u1', 'user'), message('a1', 'assistant'), message('u2', 'user'), message('a2', 'assistant')]
    expect(lastExchange(said).map((item) => item.id)).toEqual(['u2', 'a2'])
    expect(lastExchange([...said, message('u3', 'user')]).map((item) => item.id)).toEqual(['u3'])
  })

  it('is every message when you said none, and nothing for nothing said', () => {
    expect(lastExchange([message('a1', 'assistant')]).map((item) => item.id)).toEqual(['a1'])
    expect(lastExchange([])).toEqual([])
  })
})
