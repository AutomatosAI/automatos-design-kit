import { type KeyboardEvent, type MouseEvent, useEffect, useRef } from 'react'

import { HeaderUtilities } from '@automatos/theme-sdk'

import { NewChatButton } from '../components/new-chat'
import { focusables, trapKey } from './focus-trap'
import styles from './nav-drawer.module.css'
import { MORE_LABEL, NAV_LABEL, RailGroupList, RailList, RecentList, useRailNav } from './side-rail'
import { LookLink, SearchButton } from './top-bar'
import type { NavDrawerState } from './use-nav-drawer'

/**
 * The frame's menu on a phone, which MENU in the phone's top bar opens: a modal panel from the left edge over the
 * drawer glass, holding what the desktop's rail and top bar hold and a phone has no room for: New chat, search and
 * LOOK; the rail's pages in their groups with HUD's Conversations after Chat, RECENT, and Docs and Settings (the rail's
 * own lists, src/frame/side-rail.tsx); then the host's header utilities (Help, notifications, the theme menu and the
 * account). It stays mounted while shut (hidden), so the frame always renders the host's utilities, as every frame
 * must. Open, it takes the focus (its Close button first), keeps Tab inside it, and Esc, Close or a tap on the glass
 * shut it, handing the focus back to MENU (src/frame/use-nav-drawer.ts); a link followed, or New chat, shuts it for the
 * page it opens.
 */

export const DRAWER_LABEL = 'Menu'
export const CLOSE_LABEL = 'Close menu'
/** What shuts the menu when pressed, as following a link does: a link, and New chat, which opens the chat afresh. */
const LEAVES_MENU = 'a, [data-leaves-menu]'

export interface NavDrawerProps {
  readonly drawer: NavDrawerState
  readonly id: string
}

/** The rail's lists: the pages in their groups, RECENT, then Docs and Settings. */
function DrawerNav() {
  const { nav, activeId } = useRailNav()
  return (
    <>
      <nav aria-label={NAV_LABEL} className={styles.nav}>
        {nav.groups.map((group) => (
          <RailGroupList key={group.id} group={group} activeId={activeId} />
        ))}
      </nav>
      <RecentList />
      {nav.footer.length > 0 && <RailList items={nav.footer} activeId={activeId} label={MORE_LABEL} />}
    </>
  )
}

/** Focus the menu's first control as it opens. */
function useFocusOnOpen(open: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (open && ref.current !== null) focusables(ref.current)[0]?.focus()
  }, [open])
  return ref
}

export function NavDrawer({ drawer, id }: NavDrawerProps) {
  const ref = useFocusOnOpen(drawer.open)
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (ref.current !== null) trapKey(event, ref.current, drawer.dismiss)
  }
  const onClick = (event: MouseEvent<HTMLDivElement>): void => {
    const { target } = event
    if (target instanceof Element && ref.current?.contains(target) && target.closest(LEAVES_MENU) !== null) drawer.leave()
  }
  return (
    <div className={styles.layer} hidden={!drawer.open}>
      <div className={styles.glass} aria-hidden="true" onClick={drawer.dismiss} />
      <div ref={ref} id={id} className={styles.drawer} role="dialog" aria-modal="true" aria-label={DRAWER_LABEL} onKeyDown={onKeyDown} onClick={onClick}>
        <div className={styles.head}>
          <span className={styles.title} aria-hidden="true">
            {DRAWER_LABEL}
          </span>
          <button type="button" className={styles.close} aria-label={CLOSE_LABEL} onClick={drawer.dismiss}>
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <div className={styles.actions}>
          <span className={styles.action} data-leaves-menu="">
            <NewChatButton />
          </span>
          <SearchButton />
          <LookLink />
        </div>
        <DrawerNav />
        <div className={styles.utilities}>
          <HeaderUtilities />
        </div>
      </div>
    </div>
  )
}
