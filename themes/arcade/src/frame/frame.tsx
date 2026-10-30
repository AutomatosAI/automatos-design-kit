import { type ReactNode, useEffect, useId, useState } from 'react'
import { useHostPathname } from '@automatos/theme-sdk'

import { Controls } from './controls'
import { PauseMenu } from './pause-menu'
import { PhoneMenu } from './phone-menu'
import { usePhoneLayout } from './phone-layout'
import { PowerStrip, ScreenBar } from './screen-bar'
import { StatusBar } from './status-bar'
import styles from './frame.module.css'

/**
 * frame@1: Arcade around every page while it is the style and the window is at least 360 px wide.
 *
 * At 1024 px and up it is the desktop: the status bar (wordmark, today's counters, the host's utilities) over the
 * pause menu and the page. Below it is a handheld console: a screen holding the page under its own small status
 * strip, and under the screen a D-pad (Chat, Quests, Inventory, Menu) and the host's voice button in a round arcade
 * surround. Menu turns the screen into the menu (the host's utilities, then every page) until a page is chosen.
 *
 * The page keeps its place in the tree in both layouts, so a window crossing the width keeps it as it is; the host's
 * pages render inside as in Studio's shell, recoloured by the palette's Studio tokens. A full-bleed page (the chat)
 * fills the column; any other scrolls inside it. The host's floating Auto widget is drawn as the host hands it over.
 * The frame's foot stays clear on both layouts: the host draws its AI label there, over Arcade's ground.
 */

export interface FrameProps {
  readonly children?: ReactNode
  readonly fullBleed?: boolean
  readonly autoWidget?: ReactNode
}

/** The phone's menu: open until a page is chosen or the page changes. */
function usePhoneMenu(phone: boolean) {
  const [open, setOpen] = useState(false)
  const pathname = useHostPathname()
  useEffect(() => setOpen(false), [pathname, phone])
  return { open: phone && open, toggle: () => setOpen((was) => !was), close: () => setOpen(false) }
}

export function Frame({ children, fullBleed = false, autoWidget }: FrameProps) {
  const phone = usePhoneLayout()
  const menu = usePhoneMenu(phone)
  const menuId = useId()
  return (
    <div className={styles.frame} data-layout={phone ? 'phone' : 'desktop'}>
      {phone ? <PowerStrip /> : <StatusBar />}
      <div className={styles.screen}>
        {phone ? <ScreenBar /> : <PauseMenu />}
        <main className={fullBleed ? styles.fullBleed : styles.page} tabIndex={-1} hidden={menu.open}>
          {fullBleed ? children : <div className={styles.pageInner}>{children}</div>}
        </main>
        {menu.open ? <PhoneMenu id={menuId} onClose={menu.close} /> : null}
      </div>
      {phone ? <Controls menuOpen={menu.open} menuId={menuId} onMenu={menu.toggle} /> : null}
      {autoWidget}
    </div>
  )
}
