import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'

import { useHostPathname } from '@automatos/theme-sdk'

/**
 * Play 1.2.0, after HUD's (themes/hud/src/frame/use-nav-drawer.ts): the phone's menu (phone-menu.tsx), open or shut,
 * and the button that opens it. Esc, Close and a tap on the glass shut it and hand the focus back to the menu
 * button, as a dialog does; following a link shuts it and leaves the focus to the page it opens (the host moves it
 * to that page's heading). A new page, and leaving the phone layout, shut it too, so it never reopens by itself.
 */

export interface PhoneMenuState {
  readonly open: boolean
  /** Opens the menu. */
  readonly show: () => void
  /** Shuts it and gives the focus back to the menu button (Esc, Close, the glass). */
  readonly dismiss: () => void
  /** Shuts it and leaves the focus where it goes (a link followed, New chat, search). */
  readonly leave: () => void
  /** The menu button, which gets the focus back on dismiss. */
  readonly buttonRef: RefObject<HTMLButtonElement | null>
}

/** `phone`: the frame draws its phone layout, the one place the menu is. */
export function usePhoneMenu(phone: boolean): PhoneMenuState {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const giveBack = useRef(false)
  const pathname = useHostPathname()
  useEffect(() => {
    setOpen(false)
  }, [pathname, phone])
  useEffect(() => {
    if (open || !giveBack.current) return
    giveBack.current = false
    buttonRef.current?.focus()
  }, [open])
  const show = useCallback(() => setOpen(true), [])
  const dismiss = useCallback(() => {
    giveBack.current = true
    setOpen(false)
  }, [])
  const leave = useCallback(() => setOpen(false), [])
  return { open, show, dismiss, leave, buttonRef }
}
