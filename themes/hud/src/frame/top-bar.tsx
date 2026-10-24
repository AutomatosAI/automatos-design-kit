import {
  CHAT_HREF,
  HeaderUtilities,
  HostLink,
  LOOKS_HREF,
  openGlobalSearch,
  useEdition,
  useHealth,
  useHostPathname,
  type HostEdition,
  type HostHealth,
} from '@automatos/theme-sdk'

import { Clock } from './clock'
import styles from './top-bar.module.css'

/**
 * The top bar (the design's 56 px bar): the diamond mark and AUTOMATOS // HUD, which goes to the chat; the
 * clock in the middle; then where Automatos runs and whether it answers, as a glyph and a word (never colour
 * alone); the host's search; LOOK, the look editor, lit while it is open; and the host's own header
 * utilities (the SDK's HeaderUtilities: Help, notifications, the theme menu and the account). The bar is the page's
 * one banner, and it is named: a browser gives the banner role to this <header> alone, but Testing Library gives it
 * to every <header>, a panel's head and a screen's heading row too, so a test finds the bar by its name.
 */

export const TOP_BAR_LABEL = 'Top bar'
export const BRAND_LABEL = 'Automatos HUD'
export const SEARCH_LABEL = 'Open search (⌘K)'
export const LOOK_LABEL = 'Look'

const EDITION_WORDS: Readonly<Record<HostEdition, string>> = { local: 'Local', saas: 'Hosted' }
const CONNECTION_STATUS: Readonly<Record<HostHealth['connection'], { readonly glyph: string; readonly word: string }>> = {
  connected: { glyph: '●', word: 'online' },
  checking: { glyph: '◆', word: 'checking' },
  down: { glyph: '○', word: 'offline' },
}

function isUnder(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function Brand() {
  return (
    <HostLink href={CHAT_HREF} className={styles.brand} aria-label={BRAND_LABEL}>
      <span className={styles.mark} aria-hidden="true" />
      <span className={styles.wordmark} aria-hidden="true">
        Automatos <span className={styles.slashes}>//</span> HUD
      </span>
    </HostLink>
  )
}

/** "● Local · online": the edition, then the backend's connection. */
function StatusChip() {
  const edition = useEdition()
  const { connection } = useHealth()
  const status = CONNECTION_STATUS[connection]
  return (
    <span className={styles.status} data-connection={connection} role="status">
      <span className={styles.glyph} aria-hidden="true">
        {status.glyph}
      </span>
      {`${EDITION_WORDS[edition]} · ${status.word}`}
    </span>
  )
}

function SearchButton() {
  return (
    <button type="button" className={styles.search} onClick={openGlobalSearch} aria-label={SEARCH_LABEL}>
      <span>Search</span>
      <kbd className={styles.kbd}>⌘K</kbd>
    </button>
  )
}

function LookLink() {
  const open = isUnder(useHostPathname(), LOOKS_HREF)
  return (
    <HostLink href={LOOKS_HREF} className={styles.look} aria-current={open ? 'page' : undefined}>
      {LOOK_LABEL}
    </HostLink>
  )
}

export function TopBar() {
  return (
    <header className={styles.bar} aria-label={TOP_BAR_LABEL}>
      <Brand />
      <Clock />
      <div className={styles.end}>
        <StatusChip />
        <SearchButton />
        <LookLink />
        <div className={styles.utilities}>
          <HeaderUtilities />
        </div>
      </div>
    </header>
  )
}
