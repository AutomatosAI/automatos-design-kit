import type { ReactNode } from 'react'
import { HeaderUtilities, openGlobalSearch } from '@automatos/theme-sdk'

import { Sidebar } from './sidebar'
import styles from './frame.module.css'

/**
 * frame@1: the frame the host draws around every page while {{name}} is the style and the window is at least
 * theme.json's minWidth wide (below it the host draws its own chrome).
 *
 * The sidebar holds the host's own menu and the theme's two screens; the header row keeps the host's search and
 * its utilities (Help, notifications, the theme menu, the account), which every frame renders. The page is
 * `children`: one of the theme's screens, or a page of the host's own, recoloured by the look. A full-bleed page
 * (the chat) fills the column; any other scrolls inside it, so the frame stays the height of the window.
 * `autoWidget` is the host's floating Auto, placed as the host hands it over.
 */

export interface FrameProps {
  readonly children?: ReactNode
  /** No padding and no width cap: a column the page fills, as the host's own shell gives the chat. */
  readonly fullBleed?: boolean
  /** The host's floating Auto widget. */
  readonly autoWidget?: ReactNode
}

export const SEARCH_TEXT = 'Search'
export const SEARCH_LABEL = 'Open search'

export function Frame({ children, fullBleed = false, autoWidget }: FrameProps) {
  return (
    <div className={styles.frame}>
      <Sidebar />
      <div className={styles.column}>
        <header className={styles.header}>
          <button type="button" className={styles.search} onClick={openGlobalSearch} aria-label={SEARCH_LABEL}>
            {SEARCH_TEXT}
          </button>
          <div className={styles.utilities}>
            <HeaderUtilities />
          </div>
        </header>
        {/* tabIndex -1: the page takes the focus from script only, as the host hands it over. */}
        <main className={fullBleed ? styles.fullBleed : styles.page} tabIndex={-1}>
          {fullBleed ? children : <div className={styles.pageInner}>{children}</div>}
        </main>
      </div>
      {autoWidget}
    </div>
  )
}
