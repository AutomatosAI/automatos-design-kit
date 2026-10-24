import { useMemo } from 'react'

import { useLook } from '@automatos/theme-sdk'

import { toHudLook } from './spec'
import type { HudLook } from './types'

/**
 * The active look as HUD reads it, for the code that follows a knob (Auto shown or not, his clip still or
 * moving). The host keeps the looks and paints the active one; outside a look runtime, or for a look that
 * isn't HUD's, this is the default look (ARC), the same one boot/prepaint.json paints then.
 */
export function useHudLook(): HudLook {
  const { look } = useLook()
  return useMemo(() => toHudLook(look), [look])
}
