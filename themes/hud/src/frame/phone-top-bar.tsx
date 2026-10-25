import { Brand, StatusChip, TOP_BAR_LABEL } from './top-bar'
import styles from './top-bar.module.css'
import type { NavDrawerState } from './use-nav-drawer'

/**
 * The top bar on a phone (the design's phone: AUTOMATOS // on the left, the status on the right): MENU, which opens
 * the frame's menu with the rail's pages, search, LOOK and the host's header utilities (src/frame/nav-drawer.tsx), the
 * mark and AUTOMATOS //, and the backend's connection as a glyph and a word. The design's MIC LIVE stands where the
 * status is; it arrives with the SDK's voice area, which a theme doesn't have yet. MENU says whether the menu is open
 * (aria-expanded) and which element it opens (aria-controls). The bar is the page's named banner, as on the desktop.
 */

export const MENU_LABEL = 'Menu'

export interface PhoneTopBarProps {
  readonly drawer: NavDrawerState
  /** The menu's id, for aria-controls. */
  readonly drawerId: string
}

export function PhoneTopBar({ drawer, drawerId }: PhoneTopBarProps) {
  return (
    <header className={`${styles.bar} ${styles.phoneBar}`} aria-label={TOP_BAR_LABEL} inert={drawer.open}>
      <button
        ref={drawer.buttonRef}
        type="button"
        className={styles.menu}
        aria-expanded={drawer.open}
        aria-controls={drawerId}
        aria-haspopup="dialog"
        onClick={drawer.show}
      >
        <span className={styles.menuIcon} aria-hidden="true" />
        {MENU_LABEL}
      </button>
      <Brand phone />
      <StatusChip phone />
    </header>
  )
}
