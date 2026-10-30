import { HeaderUtilities, openGlobalSearch } from '@automatos/theme-sdk'

import { AutoSprite } from '../art/pixel-art'
import { PauseToggle } from '../motion/pause-toggle'
import { THEME_NAME } from '../theme'
import { Today } from './today'
import styles from './frame.module.css'
import ui from '../ui/ui.module.css'

/**
 * The desktop's status bar (the design's top bar): Auto's mark and the ARCADE wordmark, today's counters, the pause
 * control, search, and the host's header utilities (Help, notifications, the theme menu, the account), which every
 * frame renders. The utilities sit on a window-ground plate in Studio's own type: they draw in Studio's tokens, which
 * the palette paints for its windows, never for the bar.
 */

export const SEARCH_LABEL = 'Search'
export const WORDMARK_OVER = 'Automatos'

export function Wordmark({ compact = false }: { readonly compact?: boolean }) {
  return (
    <div className={styles.wordmark} data-compact={compact ? 'true' : undefined}>
      <AutoSprite state="idle" view={compact ? 'still' : 'mark'} still />
      <p className={styles.wordmarkText}>
        {!compact && <span className={styles.wordmarkOver}>{WORDMARK_OVER}</span>}
        <span className={styles.wordmarkName}>{THEME_NAME.toUpperCase()}</span>
      </p>
    </div>
  )
}

export function SearchButton() {
  return (
    <button type="button" className={ui.secondary} onClick={openGlobalSearch}>
      {SEARCH_LABEL}
    </button>
  )
}

export function StatusBar() {
  return (
    <header className={styles.bar}>
      <Wordmark />
      <Today />
      <span className={styles.spacer} />
      <PauseToggle />
      <SearchButton />
      <div className={`${ui.host} ${styles.utilities}`}>
        <HeaderUtilities />
      </div>
    </header>
  )
}
