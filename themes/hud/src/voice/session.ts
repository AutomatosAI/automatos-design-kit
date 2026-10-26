import { type HostVoicePhase, type HostVoiceState, useMediaPreferences } from '@automatos/theme-sdk'

import { useHudLook } from '../lib/looks/use-hud-look'

/**
 * What HUD reads of the host's voice session (the SDK's voice area, SDK 1.2.0): whether one runs (connecting,
 * listening, thinking or speaking: readVoiceLevels answers zeros otherwise), the microphone's words for MIC LIVE, the
 * session's phase in a word for the status line and the state chip, and whether HUD's voice may move (the waveform):
 * not under the reduced-motion setting, and not while the look's motion is off (the design: motion off stops every
 * loop). HUD never opens the microphone itself: the host's voice button does, on a press.
 */

const RUNNING: ReadonlySet<HostVoicePhase> = new Set<HostVoicePhase>(['connecting', 'listening', 'thinking', 'speaking'])

export const MIC_LIVE = 'Mic live'
export const MIC_MUTED = 'Mic muted'

/**
 * The session's phase in a word while it listens (the microphone open), thinks on the reply or speaks it: the one time
 * the status line and the state chip say "Listening". Connecting, at rest, a call that ended and a failure have none:
 * the line and the chip say the chat's state then.
 */
export const VOICE_STATE_WORDS: Readonly<Partial<Record<HostVoicePhase, string>>> = {
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
}

/** A session runs: the host is connecting, hearing the member, waiting on Auto's reply or speaking it. */
export function isVoiceRunning(phase: HostVoicePhase): boolean {
  return RUNNING.has(phase)
}

/** The session's phase in a word (VOICE_STATE_WORDS); null where the chat says Auto's state. */
export function voiceStateWord(phase: HostVoicePhase | undefined): string | null {
  return phase === undefined ? null : VOICE_STATE_WORDS[phase] ?? null
}

/** The microphone in words while it is open ('Mic live', or 'Mic muted' on a muted call); null while it is shut. */
export function micWords(voice: Pick<HostVoiceState, 'micOpen' | 'muted'>): string | null {
  if (!voice.micOpen) return null
  return voice.muted ? MIC_MUTED : MIC_LIVE
}

/** True while HUD's voice may move: the OS allows motion and the look's motion knob is on. */
export function useVoiceMotion(): boolean {
  const { reducedMotion } = useMediaPreferences()
  const look = useHudLook()
  return !reducedMotion && look.motion === 'on'
}
