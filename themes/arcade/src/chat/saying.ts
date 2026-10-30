import type { HostChatMessage, HostVoicePhase } from '@automatos/theme-sdk'
import type { MascotName } from '@automatos/mascot/types'

/**
 * What the dialogue box says, from the conversation (pure): Auto's newest reply while it is the last word; "…" while
 * he thinks about your message; a greeting before anything is said; otherwise a line that it is your move. And the
 * state his portrait shows: the turn's (the chat's state machine), or the host's voice session while one listens,
 * thinks, connects or fails.
 */

export const GREETING = "Hi, I'm Auto. Tell me what you need, and I'll get the party moving."
export const YOUR_MOVE = 'Your move.'
export const FAILED_WORDS = 'Oops. That reply went wrong: the story says what happened.'

export type Saying =
  | { readonly kind: 'greeting' }
  | { readonly kind: 'thinking' }
  | { readonly kind: 'quiet' }
  | { readonly kind: 'reply'; readonly message: HostChatMessage }

export function sayingOf(messages: readonly HostChatMessage[], streaming: boolean): Saying {
  const last = messages[messages.length - 1]
  if (!last) return { kind: 'greeting' }
  if (last.role === 'assistant') {
    const empty = last.text.trim().length === 0
    if (empty && last.writing) return { kind: 'thinking' }
    return { kind: 'reply', message: last }
  }
  return streaming ? { kind: 'thinking' } : { kind: 'quiet' }
}

/** The words of what the dialogue box says. */
export function wordsOf(saying: Saying): string {
  if (saying.kind === 'greeting') return GREETING
  if (saying.kind === 'quiet') return YOUR_MOVE
  if (saying.kind === 'thinking') return ''
  const { message } = saying
  const failed = message.savedError !== null || (message.error !== null && message.text.trim().length === 0)
  return failed ? FAILED_WORDS : message.text
}

/** The reply id the dialogue box is saying, so the story leaves its words out. */
export function sayingId(saying: Saying): string | null {
  return saying.kind === 'reply' ? saying.message.id : null
}

const VOICE_STATES: Partial<Readonly<Record<HostVoicePhase, MascotName>>> = {
  connecting: 'loading',
  listening: 'listening',
  thinking: 'thinking',
  error: 'oops',
}

export function portraitState(turn: MascotName, voice: HostVoicePhase): MascotName {
  return VOICE_STATES[voice] ?? turn
}
