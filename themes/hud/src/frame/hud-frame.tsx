import type { ReactNode } from 'react'

import { useHudLook } from '../lib/looks/use-hud-look'
import { Backdrop } from './backdrop'
import styles from './frame.module.css'
import { SideRail } from './side-rail'
import { TopBar } from './top-bar'

/**
 * HUD's frame around every page at the theme's width: the backdrop, the top bar, the side rail and the page.
 * The host's pages render inside it as in the Studio shell, recoloured by the look's Studio tokens; a
 * full-bleed page (the chat) fills the column itself, any other scrolls inside it, capped as Studio caps it.
 * The host hands over the floating Auto widget, drawn beside the page as the Studio shell has it. The frame
 * carries the active look's id, which a test reads; every colour and switch is the look's painted variables.
 */

export interface HudFrameProps {
  readonly children?: ReactNode
  /** As in the Studio shell: no padding and no width cap, a column the page fills. */
  readonly fullBleed?: boolean
  /** The host's floating Auto widget. */
  readonly autoWidget?: ReactNode
}

export function HudFrame({ children, fullBleed = false, autoWidget }: HudFrameProps) {
  const look = useHudLook()
  // `safe-bottom` (the host's one safe-area helper) keeps the frame's bottom edge clear of a home bar.
  return (
    <div className={`${styles.frame} safe-bottom`} data-look={look.id}>
      <Backdrop />
      <TopBar />
      <div className={styles.body}>
        <SideRail />
        {fullBleed ? (
          <main className={styles.fullBleed} tabIndex={-1}>
            {children}
          </main>
        ) : (
          <main className={styles.page} tabIndex={-1}>
            <div className={styles.pageInner}>{children}</div>
          </main>
        )}
      </div>
      {autoWidget}
    </div>
  )
}
