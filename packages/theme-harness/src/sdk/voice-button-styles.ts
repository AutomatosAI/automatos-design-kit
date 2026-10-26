/**
 * The VoiceButton stand-in's geometry and words (src/sdk/voice-button.tsx), from core's components/voice/
 * voice-button.tsx, voice-button-view.ts, voice-controls.tsx and AiVoiceLabel.tsx (at
 * 2e57484810204fb9b3481c86a0faed7c6eb3d0ae; the control row that wraps and its labelled Stop, End call and Close from
 * core's fix/voice-stop-label change, bfd1022dc9704713c341cb8cbe26e6a16c73d1d3, ahead of its merge), in plain colours.
 * The press takes the `--voice-button-*` custom properties a theme styles core's button with, each with a plain default
 * here (core's are Studio's tokens), so a theme's styling shows in the harness as it does on core. The AI voice caption
 * is core's: a tiny caption in the text's own colour, never a pill or a badge.
 */
import type { CSSProperties } from 'react'
import type { VoiceButtonPress, VoiceButtonSize } from '@automatos/theme-sdk'

/** voice-button-view.ts VOICE_BUTTON_WORDS: every word the button says. */
export const VOICE_WORDS = Object.freeze({
  hold: 'Hold to talk',
  toggle: 'Talk to Auto',
  allowMic: 'Allow the microphone if your browser asks.',
  stop: 'Stop',
  failed: 'Voice stopped. Try again.',
})
/** voice-button-view.ts DEFAULT_LABELS: the button's name when the theme gives none, what a press does. */
export const DEFAULT_LABELS: Readonly<Record<VoiceButtonPress, string>> = Object.freeze({
  hold: VOICE_WORDS.hold,
  toggle: VOICE_WORDS.toggle,
})
/** AiVoiceLabel.tsx AI_VOICE_LABEL. */
export const AI_VOICE_LABEL = 'AI voice assistant'
/** voice-controls.tsx: the microphone's state, the call's end and close, and a failure's two ways out. */
export const CONTROL_WORDS = Object.freeze({
  micLive: 'Mic live', micMuted: 'Mic muted', endCall: 'End call', closeLive: 'Close live voice', tryAgain: 'Try again', close: 'Close',
})

/** The icon beside a stop control's word: lucide's Square, PhoneOff and X, as core draws them. */
export type StopGlyph = 'square' | 'phone-off' | 'x'

/** One stop control: its name, the word it shows beside its icon, the icon, and whether it is in the alert colour. */
export interface StopControlWords {
  readonly name: string
  readonly word: string
  readonly glyph: StopGlyph
  readonly alert: boolean
}

/**
 * voice-controls.tsx StopButton (the quick ask's Stop) and EndOrClose (a Live call's End call, and Close once it
 * ended, named "Close live voice"): each shows its word beside its icon.
 */
export const STOP_CONTROLS: Readonly<Record<'stop' | 'endCall' | 'closeLive', StopControlWords>> = Object.freeze({
  stop: Object.freeze({ name: VOICE_WORDS.stop, word: VOICE_WORDS.stop, glyph: 'square', alert: false }),
  endCall: Object.freeze({ name: CONTROL_WORDS.endCall, word: CONTROL_WORDS.endCall, glyph: 'phone-off', alert: true }),
  closeLive: Object.freeze({ name: CONTROL_WORDS.closeLive, word: CONTROL_WORDS.close, glyph: 'x', alert: false }),
})
/** orb-state.ts ORB_STATE_LABELS: the state a screen reader hears. */
export const STATE_WORDS = Object.freeze({
  idle: 'Voice is off',
  connecting: 'Connecting…',
  listening: 'Auto is listening',
  thinking: 'Auto is thinking…',
  speaking: 'Auto is speaking',
  ended: 'Call ended',
  error: 'Voice connection error',
})
/** voice-button-view.ts VOICE_BUTTON_CSS_VARS: the custom properties a theme styles the button with. */
export const VOICE_BUTTON_CSS_VARS: readonly string[] = Object.freeze([
  '--voice-button-size',
  '--voice-button-radius',
  '--voice-button-bg',
  '--voice-button-fg',
  '--voice-button-active-bg',
  '--voice-button-active-fg',
  '--voice-button-ring',
])

/** voice-button.tsx SIZE_CLASSES and ICON_CLASSES: the press's side and its glyph's, for each size. */
const PRESS_SIDE: Readonly<Record<VoiceButtonSize, string>> = Object.freeze({ sm: '2rem', md: '2.5rem', lg: '3.5rem' })
export const GLYPH_SIDE: Readonly<Record<VoiceButtonSize, number>> = Object.freeze({ sm: 16, md: 20, lg: 24 })
const PLAIN_IDLE_BG = '#18181b'
const PLAIN_ACTIVE_BG = '#a16207'
const PLAIN_FG = '#ffffff'
const PLAIN_RING = '#2563eb'
const PLAIN_ALERT = '#b91c1c'

/** voice-button.tsx's root: `inline-flex flex-col items-center gap-1`. */
export const ROOT: CSSProperties = Object.freeze({ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '4px' })

/** voice-button.tsx PRESS_CLASS with IDLE_CLASS or ACTIVE_CLASS, at `size`. */
export function pressStyle(size: VoiceButtonSize, active: boolean, disabled: boolean): CSSProperties {
  const side = `var(--voice-button-size, ${PRESS_SIDE[size]})`
  return {
    display: 'inline-flex', flexShrink: 0, alignItems: 'center', justifyContent: 'center', userSelect: 'none', touchAction: 'none',
    width: side, height: side, borderRadius: 'var(--voice-button-radius, 9999px)',
    background: active ? `var(--voice-button-active-bg, ${PLAIN_ACTIVE_BG})` : `var(--voice-button-bg, ${PLAIN_IDLE_BG})`,
    color: active ? `var(--voice-button-active-fg, ${PLAIN_FG})` : `var(--voice-button-fg, ${PLAIN_FG})`,
    outlineColor: `var(--voice-button-ring, ${PLAIN_RING})`,
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
  }
}

/** Tailwind's sr-only: the screen reader's line, on no pixel. */
export const SR_ONLY: CSSProperties = Object.freeze({
  position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', borderWidth: 0,
})
/**
 * voice-button.tsx VoiceControl's slot (`w-fit`) and its row (`flex flex-wrap items-center gap-x-1.5 gap-y-1 px-1`),
 * which wraps, so the caption, the microphone and Stop fit a phone under the button.
 */
export const CONTROL_SLOT: CSSProperties = Object.freeze({ width: 'fit-content' })
export const CONTROL_ROW: CSSProperties = Object.freeze({
  display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: '6px', rowGap: '4px', padding: '0 4px',
})
/** AiVoiceLabel.tsx: `shrink-0 text-[10px] leading-none` in the text's colour; no box, border or fill. */
export const CAPTION: CSSProperties = Object.freeze({ flexShrink: 0, fontSize: '10px', lineHeight: 1, color: 'inherit' })
/** voice-controls.tsx MicState and the duration: `text-[11px]`. */
export const SMALL_TEXT: CSSProperties = Object.freeze({ fontSize: '11px', lineHeight: 1.2, color: 'inherit' })
/**
 * voice-controls.tsx LABELLED_CONTROL_CLASS on an outline button (`h-7 gap-1 rounded-full px-2 text-xs`, medium weight,
 * on one line): Stop, End call (in the alert colour) and Close, each its 14 px icon (CONTROL_GLYPH_SIDE) and its word.
 */
export function stopControlStyle(alert: boolean): CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px', height: '28px', padding: '0 8px',
    borderRadius: '9999px', border: '1px solid currentColor', background: 'transparent', color: alert ? PLAIN_ALERT : 'inherit',
    fontSize: '12px', lineHeight: '16px', fontWeight: 500, whiteSpace: 'nowrap', cursor: 'pointer',
  }
}
/** voice-controls.tsx CONTROL_ICON_CLASS: `h-3.5 w-3.5`. */
export const CONTROL_GLYPH_SIDE = 14
/** voice-controls.tsx LiveCallFailure: the sentence and its two buttons. */
export const FAILURE: CSSProperties = Object.freeze({
  maxWidth: '28rem', borderRadius: '8px', border: `1px solid ${PLAIN_ALERT}`, padding: '8px 16px', textAlign: 'center',
  fontSize: '12px', color: 'inherit',
})
export const FAILURE_BUTTON: CSSProperties = Object.freeze({
  marginTop: '8px', marginInline: '4px', padding: '2px 8px', borderRadius: '6px', border: '1px solid currentColor',
  background: 'transparent', color: 'inherit', fontSize: '12px', cursor: 'pointer',
})
