import type { ReactNode } from 'react'

import { HudFrame } from '../frame/hud-frame'

/** frame@1's props: the page, the host's full-bleed flag and Auto's floating widget. */
export interface FrameSlotProps {
  readonly children?: ReactNode
  readonly fullBleed?: boolean
  readonly autoWidget?: ReactNode
}

/** frame@1: HUD's frame around every page (src/frame/hud-frame.tsx), in the entry chunk so it draws at once. */
export function HudFrameSlot({ children, fullBleed, autoWidget }: FrameSlotProps) {
  return (
    <HudFrame fullBleed={fullBleed} autoWidget={autoWidget}>
      {children}
    </HudFrame>
  )
}
