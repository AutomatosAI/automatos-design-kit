import { type HostVoicePhase, type HostVoiceState, useMediaPreferences } from '@automatos/theme-sdk'

import { useHudLook } from '../lib/looks/use-hud-look'

/**
 * What HUD reads of the host's voice session (the SDK's voice area, SDK 1.2.0): whether one runs (connecting,
 * listening, thinking or speaking: readVoiceLevels answers zeros otherwise), the microphone's words for MIC LIVE, and
 * whether HUD's voice may move (the waveform): not under the reduced-motion setting, and not while the look's motion
 * is off (the design: motion off stops every loop). HUD never opens the microphone itself: the host's voice button
 * does, on a press.
 */

const RUNNING: ReadonlySet<HostVoicePhase> = new Set<HostVoicePhase>(['connecting', 'listening', 'thinking', 'speaking'])

export const MIC_LIVE = 'Mic live'
export const MIC_MUTED = 'Mic muted'

/** A session runs: the host is connecting, hearing the member, waiting on Auto's reply or speaking it. */
export function isVoiceRunning(phase: HostVoicePhase): boolean {
  return RUNNING.has(phase)
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
