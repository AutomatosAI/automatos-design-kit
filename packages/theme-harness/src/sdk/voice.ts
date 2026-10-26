/**
 * Theme voice (SDK 1.2.0): the fake of SDK area `voice`. It mirrors core's frontend/lib/theme-sdk/voice.ts (at
 * 2e57484810204fb9b3481c86a0faed7c6eb3d0ae): useVoice hands back a frozen, theme-neutral snapshot of the tab's voice
 * session and stop(), the same object while nothing changed; readVoiceLevels the member's and Auto's levels, each 0 to
 * 1 (a value out of range clamped, one that is not a finite number 0); VoiceButton is the stand-in in voice-button.tsx.
 * Outside the host's voice (host.setVoiceAvailable(null)) useVoice answers the idle snapshot with nothing available and
 * the reason, readVoiceLevels zeros, and the button is drawn disabled; none throws.
 *
 * Here the session is what a test sets through the controls below (host.ts gathers them), over the fake host's session
 * (src/internal/voice-session.ts), which a press of the button moves too. A test starts with no session, the host's
 * voice on the page (quick-ask in this browser, Live not set up: VOICE_DEFAULTS), zero levels, and nothing pressed or
 * stopped. readVoiceLevels answers zeros while no session runs (connecting, listening, thinking or speaking), as core's
 * does, whatever levels a test set. While a session runs on a conversation (its chatId), its heard and reply are that
 * conversation's last two messages in useChatController, as in core (src/internal/live-voice-turns.ts), until the turn
 * is saved (voiceTurnSaved) or the session ends.
 */
import type { HostVoiceAvailability, HostVoiceLevels, HostVoiceMode, HostVoicePhase, HostVoiceState } from '@automatos/theme-sdk'
import { useMemo } from 'react'
import { voiceTurnSaved } from '../internal/live-voice-turns.ts'
import {
  availability, IDLE_SESSION, micOpenIn, NO_LEVELS, resetVoiceSession, session, setVoiceLevelsSource, stopVoice, VOICE_DEFAULTS,
  VOICE_UNAVAILABLE, voiceLevelsNow, voicePresses, voiceStops, type VoiceSessionStandIn,
} from '../internal/voice-session.ts'

export { VoiceButton } from './voice-button.tsx'

type Sdk = typeof import('@automatos/theme-sdk')

const NO_OP = (): void => undefined
const DEFAULT_ENGINE: HostVoiceMode = 'quick'

/** voice.ts NO_VOICE: outside the host's voice, nothing is available, with the reason. */
const NO_VOICE: HostVoiceState = Object.freeze({
  available: Object.freeze({ quick: false, live: false, reason: VOICE_UNAVAILABLE }),
  ...IDLE_SESSION,
  stop: NO_OP,
})

/** voice.ts stateOf: only the snapshot's fields, the availability and stop. */
function stateOf(now: VoiceSessionStandIn, available: HostVoiceAvailability | null): HostVoiceState {
  if (available === null) return NO_VOICE
  return Object.freeze({
    available: Object.freeze({ quick: available.quick, live: available.live, reason: available.reason }),
    mode: now.mode,
    phase: now.phase,
    micOpen: now.micOpen,
    muted: now.muted,
    heard: now.heard,
    reply: now.reply,
    durationSec: now.durationSec,
    error: now.error,
    chatId: now.chatId,
    stop: stopVoice,
  })
}

/** voice.ts useVoice: the tab's voice session, re-rendering when a test (or a press) changes it. */
export const useVoice = ((): HostVoiceState => {
  const now = session.use()
  const available = availability.use()
  return useMemo(() => stateOf(now, available), [now, available])
}) satisfies Sdk['useVoice']

/** voice.ts readVoiceLevels: the levels now, for code inside an animation frame; zeros while no session runs. */
export const readVoiceLevels = ((): HostVoiceLevels => voiceLevelsNow()) satisfies Sdk['readVoiceLevels']

function change(changes: Partial<VoiceSessionStandIn>): void {
  session.set(Object.freeze({ ...session.get(), ...changes }))
}

let heldLevels: HostVoiceLevels = NO_LEVELS

/** The controls of this area, gathered by host.ts. */
export const voiceControls = Object.freeze({
  /** The session from now on: the one now with these changes (any of its fields, as useVoice answers them). */
  setVoice(changes: Partial<VoiceSessionStandIn>): void {
    change(changes)
  },
  /**
   * The session in `phase`, run by `mode` (the one running, else quick-ask; none at idle), its microphone as that
   * engine has it: quick-ask's open while it listens, a Live call's for the whole call. Its error goes but at 'error'.
   */
  setVoicePhase(phase: HostVoicePhase, mode?: HostVoiceMode): void {
    const now = session.get()
    const engine = phase === 'idle' ? null : mode ?? now.mode ?? DEFAULT_ENGINE
    change({ phase, mode: engine, micOpen: micOpenIn(phase, engine), error: phase === 'error' ? now.error : null })
  },
  /** The microphone from now on: open or closed, and muted (a Live call's mute). */
  setVoiceMic(open: boolean, muted = false): void {
    change({ micOpen: open, muted })
  },
  /** What the member is saying or said last (heard), and what Auto is saying or said last (reply). */
  setVoiceWords(words: { readonly heard?: string; readonly reply?: string }): void {
    change(words)
  },
  /** The session failed, with this sentence for the member: the error phase, the microphone closed. */
  setVoiceError(message: string): void {
    change({ phase: 'error', mode: session.get().mode ?? DEFAULT_ENGINE, micOpen: false, error: message })
  },
  /** What the host can offer from now on: VOICE_DEFAULTS with these changes; null for no host voice on this page. */
  setVoiceAvailable(changes: Partial<HostVoiceAvailability> | null): void {
    availability.set(changes === null ? null : Object.freeze({ ...VOICE_DEFAULTS, ...changes }))
  },
  /** The levels readVoiceLevels answers from now on while a session runs: the ones set before with these changes. */
  setVoiceLevels(levels: Partial<HostVoiceLevels>): void {
    const next: HostVoiceLevels = Object.freeze({ ...heldLevels, ...levels })
    heldLevels = next
    setVoiceLevelsSource(() => next)
  },
  /**
   * `chatId`'s saved rows landed (core's chat_changed): the session's words there leave its messages, and stay out while
   * Auto's reply of that exchange grows; the member's next words show again. The saved rows themselves are not added.
   */
  voiceTurnSaved,
  /** How many times the host's stop() ran since the last reset: useVoice's, the button's Stop, End call and Close. */
  voiceStops,
  /** Each press of a VoiceButton that reached the host since the last reset, oldest first. */
  voicePresses,
})

/** Every control's default again. */
export function resetVoice(): void {
  resetVoiceSession()
  heldLevels = NO_LEVELS
}
