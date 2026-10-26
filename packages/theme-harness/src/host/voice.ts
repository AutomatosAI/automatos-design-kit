/**
 * Theme voice: the voice sessions the browser harness shows a theme's voice in (the toolbar's Voice, `voice=<phase>` in
 * the address, the shots' voice groups, src/host/shot-groups.ts), and the levels readVoiceLevels answers on the page.
 * Made-up words.
 *
 * - Each phase but idle is a quick-ask session on the conversation on screen (the transcript's while it shows, else a
 *   new chat's, which has no id yet), so every VoiceButton that names no other conversation owns it and shows the
 *   host's control: listening, the microphone open, with the member's words so far; thinking, with them said;
 *   speaking, with Auto's reply as far as it has been spoken; and a failure in core's words. Idle is no session. A
 *   press of the button moves the session on from there, as in a theme's tests.
 * - On the transcript the session's words are its conversation's last two messages, as core draws them
 *   (src/internal/live-voice-turns.ts); a new chat shows none, as core's does until the turn returns its id.
 * - The levels move while someone speaks (listening: the member's; speaking: Auto's), so a theme's waveform animates in
 *   `dev`. With the harness's reduced motion on, which every shot group but the motion one asks for, they hold still
 *   (HELD_LEVEL), so a voice shot is the same on every run: the shots' `animations: 'disabled'` stops CSS animations,
 *   never a theme's own animation frames, which read the levels each frame.
 */
import type { HostVoiceLevels, HostVoicePhase } from '@automatos/theme-sdk'
import { host } from '../host.ts'
import { IDLE_SESSION, session, setVoiceLevelsSource, VOICE_FAILED, type VoiceSessionStandIn } from '../internal/voice-session.ts'
import type { HarnessVoicePhase } from './router.ts'

/** What the member says in the made-up session, and what Auto answers. */
export const VOICE_HEARD = 'What needs me on the board today?'
export const VOICE_REPLY = 'Two cards are waiting for your approval.'
/** The level of whoever speaks, held still under reduced motion. */
export const HELD_LEVEL = 0.6
/** The moving level: LEVEL_MID ± LEVEL_SWING, a fast wave under a slow one (radians a second), so it never repeats soon. */
const LEVEL_MID = 0.5
const LEVEL_SWING = 0.4
const FAST_WAVE = 7.3
const SLOW_WAVE = 1.7
const MS_PER_SECOND = 1000

const quick = (changes: Partial<VoiceSessionStandIn>): VoiceSessionStandIn => Object.freeze({ ...IDLE_SESSION, mode: 'quick', ...changes })

const SESSIONS: Readonly<Record<HarnessVoicePhase, VoiceSessionStandIn>> = Object.freeze({
  idle: IDLE_SESSION,
  listening: quick({ phase: 'listening', micOpen: true, heard: VOICE_HEARD }),
  thinking: quick({ phase: 'thinking', heard: VOICE_HEARD }),
  speaking: quick({ phase: 'speaking', heard: VOICE_HEARD, reply: VOICE_REPLY }),
  error: quick({ phase: 'error', error: VOICE_FAILED }),
})

/** The made-up session the page shows in `phase`, on the conversation `chatId` (null: a new chat). */
export function voiceSessionOf(phase: HarnessVoicePhase, chatId: string | null = null): VoiceSessionStandIn {
  const shown = SESSIONS[phase]
  return shown.phase === 'idle' ? shown : Object.freeze({ ...shown, chatId })
}

/** The fake host's voice session from now on: the made-up one in `phase`, on the conversation `chatId`. */
export function showVoice(phase: HarnessVoicePhase, chatId: string | null = null): void {
  host.setVoice(voiceSessionOf(phase, chatId))
}

/** `level` for whoever speaks in `phase` (the member while listening, Auto while speaking); 0 for the other. */
function spokenBy(phase: HostVoicePhase, level: number): HostVoiceLevels {
  return Object.freeze({ user: phase === 'listening' ? level : 0, agent: phase === 'speaking' ? level : 0 })
}

/** The levels at `seconds`: the speaker's between LEVEL_MID - LEVEL_SWING and LEVEL_MID + LEVEL_SWING. */
export function movingLevels(phase: HostVoicePhase, seconds: number): HostVoiceLevels {
  return spokenBy(phase, LEVEL_MID + LEVEL_SWING * Math.sin(seconds * FAST_WAVE) * Math.cos(seconds * SLOW_WAVE))
}

/** The levels held still: the speaker's at HELD_LEVEL. */
export function heldLevels(phase: HostVoicePhase): HostVoiceLevels {
  return spokenBy(phase, HELD_LEVEL)
}

/** Where readVoiceLevels reads on the page: levels that move with the clock, or held still under reduced motion. */
export function driveVoiceLevels(reducedMotion: boolean, clock: () => number = () => performance.now()): void {
  setVoiceLevelsSource(() => {
    const { phase } = session.get()
    return reducedMotion ? heldLevels(phase) : movingLevels(phase, clock() / MS_PER_SECOND)
  })
}
