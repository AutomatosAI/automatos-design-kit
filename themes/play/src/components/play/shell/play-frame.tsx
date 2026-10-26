'use client'

import { type ReactNode, type RefObject, useId, useRef } from 'react'
import { Search } from '../../../vendor/lucide-react/index.js'
import { HeaderUtilities, openGlobalSearch } from '@automatos/theme-sdk'

import { usePhoneLayout } from '../../../lib/play/phone-layout'
import { useAccentLikeText } from '../../looks/use-accent-like-text'
import { AsleepGate } from '../edges/asleep-gate'
import { PhoneBar } from './phone-bar'
import { PhoneMenu } from './phone-menu'
import { PlaySidebar } from './play-sidebar'
import styles from './play-frame.module.css'
import { usePhoneMenu } from './use-phone-menu'

/**
 * PRD-260 T-004 — Play's frame around every page under Play (D7, D8): from
 * 1024 px, Play's sidebar, a header row that keeps the core's utilities (search,
 * Help, notifications, the theme menu, the profile control by edition) and the
 * page. Studio's pages render inside it as they do in the Studio shell, recoloured
 * by the look (D3); Play's own pages bring their own columns. MainLayout renders
 * it, and hands over the floating Auto widget as the Studio shell has it.
 * PRD-261 A-14f: the utilities are the SDK's HeaderUtilities (the Studio header's
 * cluster, PRD §4.4) and search is the SDK's openGlobalSearch.
 *
 * Play 1.2.0: Play draws from a phone's width up (theme.json's minWidth, 360), and in a window narrower than its
 * desktop layout (lib/play/phone-layout.ts) the frame is the Ember design's phone: the phone's top bar (phone-bar.tsx:
 * Menu, the wordmark, Chats and Shelf) and no sidebar, so the page takes the whole width; the sidebar's lists, search
 * and the host's header utilities move into the menu Menu opens (phone-menu.tsx), and everything behind it, the
 * host's floating Auto widget too, is inert while it is open. The page keeps its place in the tree either way, so a
 * window crossing the width keeps the page as it is. The frame says which layout it draws in data-layout.
 */

/** The global search's shortcut, as aria-keyshortcuts names it. */
export const SEARCH_SHORTCUT = 'Meta+K'

/** True when the host handed over a widget to draw (nothing, null and false draw nothing). */
export function hasAutoWidget(autoWidget: ReactNode): boolean {
  return autoWidget !== undefined && autoWidget !== null && autoWidget !== false
}

export interface PlayFrameProps {
  readonly children: ReactNode
  /** As in the Studio shell: no padding and no width cap, a column the page fills (the chat). */
  readonly fullBleed?: boolean
  /** The floating Auto widget, exactly as the Studio shell renders it. */
  readonly autoWidget?: ReactNode
}

/**
 * PRD-260 T-009 — while GET /health fails, AsleepGate shows "Automatos is
 * asleep" in place of the frame and its page; they mount again, fresh, when the
 * backend answers (Ember mock 07, the whole window), and the page's <main>
 * takes the focus the swap dropped (tabIndex={-1}: script focus only;
 * P260-FX-22, M21).
 */
export function PlayFrame(props: PlayFrameProps) {
  const main = useRef<HTMLElement>(null)
  return (
    <AsleepGate wakeFocus={main}>
      <FrameLayout {...props} mainRef={main} />
    </AsleepGate>
  )
}

interface FrameLayoutProps extends PlayFrameProps {
  readonly mainRef: RefObject<HTMLElement | null>
}

function FrameLayout({ children, fullBleed = false, autoWidget, mainRef }: FrameLayoutProps) {
  // Play 1.1.1: on a look whose accent reads as its text colour, the secondary buttons are outlines (play-theme.css).
  const accentLikeText = useAccentLikeText()
  const phone = usePhoneLayout()
  const menu = usePhoneMenu(phone)
  const menuId = useId()
  const behindMenu = phone && menu.open
  // `safe-bottom` (the one safe-area helper, globals.css) keeps the frame's
  // bottom edge clear of a home bar, as the Studio shell does.
  return (
    <div
      className={`${styles.frame} safe-bottom`}
      data-accent-like-text={accentLikeText || undefined}
      data-layout={phone ? 'phone' : 'desktop'}
    >
      {!phone && <PlaySidebar />}
      <div className={styles.column} inert={behindMenu}>
        {phone ? <PhoneBar menu={menu} menuId={menuId} /> : <PlayHeader />}
        {fullBleed ? (
          <main ref={mainRef} className={styles.fullBleed} tabIndex={-1}>
            {children}
          </main>
        ) : (
          <main ref={mainRef} className={styles.page} tabIndex={-1}>
            <div className={styles.pageInner}>{children}</div>
          </main>
        )}
      </div>
      {phone && <PhoneMenu menu={menu} id={menuId} />}
      {hasAutoWidget(autoWidget) && (
        <div className={styles.widget} inert={behindMenu}>
          {autoWidget}
        </div>
      )}
    </div>
  )
}

/**
 * The header row: search (the ⌘K dialog) and the host's header utilities (the Studio header's cluster). The search
 * button is named by what it shows, "Search ⌘K" (a label that differed from it failed axe's label-in-name check, WCAG
 * 2.5.3), and announces its shortcut through aria-keyshortcuts (Play 1.1.1).
 */
function PlayHeader() {
  return (
    <header className={styles.header}>
      <button type="button" className={styles.search} onClick={openGlobalSearch} aria-keyshortcuts={SEARCH_SHORTCUT}>
        <Search className={styles.searchIcon} aria-hidden="true" />
        <span>Search</span>{' '}
        <kbd className={styles.kbd}>⌘K</kbd>
      </button>
      <div className={styles.utilities}>
        <HeaderUtilities />
      </div>
    </header>
  )
}
