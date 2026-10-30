import { useEffect, useRef } from 'react'
import { HeaderUtilities, useCoreNav, useHostPathname } from '@automatos/theme-sdk'

import { PauseToggle } from '../motion/pause-toggle'
import { activeMenuId, buildMenu } from './menu'
import { MenuGroups } from './pause-menu'
import { SearchButton } from './status-bar'
import styles from './handheld.module.css'
import ui from '../ui/ui.module.css'

/**
 * The handheld's menu, in the screen's place while open: the host's utilities at the top (as the design has them),
 * search and the pause control, then every page in the pause menu's groups. It takes the focus when it opens and
 * Escape closes it; choosing a page closes it too (the frame closes it when the page changes).
 */

export const PHONE_MENU_LABEL = 'Menu'

export function PhoneMenu({ id, onClose }: { readonly id: string; readonly onClose: () => void }) {
  const nav = useCoreNav()
  const activeId = activeMenuId(useHostPathname())
  const ref = useRef<HTMLElement>(null)
  useEffect(() => ref.current?.focus(), [])
  return (
    <nav
      id={id}
      ref={ref}
      className={styles.phoneMenu}
      aria-label={PHONE_MENU_LABEL}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose()
      }}
    >
      <div className={`${ui.host} ${styles.phoneUtilities}`}>
        <HeaderUtilities />
      </div>
      <div className={styles.phoneActions}>
        <SearchButton />
        <PauseToggle />
      </div>
      <div className={`${ui.window} ${styles.phoneMenuList}`}>
        <MenuGroups groups={buildMenu(nav)} activeId={activeId} />
      </div>
    </nav>
  )
}
