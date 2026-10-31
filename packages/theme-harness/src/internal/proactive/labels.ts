/**
 * PRD-268 §6.11.1, §6.12.2 (SDK 1.3.0): what a state is drawn as, a glyph, a word and a colour role, for the fake theme
 * area's DISPLAY_STATE_LABELS and the proactive card stand-ins. Not an SDK name.
 *
 * Copied from core's frontend/lib/proactive/display-state.ts (at 1a8956c874dc42cff05b96f431c50b7d722a71aa): ● in motion,
 * ○ waiting or not known yet, ◆ a person must act, ✓ finished or fine, ✕ failed. Each role names the Studio token that
 * paints it on a light ground and on a dark one; a status never goes through `--accent`. Unknown draws nothing: a state
 * that isn't one of these gives null.
 */
import type { DisplayState, DisplayStateLabel, ReadinessState, StatusRole, StatusToken } from '@automatos/theme-sdk'

/** The glyph before a running step's line (`▸ next_step`). */
export const NEXT_STEP_GLYPH = '▸'

const same = (token: string): StatusToken => Object.freeze({ light: token, dark: token })

/** display-state.ts STATUS_ROLE_TOKENS: needs-you is `warn-ink` on a light ground and `warning` on a dark one. */
export const STATUS_ROLE_TOKENS: Readonly<Record<StatusRole, StatusToken>> = Object.freeze({
  needs_you: Object.freeze({ light: '--warn-ink', dark: '--warning' }),
  working: same('--running'),
  ready: same('--success'),
  done: same('--success'),
  failed: same('--destructive'),
  needs_setup: same('--info'),
  not_checked: same('--muted-foreground'),
})

function label(glyph: string, word: string, hudWord: string, role: StatusRole): DisplayStateLabel {
  return Object.freeze({ glyph, word, hudWord, role, token: STATUS_ROLE_TOKENS[role] })
}

/** display-state.ts DISPLAY_STATE_LABELS: each row state's glyph, word, HUD word and colour role. */
export const DISPLAY_STATE_LABELS: Readonly<Record<DisplayState, DisplayStateLabel>> = Object.freeze({
  needs_you: label('◆', 'Needs you', 'NEEDS YOU', 'needs_you'),
  working: label('●', 'Working', 'WORKING', 'working'),
  ready: label('✓', 'Ready to look at', 'READY', 'ready'),
  done: label('✓', 'Done', 'DONE', 'done'),
  failed: label('✕', "Couldn't finish", 'FAILED', 'failed'),
})

/** display-state.ts READINESS_STATE_LABELS: a readiness item's glyph and word. */
export const READINESS_STATE_LABELS: Readonly<Record<ReadinessState, DisplayStateLabel>> = Object.freeze({
  ready: label('✓', 'Ready', 'READY', 'ready'),
  not_checked: label('○', 'Not checked', 'NOT CHECKED', 'not_checked'),
  needs_setup: label('◆', 'Needs setup', 'NEEDS SETUP', 'needs_setup'),
})

function own<T>(table: Readonly<Record<string, T>>, key: unknown): T | null {
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(table, key) ? table[key] : null
}

/** The label of a row's `display_state`, or null for anything else. */
export function displayStateLabel(state: unknown): DisplayStateLabel | null {
  return own<DisplayStateLabel>(DISPLAY_STATE_LABELS, state)
}

/** The label of a readiness item's `state`, or null for anything else. */
export function readinessStateLabel(state: unknown): DisplayStateLabel | null {
  return own<DisplayStateLabel>(READINESS_STATE_LABELS, state)
}
