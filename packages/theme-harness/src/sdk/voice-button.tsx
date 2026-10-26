/**
 * Theme voice (SDK 1.2.0): the stand-in for the SDK's `voice.VoiceButton`. It mirrors core's
 * frontend/lib/theme-sdk/host-cards/voice-button.tsx over components/voice/voice-button.tsx (at
 * 2e57484810204fb9b3481c86a0faed7c6eb3d0ae): the props checked as core checks them (a TypeError naming the prop), and
 * the same DOM a theme styles: the root (`data-voice-button="root"`) with `data-voice-state`, `data-voice-mode`,
 * `data-voice-press`, `data-voice-size` and `data-voice-mic`, a real <button> for the press
 * (`data-voice-button="press"`, named by `label` or by what a press does), and the screen reader's line.
 *
 * While the session is the button's (voice-press.ts ownsSession: its engine, its conversation), the host's control
 * shows under it in the protected surface `voice-control`, in a row that wraps: the "AI voice assistant" caption (a
 * tiny caption, never a pill), the microphone's state and Stop (quick-ask) or End call / Close live voice (a Live
 * call), each a small outlined button showing its icon and its word (core's fix/voice-stop-label, bfd1022dc); then the
 * microphone prompt while it connects and a failure's sentence with Try again and Close. A press acts on the fake
 * host's session (src/internal/voice-session.ts): `hold` starts on the pointer's press and sends on its release, a
 * click no pointer made counts as a toggle (as core's does), `toggle` starts, then sends or ends. With no host voice on
 * the page (host.setVoiceAvailable(null)) it is drawn disabled, titled with the reason. The hotkey is checked, not
 * listened for.
 */
import type { HostVoiceAvailability, VoiceButtonMode, VoiceButtonPress, VoiceButtonProps, VoiceButtonSize } from '@automatos/theme-sdk'
import { type MouseEvent, type PointerEvent, useRef } from 'react'
import { refuse } from '../internal/cell.ts'
import {
  availability, isRunning, ownsSession, pressAction, resolveMode, runPress, session, stopVoice, VOICE_FAILED, VOICE_UNAVAILABLE,
  type PressOptions, type VoiceSessionStandIn,
} from '../internal/voice-session.ts'
import {
  AI_VOICE_LABEL, CAPTION, CONTROL_GLYPH_SIDE, CONTROL_ROW, CONTROL_SLOT, CONTROL_WORDS, DEFAULT_LABELS, FAILURE, FAILURE_BUTTON,
  GLYPH_SIDE, pressStyle, ROOT, SMALL_TEXT, SR_ONLY, STATE_WORDS, STOP_CONTROLS, stopControlStyle, VOICE_WORDS, type StopGlyph,
} from './voice-button-styles.ts'

type Sdk = typeof import('@automatos/theme-sdk')

const MODES: readonly VoiceButtonMode[] = ['auto', 'quick', 'live']
const PRESSES: readonly VoiceButtonPress[] = ['hold', 'toggle']
const SIZES: readonly VoiceButtonSize[] = ['sm', 'md', 'lg']
const PRIMARY_BUTTON = 0
/** A click no pointer made (a key, a screen reader) has no click count. */
const NO_POINTER_CLICKS = 0
const SECONDS_PER_MINUTE = 60
const SECONDS_PAD = 2

function choice<T extends string>(value: unknown, allowed: readonly T[], prop: string): T | undefined {
  if (value === undefined) return undefined
  const found = allowed.find((option) => option === value)
  return found ?? refuse(`VoiceButton needs ${prop} to be one of ${allowed.join(', ')}.`)
}

function text(value: unknown, prop: string, nullable: boolean): string | null | undefined {
  if (value === undefined) return undefined
  if (nullable && value === null) return null
  if (typeof value === 'string' && value.trim()) return value
  return refuse(`VoiceButton needs ${prop} to be some text${nullable ? ' or null' : ''}.`)
}

/** host-cards/voice-button.tsx checkedVoiceButtonProps: a TypeError naming the first prop of the wrong kind. */
export function checkedVoiceButtonProps(props: VoiceButtonProps): VoiceButtonProps {
  return {
    conversation: text(props.conversation, 'conversation', true),
    mode: choice(props.mode, MODES, 'mode'),
    press: choice(props.press, PRESSES, 'press'),
    hotkey: text(props.hotkey, 'hotkey', true),
    size: choice(props.size, SIZES, 'size'),
    label: text(props.label, 'label', false) ?? undefined,
  }
}

/** voice-button-view.ts voiceStatusWords: the state, and the microphone's when it is open; nothing at rest. */
function statusWords(now: VoiceSessionStandIn): string {
  if (now.phase === 'idle') return ''
  const state = now.phase === 'error' && now.error ? now.error : STATE_WORDS[now.phase]
  if (!now.micOpen) return state
  return `${state}. ${now.muted ? CONTROL_WORDS.micMuted : CONTROL_WORDS.micLive}`
}

interface View {
  readonly owned: boolean
  readonly state: VoiceSessionStandIn['phase']
  readonly mode: 'quick' | 'live'
  readonly micOpen: boolean
  readonly status: string
  readonly title: string
}

/** voice-button-view.ts voiceButtonView: the session from the button's side. */
function viewOf(now: VoiceSessionStandIn, available: HostVoiceAvailability | null, options: PressOptions, label: string): View {
  const offered = available ?? { quick: false, live: false, reason: VOICE_UNAVAILABLE }
  const owned = available !== null && ownsSession(now, options.mode, options.chatId)
  const next = resolveMode(options.mode, offered)
  const reason = available === null ? VOICE_UNAVAILABLE : next === 'live' ? offered.reason : null
  return {
    owned,
    state: owned ? now.phase : 'idle',
    mode: owned && now.mode !== null ? now.mode : next,
    micOpen: owned && now.micOpen,
    status: owned ? statusWords(now) : '',
    title: reason ?? label,
  }
}

interface Handlers {
  readonly onClick: (event: MouseEvent<HTMLButtonElement>) => void
  readonly onPointerDown?: (event: PointerEvent<HTMLButtonElement>) => void
  readonly onPointerUp?: () => void
  readonly onPointerCancel?: () => void
  readonly onPointerLeave?: () => void
}

/** voice-press.ts holdPress and togglePress, over the fake host's session. */
function useHandlers(options: PressOptions): Handlers {
  const holding = useRef(false)
  const act = (as: PressOptions): void => runPress(pressAction(session.get(), as), options)
  if (options.press === 'toggle') return { onClick: () => act(options) }
  const up = (): void => {
    if (!holding.current) return
    holding.current = false
    runPress('release', options)
  }
  return {
    onClick: (event) => {
      if (event.detail === NO_POINTER_CLICKS) act({ ...options, press: 'toggle' })
    },
    onPointerDown: (event) => {
      if (event.button > PRIMARY_BUTTON) return
      const action = pressAction(session.get(), options)
      holding.current = action === 'start'
      runPress(action, options)
    },
    onPointerUp: up,
    onPointerCancel: up,
    onPointerLeave: up,
  }
}

function MicGlyph({ size }: { readonly size: VoiceButtonSize }) {
  const side = GLYPH_SIDE[size]
  return (
    <svg aria-hidden="true" width={side} height={side} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0M12 17v5" />
    </svg>
  )
}

/** lucide's Square, PhoneOff and X, in a 24 px box, drawn at CONTROL_GLYPH_SIDE: the icon beside a stop control's word. */
const STOP_GLYPHS: Readonly<Record<StopGlyph, readonly string[]>> = Object.freeze({
  square: ['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z'],
  'phone-off': [
    'M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3'
      + 'a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63'
      + 'A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91',
    'M22 2 2 22',
  ],
  x: ['M18 6 6 18', 'm6 6 12 12'],
})

function StopGlyphIcon({ glyph }: { readonly glyph: StopGlyph }) {
  return (
    <svg
      aria-hidden="true" width={CONTROL_GLYPH_SIDE} height={CONTROL_GLYPH_SIDE} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2}
    >
      {STOP_GLYPHS[glyph].map((path) => <path key={path} d={path} />)}
    </svg>
  )
}

/**
 * voice-button.tsx StopControl over voice-controls.tsx StopButton and EndOrClose: Stop while quick-ask runs; End call,
 * or Close once a call ended; none for a failure. Each is a small outlined button, its icon and its word.
 */
function StopControl({ now }: { readonly now: VoiceSessionStandIn }) {
  const running = isRunning(now.phase)
  if (now.phase === 'error' || (now.mode !== 'live' && !running)) return null
  const control = now.mode !== 'live' ? STOP_CONTROLS.stop : running ? STOP_CONTROLS.endCall : STOP_CONTROLS.closeLive
  return (
    <button type="button" aria-label={control.name} style={stopControlStyle(control.alert)} onClick={stopVoice}>
      <StopGlyphIcon glyph={control.glyph} />
      {control.word}
    </button>
  )
}

const minutes = (seconds: number): string => `${Math.floor(seconds / SECONDS_PER_MINUTE)}:${String(seconds % SECONDS_PER_MINUTE).padStart(SECONDS_PAD, '0')}`

/** voice-button.tsx VoiceControl: the caption, the microphone and the stop control, inside the protected surface. */
function VoiceControl({ now }: { readonly now: VoiceSessionStandIn }) {
  return (
    <div data-voice-control-slot="" style={CONTROL_SLOT}>
      <div data-protected-surface="voice-control">
        <div data-protected-surface-inner="" style={CONTROL_ROW}>
          <span role="note" aria-label={AI_VOICE_LABEL} data-testid="ai-voice-label" style={CAPTION}>{AI_VOICE_LABEL}</span>
          {now.micOpen ? <span style={SMALL_TEXT}>{now.muted ? CONTROL_WORDS.micMuted : CONTROL_WORDS.micLive}</span> : null}
          {now.micOpen && now.durationSec > 0 ? <span aria-hidden="true" style={SMALL_TEXT}>{minutes(now.durationSec)}</span> : null}
          <StopControl now={now} />
        </div>
      </div>
    </div>
  )
}

/** voice-button.tsx VoiceNotices: the microphone prompt while connecting, and a failure with Try again and Close. */
function VoiceNotices({ now, options }: { readonly now: VoiceSessionStandIn; readonly options: PressOptions }) {
  if (now.phase === 'connecting' && !now.micOpen) return <p data-voice-notice="allow-microphone" style={SMALL_TEXT}>{VOICE_WORDS.allowMic}</p>
  if (now.phase !== 'error') return null
  const retry = (): void => runPress('start', { ...options, mode: now.mode ?? options.mode })
  return (
    <div role="alert" style={FAILURE}>
      <p>{now.error ?? VOICE_FAILED}</p>
      <button type="button" style={FAILURE_BUTTON} onClick={retry}>{CONTROL_WORDS.tryAgain}</button>
      <button type="button" style={FAILURE_BUTTON} onClick={stopVoice}>{CONTROL_WORDS.close}</button>
    </div>
  )
}

/** voice.VoiceButton: the press, the screen reader's line, and, while the session is the button's, its controls. */
export const VoiceButton: Sdk['VoiceButton'] = function VoiceButton(props) {
  const { conversation, mode = 'auto', press = 'hold', size = 'md', label } = checkedVoiceButtonProps(props)
  const now = session.use()
  const available = availability.use()
  const options: PressOptions = { mode, press, chatId: conversation }
  const handlers = useHandlers(options)
  const name = label ?? DEFAULT_LABELS[press]
  const view = viewOf(now, available, options, name)
  const disabled = available === null
  return (
    <div
      data-voice-button="root" data-voice-state={view.state} data-voice-mode={view.mode} data-voice-press={press}
      data-voice-size={size} data-voice-mic={view.micOpen ? 'open' : 'closed'} style={ROOT}
    >
      <button
        type="button" data-voice-button="press" aria-label={name} aria-pressed={view.owned} title={view.title} disabled={disabled}
        style={pressStyle(size, view.owned, disabled)} {...handlers}
      >
        <MicGlyph size={size} />
      </button>
      <span role="status" aria-live="polite" data-voice-status="" style={SR_ONLY}>{view.status}</span>
      {view.owned ? <VoiceControl now={now} /> : null}
      {view.owned ? <VoiceNotices now={now} options={options} /> : null}
    </div>
  )
}
