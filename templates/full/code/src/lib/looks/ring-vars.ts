import type { CssVars } from '@automatos/look-kit/css'
import { RING_VARS, type RingTone } from '@automatos/mascot/ring'

/**
 * Auto's ring colours for the style sheet (style.ts mascotSlots). @automatos/mascot's ringColour reads each ring
 * tone's look variable by the name the package gives it (RING_VARS), which need not be this theme's: its look
 * variables carry its own prefix. So the style sheet hands ringColour the look's variables under the package's
 * names, each from this theme's own variable for that tone. `automatos-theme new --template full` adds this file.
 */

/** Each ring tone's look variable, by this theme's name. */
export const RING_LOOK_VARS: Readonly<Record<RingTone, string>> = {
  light: '--pl-auto-light',
  accent: '--pl-accent',
  error: '--pl-error',
  dusk: '--pl-auto-dusk',
  quiet: '--pl-ground-text-2',
}

/** The look's variables under the names ringColour reads (RING_VARS), from this theme's own; a tone it lacks stays out. */
export function ringVars(vars: CssVars): CssVars {
  const tones = Object.keys(RING_LOOK_VARS) as RingTone[]
  const entries = tones.flatMap((tone): Array<[string, string]> => {
    const value = vars[RING_LOOK_VARS[tone]]
    return value === undefined ? [] : [[RING_VARS[tone], value]]
  })
  return Object.fromEntries(entries)
}
