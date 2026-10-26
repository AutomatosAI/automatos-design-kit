/**
 * Theme voice (SDK 1.2.0): the fake host's voice session, which the fake voice area (src/sdk/voice.ts) and its
 * VoiceButton stand-in (src/sdk/voice-button.tsx) read. Not an SDK name. It mirrors the host's voice as a theme sees it
 * in core (at 2e57484810204fb9b3481c86a0faed7c6eb3d0ae): the session's fields (lib/voice/engine.ts VoiceSnapshot and
 * IDLE_VOICE), what the host can offer (lib/voice/host/availability.ts, resolveVoiceMode), what a press does
 * (components/voice/voice-press.ts ownsSession and pressAction) and stop(), over cells a test sets (host.ts).
 *
 * A press acts on the session as the host would, as far as a theme can see: a start listens (the microphone open) in
 * the engine it resolves to, on the conversation the button names or else the one on screen (voice-host.ts start), a
 * release thinks, a stop ends the session (quick-ask goes back to idle, a Live call to ended). Each press that reaches
 * the host is kept, and every stop() is counted, for a test to read back. While the session runs on a conversation,
 * its words show there as two messages at the end (live-voice-turns.ts).
 */
import type {
  HostVoiceAvailability, HostVoiceLevels, HostVoiceMode, HostVoicePhase, VoiceButtonMode, VoiceButtonPress,
} from '@automatos/theme-sdk'
import { cell, log } from './cell.ts'
import { activeChatId } from './scripted/chat-script.ts'

/** The session's own fields, as core's engines report them (VoiceSnapshot). */
export interface VoiceSessionStandIn {
  readonly mode: HostVoiceMode | null
  readonly phase: HostVoicePhase
  readonly micOpen: boolean
  readonly muted: boolean
  readonly heard: string
  readonly reply: string
  readonly durationSec: number
  readonly error: string | null
  readonly chatId: string | null
}

/** One press of a VoiceButton that reached the host: what it did, in which engine, on which conversation. */
export interface VoicePressRecord {
  readonly action: VoicePressAction
  readonly mode: HostVoiceMode
  readonly chatId: string | null
}

export type VoicePressAction = 'start' | 'release' | 'stop'

/** A VoiceButton's options, as its props give them. */
export interface PressOptions {
  readonly mode: VoiceButtonMode
  readonly press: VoiceButtonPress
  /** undefined: the conversation on screen. */
  readonly chatId: string | null | undefined
}

/** engine.ts IDLE_VOICE: no session. */
export const IDLE_SESSION: VoiceSessionStandIn = Object.freeze({
  mode: null, phase: 'idle', micOpen: false, muted: false, heard: '', reply: '', durationSec: 0, error: null, chatId: null,
})
/** refusal.ts LIVE_REASON_SENTENCES voice_live_not_armed: why Live can't start where no one has set it up. */
export const LIVE_NOT_SET_UP = "Auto Live isn't set up yet. An admin can set it up in Settings."
/** What a test starts with: the host's voice on the page, quick-ask in this browser, Live not set up. */
export const VOICE_DEFAULTS: HostVoiceAvailability = Object.freeze({ quick: true, live: false, reason: LIVE_NOT_SET_UP })
/** voice-button-view.ts VOICE_BUTTON_WORDS.unavailable: the reason outside the host's voice. */
export const VOICE_UNAVAILABLE = "Voice isn't available on this page."
/** voice-button-view.ts VOICE_BUTTON_WORDS.failed: a failure with no sentence of its own. */
export const VOICE_FAILED = 'Voice stopped. Try again.'
export const NO_LEVELS: HostVoiceLevels = Object.freeze({ user: 0, agent: 0 })

/** voice-button.tsx RUNNING: a session runs (readVoiceLevels answers zeros otherwise). */
const RUNNING: ReadonlySet<HostVoicePhase> = new Set<HostVoicePhase>(['connecting', 'listening', 'thinking', 'speaking'])
/** voice-press.ts HEARING. */
const HEARING: ReadonlySet<HostVoicePhase> = new Set<HostVoicePhase>(['connecting', 'listening'])
/** voice-button.tsx ON_THE_CALL: a Live call's microphone is open for all of it. */
const ON_THE_CALL: ReadonlySet<HostVoicePhase> = new Set<HostVoicePhase>(['listening', 'thinking', 'speaking'])
const LEVEL_MIN = 0
const LEVEL_MAX = 1

export const session = cell<VoiceSessionStandIn>(IDLE_SESSION)
/** null: no host voice on this page (outside core's VoiceProvider). */
export const availability = cell<HostVoiceAvailability | null>(VOICE_DEFAULTS)
let readLevels: () => HostVoiceLevels = () => NO_LEVELS
let stops = 0
const presses = log<VoicePressRecord>()

export const isRunning = (phase: HostVoicePhase): boolean => RUNNING.has(phase)

/** The microphone as an engine has it in `phase`: quick-ask's open while it listens, a Live call's for all of it. */
export function micOpenIn(phase: HostVoicePhase, mode: HostVoiceMode | null): boolean {
  return mode === 'live' ? ON_THE_CALL.has(phase) : phase === 'listening'
}

/** voice-press.ts ownsSession: running or ended in the control's engine, on its conversation when it names one. */
export function ownsSession(now: VoiceSessionStandIn, mode: VoiceButtonMode, chatId: string | null | undefined): boolean {
  if (now.phase === 'idle' || now.mode === null) return false
  if (mode !== 'auto' && now.mode !== mode) return false
  return chatId === undefined || chatId === null || now.chatId === null || now.chatId === chatId
}

/** availability.ts resolveVoiceMode: `auto` is Live when it can start, else quick-ask when it can, else Live. */
export function resolveMode(requested: VoiceButtonMode, available: HostVoiceAvailability): HostVoiceMode {
  if (requested !== 'auto') return requested
  if (available.live) return 'live'
  return available.quick ? 'quick' : 'live'
}

/** voice-press.ts pressAction: what a press does now ('none': a held press while the microphone is already open). */
export function pressAction(now: VoiceSessionStandIn, options: PressOptions): VoicePressAction | 'none' {
  if (!ownsSession(now, options.mode, options.chatId)) return 'start'
  if (now.mode === 'live') return 'stop'
  if (HEARING.has(now.phase)) return options.press === 'toggle' ? 'release' : 'none'
  return 'start'
}

/** The host's stop(): counted, and the session ends as core's engines end it: quick-ask idle, a Live call ended. */
export function stopVoice(): void {
  stops += 1
  const now = session.get()
  const ended = now.mode === 'live' ? { phase: 'ended' as const } : { phase: 'idle' as const, mode: null }
  session.set(Object.freeze({ ...now, ...ended, micOpen: false, muted: false }))
}

/** voice-host.ts start: the conversation a control names (null: a new chat), else the one on screen. */
const startedOn = (named: string | null | undefined): string | null => (named === undefined ? activeChatId() : named)

/** Carries out a press on the host: kept, then the session moves as the host would move it (Live ignores a release). */
export function runPress(action: VoicePressAction | 'none', options: PressOptions): void {
  const available = availability.get()
  const now = session.get()
  if (action === 'none' || available === null || (action === 'release' && now.mode !== 'quick')) return
  const mode = action === 'start' ? resolveMode(options.mode, available) : now.mode ?? resolveMode(options.mode, available)
  const chatId = action === 'start' ? startedOn(options.chatId) : now.chatId
  presses.add(Object.freeze({ action, mode, chatId }))
  if (action === 'stop') stopVoice()
  else if (action === 'release') session.set(Object.freeze({ ...now, phase: 'thinking', micOpen: false }))
  else session.set(Object.freeze({ ...IDLE_SESSION, mode, chatId, phase: 'listening', micOpen: true }))
}

function level(value: number): number {
  return Number.isFinite(value) ? Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, value)) : LEVEL_MIN
}

/** The levels now, each 0 to 1: the source's while a session runs on a page with the host's voice, else zeros. */
export function voiceLevelsNow(): HostVoiceLevels {
  if (availability.get() === null || !isRunning(session.get().phase)) return NO_LEVELS
  const { user, agent } = readLevels()
  return Object.freeze({ user: level(user), agent: level(agent) })
}

/** Where the levels come from: fixed ones a test sets, or the browser harness's moving ones (src/host/voice.ts). */
export function setVoiceLevelsSource(read: () => HostVoiceLevels): void {
  readLevels = read
}

export const voiceStops = (): number => stops
export const voicePresses = (): readonly VoicePressRecord[] => presses.all()

/** No session, the defaults offered, zero levels, nothing pressed or stopped. */
export function resetVoiceSession(): void {
  session.set(IDLE_SESSION)
  availability.set(VOICE_DEFAULTS)
  readLevels = () => NO_LEVELS
  stops = 0
  presses.clear()
}
