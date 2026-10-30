import type { HostVoicePhase } from '@automatos/theme-sdk'
import { captionFor } from '@automatos/mascot/media'
import type { MascotName } from '@automatos/mascot/types'

import { stateGlyph, stateWord } from '../art/state-words'

/**
 * What Auto's stage shows (the design's W2 rail and P2 strip): the state he is drawn in, the state pill's glyph and
 * word, and the caption a screen reader hears in his name. The chat's turn sets it (@automatos/mascot's reducer,
 * use-auto.ts), unless the host's voice session is under way: then the session does, as mascot-placement.md's voice
 * row says (loading while it waits for the microphone, listening, thinking, idle while he speaks, said "Speaking",
 * oops on a failure). Pure.
 */

export interface Stage {
  readonly state: MascotName
  readonly glyph: string
  readonly word: string
  readonly caption: string
}

export const SPEAKING = 'Speaking'

const VOICE_STATES: Partial<Readonly<Record<HostVoicePhase, MascotName>>> = {
  connecting: 'loading',
  listening: 'listening',
  thinking: 'thinking',
  speaking: 'idle',
  error: 'oops',
}

function stageIn(state: MascotName): Stage {
  return { state, glyph: stateGlyph(state), word: stateWord(state), caption: captionFor(state) }
}

export function stageOf(turn: MascotName, voice: HostVoicePhase): Stage {
  if (voice === 'speaking') return { state: 'idle', glyph: '●', word: SPEAKING, caption: SPEAKING }
  return stageIn(VOICE_STATES[voice] ?? turn)
}

/** Auto's one name on the stage: "Auto, Working on it". */
export function stageLabel(stage: Stage): string {
  return `Auto, ${stage.caption}`
}
