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

import { MicLive } from '../voice/mic-live'
import { Clock } from './clock'
import styles from './top-bar.module.css'

/**
 * The top bar (the design's 56 px bar): the diamond mark and AUTOMATOS // HUD, which goes to the chat; the
 * clock in the middle; then where Automatos runs and whether it answers, as a glyph and a word (never colour
 * alone); MIC LIVE while the host's voice has the microphone open (src/voice/mic-live.tsx); the host's search, named by its visible words with its shortcut in aria-keyshortcuts (a name that
 * differs from the words on screen fails WCAG's label in name); LOOK, the look editor, lit while it is open; and the
 * host's own header utilities (the SDK's HeaderUtilities: Help, notifications, the theme menu and the account). The
 * bar is the page's one banner, and it is named: a browser gives the banner role to this <header> alone, but Testing
 * Library gives it to every <header>, a panel's head and a screen's heading row too, so a test finds the bar by its
 * name. The phone's bar (src/frame/phone-top-bar.tsx) draws the brand and the status from here, and its menu
 * (src/frame/nav-drawer.tsx) search and LOOK.
 */

export const TOP_BAR_LABEL = 'Top bar'
export const BRAND_LABEL = 'Automatos HUD'
/** The host's search shortcut, said to assistive technology (the button's name is its visible words). */
export const SEARCH_SHORTCUT = 'Meta+K'
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

/** The mark and AUTOMATOS // HUD; `phone`: the phone's AUTOMATOS //, as the design's phone has it, named the same. */
export function Brand({ phone = false }: { readonly phone?: boolean }) {
  return (
    <HostLink href={CHAT_HREF} className={phone ? `${styles.brand} ${styles.phoneBrand}` : styles.brand} aria-label={BRAND_LABEL}>
      <span className={styles.mark} aria-hidden="true" />
      <span className={styles.wordmark} aria-hidden="true">
        Automatos <span className={styles.slashes}>//</span>
        {phone ? null : ' HUD'}
      </span>
    </HostLink>
  )
}

/** The status's words: "Local · online", or on a phone the connection alone ("online"), so the bar fits 360 px. */
export function statusWords(edition: HostEdition, connection: HostHealth['connection'], phone: boolean): string {
  const word = CONNECTION_STATUS[connection].word
  return phone ? word : `${EDITION_WORDS[edition]} · ${word}`
}

/** "● Local · online": the edition, then the backend's connection; a glyph and a word, never colour alone. */
export function StatusChip({ phone = false }: { readonly phone?: boolean }) {
  const edition = useEdition()
  const { connection } = useHealth()
  return (
    <span className={styles.status} data-connection={connection} role="status">
      <span className={styles.glyph} aria-hidden="true">
        {CONNECTION_STATUS[connection].glyph}
      </span>
      {statusWords(edition, connection, phone)}
    </span>
  )
}

export function SearchButton() {
  return (
    <button type="button" className={styles.search} onClick={openGlobalSearch} aria-keyshortcuts={SEARCH_SHORTCUT}>
      <span>Search</span> <kbd className={styles.kbd}>⌘K</kbd>
    </button>
  )
}

export function LookLink() {
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
        <MicLive />
        <SearchButton />
        <LookLink />
        <div className={styles.utilities}>
          <HeaderUtilities />
        </div>
      </div>
    </header>
  )
}
