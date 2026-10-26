import type { ActivityFeedItem, HostVoicePhase } from '@automatos/theme-sdk'

import type { MascotName } from '@automatos/mascot/types'

import { voiceStateWord } from '../../voice/session'

/**
 * The phone core screen's top line, the Command design's "RESEARCHER · SEARCHING" with "02:14" on the right: who is at
 * work, what they are doing, and how long it has run. The SDK says which Mission runs now (its activity feed: the
 * newest working Mission, the agent on it and when it started), so while one runs the line names its agent, working,
 * and the time since it started; the feed says nothing finer of what the agent does. With none, the line is Auto and
 * his state in one word (the chat's, as the chip under the core says it in full), with no time: the chat gives a turn
 * no start time. While the host's voice session listens, thinks or speaks, the line is Auto and that word instead
 * ("Listening", "Thinking", "Speaking"), a running Mission's agent included, since the member is talking to Auto; then
 * it falls back to the above. Pure.
 */

export const AUTO_NAME = 'Auto'
/** What a running Mission's agent is doing, as far as the feed says. */
export const MISSION_WORKING = 'Working'

/**
 * Auto's state in a word. An approval card waiting (listening) is "Waiting for you", never "Listening", which would
 * read as an open microphone: only the host's voice button opens it, and while it is open the line says the voice
 * session's word instead (src/voice/session.ts VOICE_STATE_WORDS).
 */
export const STATE_WORDS: Readonly<Record<MascotName, string>> = {
  hello: 'Ready',
  idle: 'Ready',
  listening: 'Waiting for you',
  thinking: 'Thinking',
  working: 'Working',
  searching: 'Searching',
  reading: 'Reading',
  celebrate: 'Done',
  oops: 'Snag',
  sleeping: 'Asleep',
  lost: 'Lost',
  loading: 'Loading',
}

export interface StatusLineWords {
  readonly who: string
  readonly doing: string
  /** How long the Mission has run ('02:14', '1:02:14', '12d 04h'); null without one, or without its start. */
  readonly clock: string | null
  /** The same as a duration, for <time dateTime> ('PT134S'). */
  readonly duration: string | null
}

const MS_PER_SECOND = 1000
const SECONDS_PER_MINUTE = 60
const SECONDS_PER_HOUR = 3600
const HOURS_PER_DAY = 24
const SECONDS_PER_DAY = SECONDS_PER_HOUR * HOURS_PER_DAY

function twoDigits(value: number): string {
  return String(value).padStart(2, '0')
}

/** The agent on a running Mission (its first, when it names several); null when it names none. */
export function missionAgent(item: ActivityFeedItem | null): string | null {
  const name = (item?.agent ?? item?.agents[0])?.name.trim()
  return name ? name : null
}

/** Whole seconds from `startedAt` to `now`, never below 0 (a clock a little ahead); null when it is no time. */
export function elapsedSeconds(startedAt: string | null, now: Date): number | null {
  if (startedAt === null) return null
  const started = new Date(startedAt).getTime()
  if (Number.isNaN(started)) return null
  return Math.max(0, Math.floor((now.getTime() - started) / MS_PER_SECOND))
}

/**
 * '02:14' for 134 seconds; '1:02:14' past the hour; '12d 04h' from a day on, where the seconds ticking would only be
 * noise on a Mission that old.
 */
export function clockOf(seconds: number): string {
  if (seconds >= SECONDS_PER_DAY) {
    const days = Math.floor(seconds / SECONDS_PER_DAY)
    return `${days}d ${twoDigits(Math.floor((seconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR))}h`
  }
  const hours = Math.floor(seconds / SECONDS_PER_HOUR)
  const minutes = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE)
  const tail = `${twoDigits(minutes)}:${twoDigits(seconds % SECONDS_PER_MINUTE)}`
  return hours > 0 ? `${hours}:${tail}` : tail
}

/** The line for Auto's state, the Mission running now (null for none) and the voice session's phase, at `now`. */
export function statusLineWords(state: MascotName, mission: ActivityFeedItem | null, now: Date, voice?: HostVoicePhase): StatusLineWords {
  const spoken = voiceStateWord(voice)
  if (spoken !== null) return { who: AUTO_NAME, doing: spoken, clock: null, duration: null }
  const agent = missionAgent(mission)
  if (agent === null) return { who: AUTO_NAME, doing: STATE_WORDS[state], clock: null, duration: null }
  const seconds = elapsedSeconds(mission?.started_at ?? null, now)
  return {
    who: agent,
    doing: MISSION_WORKING,
    clock: seconds === null ? null : clockOf(seconds),
    duration: seconds === null ? null : `PT${seconds}S`,
  }
}
