import { useCallback, useState } from 'react'
import { type ThemeStateOptions, useThemeState } from '@automatos/theme-sdk'

/**
 * HUD 1.4.0: a switch the viewer flips that HUD remembers: the rail hidden (src/frame/hud-frame.tsx) and Auto's core
 * folded (src/chat/voice-core.tsx). It is kept through the SDK's storage area, for the signed-in account in this
 * browser, holding `true` while on and no value otherwise, so it outlives a reload and every tab follows one flip.
 * Where the host keeps no theme state (not ready yet, or a write it refuses), the flip holds on this page.
 */

/** For the signed-in account, in this browser until it is removed. */
export const KEPT_SWITCH_STATE: ThemeStateOptions = Object.freeze({ lifetime: 'browser', within: 'account' })

export interface KeptSwitch {
  readonly on: boolean
  /** Flips it, keeping the new value through the host where it can. */
  readonly toggle: () => void
}

export function useKeptSwitch(key: string): KeptSwitch {
  const kept = useThemeState(key, KEPT_SWITCH_STATE)
  // Set only while the host refused to keep a flip: the page's own value, until the next flip the host keeps.
  const [here, setHere] = useState<boolean | null>(null)
  const on = here ?? kept.value === true
  const { set, remove } = kept
  const toggle = useCallback(() => {
    const next = !on
    const result = next ? set(true) : remove()
    setHere(result.ok ? null : next)
  }, [on, set, remove])
  return { on, toggle }
}
