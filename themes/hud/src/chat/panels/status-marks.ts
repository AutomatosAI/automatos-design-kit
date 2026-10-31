import { DISPLAY_STATE_LABELS, type DisplayState, type Mission, type ReadinessState } from '@automatos/theme-sdk'

import type { StatusMark, StatusTone } from './panel-rows'

/**
 * HUD 1.2.0 (PRD-268): a row's state as HUD draws it, from the server's one vocabulary. A Mission row's or a brief
 * row's `display_state` is the SDK's glyph and its HUD word (DISPLAY_STATE_LABELS: ◆ NEEDS YOU, ● WORKING, ✓ READY,
 * ✓ DONE, ✕ FAILED), and a readiness item's state is ✓ READY, ○ NOT CHECKED or ◆ NEEDS SETUP. The colour is HUD's own
 * rule (the PRD's colour roles, HUD's column): every state in the readable accent (`--hud-accent-text`) but failed, in
 * the error colour (`--hud-error-text`), and the quiet ones (done, a ready or unchecked item) in the secondary text;
 * never `--accent`. The glyph and the word always carry the meaning, since the accent and the error colour sit close
 * on some looks. A state the server didn't send, or one HUD doesn't know, draws nothing. Pure but for the SDK's table.
 */

/** HUD's tone for each row state. */
export const STATE_TONES: Readonly<Record<DisplayState, StatusTone>> = {
  needs_you: 'live',
  working: 'live',
  ready: 'live',
  done: 'quiet',
  failed: 'failed',
}

/** A readiness item's glyph, HUD word and tone. */
export const READINESS_MARKS: Readonly<Record<ReadinessState, StatusMark>> = {
  ready: { glyph: '✓', word: 'READY', tone: 'quiet' },
  not_checked: { glyph: '○', word: 'NOT CHECKED', tone: 'quiet' },
  needs_setup: { glyph: '◆', word: 'NEEDS SETUP', tone: 'live' },
}

/** The glyph before a row's next step. */
export const NEXT_STEP_MARK = '▸'

function own<T extends object>(table: T, key: unknown): key is keyof T {
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(table, key)
}

/** A row state's mark, or null for none or a state HUD doesn't know. */
export function stateMark(state: unknown): StatusMark | null {
  if (!own(STATE_TONES, state)) return null
  const label = DISPLAY_STATE_LABELS[state]
  return { glyph: label.glyph, word: label.hudWord, tone: STATE_TONES[state] }
}

/** A readiness item's mark, or null for a state HUD doesn't know. */
export function readinessMark(state: unknown): StatusMark | null {
  return own(READINESS_MARKS, state) ? READINESS_MARKS[state] : null
}

/** The Missions as MISSIONS lists them: the ones that need you first, then the rest, each in the host's order. */
export function missionsInOrder(missions: readonly Mission[]): readonly Mission[] {
  const needsYou = missions.filter((mission) => mission.display_state === 'needs_you')
  return [...needsYou, ...missions.filter((mission) => mission.display_state !== 'needs_you')]
}
