import { findPreset, PRESETS } from "./presets";
import { GLOW_MAX, GLOW_MIN, type Look } from "./types";

// The Looks page's rules, pure: which Look the active one started from, whether it has been
// edited since, and what "Save as new look" makes. No React, no storage.

/** The fields the editor changes. Everything else (schema, id, name, sub) stays as picked. */
export const EDITABLE_FIELDS = ["ground", "accent", "font", "shell", "light", "glow"] as const satisfies readonly (keyof Look)[];

export type EditableField = (typeof EDITABLE_FIELDS)[number];
export type LookValues = Pick<Look, EditableField>;

/** What a freshly saved Look says under its name (the Looks prototype). */
export const SAVED_SUB = "Saved just now";
export const EDITED_MARK = "edited";

/** The preset or saved Look the active Look was picked from, as it was saved. */
export function baseLook(look: Look, saved: readonly Look[]): Look | undefined {
  return findPreset(look.id) ?? saved.find((entry) => entry.id === look.id);
}

export function sameValues(a: Look, b: Look): boolean {
  return EDITABLE_FIELDS.every((field) => a[field] === b[field]);
}

/** True when the active Look's values differ from the Look it was picked from. */
export function isEdited(look: Look, saved: readonly Look[]): boolean {
  const base = baseLook(look, saved);
  return base !== undefined && !sameValues(base, look);
}

/** The line beside the heading: "Ember", or "Ember · edited". */
export function statusLine(look: Look, saved: readonly Look[]): string {
  return isEdited(look, saved) ? `${look.name} · ${EDITED_MARK}` : look.name;
}

/** A copy of the Look with some values changed. Never mutates `look`. */
export function withValues(look: Look, values: Partial<LookValues>): Look {
  return { ...look, ...values };
}

/** A slider reading as a whole glow inside the allowed range. */
export function clampGlow(value: number): number {
  if (!Number.isFinite(value)) return GLOW_MIN;
  return Math.min(GLOW_MAX, Math.max(GLOW_MIN, Math.round(value)));
}

/** "Off" at 0, else "24%". */
export function glowLabel(glow: number): string {
  return glow === GLOW_MIN ? "Off" : `${glow}%`;
}

/** "My look N" with the lowest N from the number of saved Looks up that no saved Look is called. */
export function newLookName(saved: readonly Look[]): string {
  const names = new Set(saved.map((entry) => entry.name));
  let n = saved.length + 1;
  while (names.has(`My look ${n}`)) n += 1;
  return `My look ${n}`;
}

/** "look-N" with the lowest N that no preset or saved Look uses (a valid LOOK_ID_PATTERN id). */
export function freshLookId(saved: readonly Look[]): string {
  const ids = new Set([...PRESETS, ...saved].map((entry) => entry.id));
  let n = 1;
  while (ids.has(`look-${n}`)) n += 1;
  return `look-${n}`;
}

/** The active Look's values under a new id and name, ready for saveLook. */
export function asNewLook(look: Look, saved: readonly Look[]): Look {
  return { ...look, id: freshLookId(saved), name: newLookName(saved), sub: SAVED_SUB };
}
