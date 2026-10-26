import type { HostVoicePhase, HostVoiceState } from '@automatos/theme-sdk'

import { captionFor } from '@automatos/mascot/media'
import type { MascotName } from '@automatos/mascot/types'

/**
 * Play 1.2.0 — Auto following the host's voice session (the SDK's useVoice), as the chat shows him. Pure: the
 * session's phase gives his state and the caption that says it in words, and whether his light ring follows his
 * voice. While the microphone is open he listens; then he thinks; then he speaks. The mascot has no speaking clip,
 * so while Auto speaks he is his calm idle clip and his light ring, which Play draws, swells with his voice (the
 * SDK's readVoiceLevels().agent, use-voice-ring.ts). A session waiting for the microphone loads; a failed one is
 * his oops, beside the failure the voice button shows with Try again. With no session (idle) or a call that
 * ended, the chat drives him as before: null.
 */

export interface VoicePose {
  /** The state AutoMascot shows. */
  readonly mascot: MascotName
  /** His caption: what he is doing, in words. */
  readonly caption: string
  /** True while Auto speaks: his ring follows his voice's level. */
  readonly speaking: boolean
}

/** What the session says now: the member's words heard so far, and Auto's spoken so far. */
export interface VoiceWords {
  readonly heard: string
  readonly reply: string
}

export const SPEAKING_CAPTION = 'Speaking'
export const CONNECTING_CAPTION = 'Getting ready to listen'

/** The phases in which a session runs: the words it heard and spoke show. */
const RUNNING: ReadonlySet<HostVoicePhase> = new Set<HostVoicePhase>(['connecting', 'listening', 'thinking', 'speaking'])

const pose = (mascot: MascotName, caption: string, speaking = false): VoicePose => Object.freeze({ mascot, caption, speaking })

const LISTENING = pose('listening', captionFor('listening'))
const WAITING_FOR_MIC = pose('loading', CONNECTING_CAPTION)
const THINKING = pose('thinking', captionFor('thinking'))
const SPEAKING = pose('idle', SPEAKING_CAPTION, true)
const FAILED = pose('oops', captionFor('oops'))

/** Auto's pose for the session's phase; null where the chat drives him (no session, a call that ended). */
export function voicePose(voice: Pick<HostVoiceState, 'phase' | 'micOpen'>): VoicePose | null {
  switch (voice.phase) {
    case 'connecting':
      return voice.micOpen ? LISTENING : WAITING_FOR_MIC
    case 'listening':
      return LISTENING
    case 'thinking':
      return THINKING
    case 'speaking':
      return SPEAKING
    case 'error':
      return FAILED
    default:
      return null
  }
}

/** The words to show while a session runs; null when none runs or it has no words yet. */
export function voiceWords(voice: Pick<HostVoiceState, 'phase' | 'heard' | 'reply'>): VoiceWords | null {
  if (!RUNNING.has(voice.phase)) return null
  const heard = voice.heard.trim()
  const reply = voice.reply.trim()
  return heard === '' && reply === '' ? null : Object.freeze({ heard, reply })
}
