import { type ReactNode, useId } from 'react'

import { useHudLook } from '../lib/looks/use-hud-look'
import { usePhoneLayout } from '../lib/phone-layout'
import { Backdrop } from './backdrop'
import styles from './frame.module.css'
import { NavDrawer } from './nav-drawer'
import { PhoneTopBar } from './phone-top-bar'
import { SideRail } from './side-rail'
import { TopBar } from './top-bar'
import { useNavDrawer } from './use-nav-drawer'

/**
 * HUD's frame around every page at the theme's width: the backdrop, the top bar, the side rail and the page.
 * The host's pages render inside it as in the Studio shell, recoloured by the look's Studio tokens; a
 * full-bleed page (the chat) fills the column itself, any other scrolls inside it, capped as Studio caps it.
 * The host hands over the floating Auto widget, drawn beside the page as the Studio shell has it; while it does,
 * the rail's Auto dock steps aside, so Auto shows once. The frame carries the active look's id, which a test reads;
 * every colour and switch is the look's painted variables.
 *
 * In a window narrower than the desktop layout (src/lib/phone-layout.ts) it is the design's phone: the phone's top
 * bar (src/frame/phone-top-bar.tsx) and no rail, so the page takes the whole width; the rail's pages, search, LOOK
 * and the host's header utilities move into the menu MENU opens (src/frame/nav-drawer.tsx), and everything behind it
 * is inert while it is open. The page keeps its place in the tree either way, so a window crossing the width keeps
 * the page as it is. The frame says which layout it draws in data-layout.
 */

export interface HudFrameProps {
  readonly children?: ReactNode
  /** As in the Studio shell: no padding and no width cap, a column the page fills. */
  readonly fullBleed?: boolean
  /** The host's floating Auto widget. */
  readonly autoWidget?: ReactNode
}

/** True when the host handed over a widget to draw (nothing, null and false draw nothing). */
export function hasAutoWidget(autoWidget: ReactNode): boolean {
  return autoWidget !== undefined && autoWidget !== null && autoWidget !== false
}

export function HudFrame({ children, fullBleed = false, autoWidget }: HudFrameProps) {
  const look = useHudLook()
  const phone = usePhoneLayout()
  const drawer = useNavDrawer(phone)
  const drawerId = useId()
  // `safe-bottom` (the host's one safe-area helper) keeps the frame's bottom edge clear of a home bar.
  return (
    <div className={`${styles.frame} safe-bottom`} data-look={look.id} data-layout={phone ? 'phone' : 'desktop'}>
      <Backdrop />
      {phone ? <PhoneTopBar drawer={drawer} drawerId={drawerId} /> : <TopBar />}
      <div className={styles.body} inert={phone && drawer.open}>
        {!phone && <SideRail dock={!hasAutoWidget(autoWidget)} />}
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
      {phone && <NavDrawer drawer={drawer} id={drawerId} />}
      {autoWidget}
    </div>
  )
}
