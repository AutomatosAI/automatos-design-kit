import { useMediaPreferences } from '@automatos/theme-sdk'

import { useHudLook } from '../lib/looks/use-hud-look'

/**
 * HUD 1.2.0 (PRD-268): the one entrance of a proactive surface as it appears (BRIEFING, the `▸ NEXT` line): a fade
 * and a 4 px rise over 180 ms, once, never a loop. It is the `data-hud-enter="rise"` mark, which each surface's
 * stylesheet animates; under the reduced-motion setting, and while the look's motion is off, there is no mark, so
 * nothing moves (and HUD's global stylesheet ends every animation under reduced motion besides).
 */

export const ENTRANCE = 'rise'

/** The entrance mark for a surface appearing now, or undefined while nothing may move. */
export function useEntrance(): typeof ENTRANCE | undefined {
  const { reducedMotion } = useMediaPreferences()
  const lookStill = useHudLook().motion === 'off'
  return reducedMotion || lookStill ? undefined : ENTRANCE
}
