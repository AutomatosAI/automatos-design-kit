import { safeGlow } from '../lib/looks/engine'
import { DEFAULT_LOOK, findPreset, isPresetId } from '../lib/looks/presets'
import { GLOW_MIN, KNOB_NAMES, type HudLook, type KnobName, type Switch } from '../lib/looks/types'

/**
 * The LOOK drawer's rules, pure: which look the active one was picked from, whether it has been edited since, what
 * Save as new look makes, what Reset goes back to and how far the glow slider goes. No React and no state: the host
 * keeps the looks (the SDK's looks area), so these only read the looks they are handed.
 */

/** The knobs a look carries, and nothing of its identity. */
export type KnobValues = Pick<HudLook, KnobName>

/** The word the status line adds once the active look differs from the look it was picked from. */
export const EDITED_MARK = 'edited'

/** A saved look's id and name: `mine-1` and `MINE 1`, as the design names a look kept from the drawer. */
export const SAVED_ID_PREFIX = 'mine-'
export const SAVED_NAME_PREFIX = 'MINE '

/** The preset or saved look the active look was picked from, as it was kept; undefined for any other. */
export function baseLook(look: HudLook, saved: readonly HudLook[]): HudLook | undefined {
  return findPreset(look.id) ?? saved.find((entry) => entry.id === look.id)
}

export function sameKnobs(a: KnobValues, b: KnobValues): boolean {
  return KNOB_NAMES.every((knob) => a[knob] === b[knob])
}

/** True when the active look's knobs differ from the look it was picked from. */
export function isEdited(look: HudLook, saved: readonly HudLook[]): boolean {
  const base = baseLook(look, saved)
  return base !== undefined && !sameKnobs(base, look)
}

/** The line beside the heading: 'ARC', or 'ARC · edited'. */
export function statusLine(look: HudLook, saved: readonly HudLook[]): string {
  return isEdited(look, saved) ? `${look.name} · ${EDITED_MARK}` : look.name
}

/** A copy of the look with some knobs changed; `look` itself never changes. */
export function withValues(look: HudLook, values: Partial<KnobValues>): HudLook {
  return { ...look, ...values }
}

/** What Reset goes back to: the look it was picked from, or the default preset when it has none. */
export function resetTarget(look: HudLook, saved: readonly HudLook[]): HudLook {
  return baseLook(look, saved) ?? DEFAULT_LOOK
}

/** True for one of the user's own saved looks, which can be deleted; never a preset. */
export function isSavedLook(look: HudLook, saved: readonly HudLook[]): boolean {
  return !isPresetId(look.id) && saved.some((entry) => entry.id === look.id)
}

/** The lowest number from the count of saved looks up that no saved look's id or name uses. */
function freshNumber(saved: readonly HudLook[]): number {
  const ids = new Set(saved.map((entry) => entry.id))
  const names = new Set(saved.map((entry) => entry.name))
  let number = saved.length + 1
  while (ids.has(`${SAVED_ID_PREFIX}${number}`) || names.has(`${SAVED_NAME_PREFIX}${number}`)) number += 1
  return number
}

/** The active look's knobs under a fresh id and name, ready for the SDK's saveLook. */
export function asNewLook(look: HudLook, saved: readonly HudLook[]): HudLook {
  const number = freshNumber(saved)
  return { ...look, id: `${SAVED_ID_PREFIX}${number}`, name: `${SAVED_NAME_PREFIX}${number}`, sub: '' }
}

/** A slider's reading as a whole number from `min` to `max`. */
export function clampKnob(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.round(value)))
}

/** The strongest glow this look's background and accent keep readable at AA: where the glow slider stops. */
export function glowCap(look: Pick<HudLook, 'ground' | 'accent'>): number {
  return safeGlow(look.ground, look.accent)
}

/** The glow the page paints for this look: its own, or the cap where the cap is lower. */
export function shownGlow(look: Pick<HudLook, 'ground' | 'accent' | 'glow'>): number {
  return clampKnob(look.glow, GLOW_MIN, glowCap(look))
}

/** The other choice of a switch knob. */
export function flipped(value: Switch): Switch {
  return value === 'on' ? 'off' : 'on'
}
