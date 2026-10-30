import { useEffect, useRef } from 'react'
import { HeaderUtilities, useCoreNav, useHostPathname } from '@automatos/theme-sdk'

import { PauseToggle } from '../motion/pause-toggle'
import { THEME_NAME } from '../theme'
import { activeMenuId, buildMenu } from './menu'
import { MenuList } from './menu-list'
import { Mark } from './sidebar'
import styles from './phone.module.css'
import ui from '../ui/ui.module.css'

/**
 * The phone's top bar and its menu. The bar holds the menu button, the Candy mark and the host's header utilities,
 * which every frame renders at every width. The menu opens over the page as a sheet (every page, then the Pause
 * control); it takes the focus as it opens, Escape closes it and so does choosing a page (the frame closes it when the
 * page changes).
 */

export const MENU_OPEN = 'Menu'
export const MENU_LABEL = 'All pages'

export function PhoneBar({ open, menuId, onMenu }: { readonly open: boolean; readonly menuId: string; readonly onMenu: () => void }) {
  return (
    <header className={styles.bar}>
      <button type="button" className={styles.menuButton} aria-expanded={open} aria-controls={open ? menuId : undefined} onClick={onMenu}>
        <span className={styles.burger} aria-hidden="true" />
        <span className={ui.srOnly}>{MENU_OPEN}</span>
      </button>
      <p className={styles.brand}>
        <Mark />
        <span className={styles.brandName}>{THEME_NAME}</span>
      </p>
      <div className={`${ui.host} ${styles.utilities}`}>
        <HeaderUtilities />
      </div>
    </header>
  )
}

export function PhoneMenu({ id, onClose }: { readonly id: string; readonly onClose: () => void }) {
  const nav = useCoreNav()
  const activeId = activeMenuId(useHostPathname())
  const ref = useRef<HTMLElement>(null)
  useEffect(() => ref.current?.focus(), [])
  return (
    <nav
      id={id}
      ref={ref}
      className={`${ui.window} ${styles.sheet}`}
      aria-label={MENU_LABEL}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose()
      }}
    >
      <MenuList menu={buildMenu(nav)} activeId={activeId} />
      <PauseToggle />
    </nav>
  )
}
