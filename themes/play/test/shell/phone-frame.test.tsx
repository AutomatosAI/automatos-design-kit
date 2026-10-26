// Play 1.2.0 — Play's frame on a phone, on the kit's harness, after HUD's (themes/hud/test/frame/phone-frame.test.tsx).
// Below the desktop width (src/lib/play/phone-layout.ts: core's 1024 px, read through matchMedia, which
// test/support/window-width.ts stands in for, jsdom having none) it draws the Ember design's phone bar (Menu, the
// wordmark, Chats and Shelf, the current one marked), no sidebar and no header row, and the page in the whole width.
// Menu opens the menu: a modal dialog with New chat, search, the sidebar's nav (Conversations after Chat, Look on its
// own), Docs and Settings, the connection pill and the host's header utilities, which takes the focus, keeps Tab
// inside it, and shuts on Esc, Close or the glass with the focus back on Menu, or on a link followed, New chat or
// search; the bar, the page and the host's floating Auto widget are inert behind it. From 1024 px up, and wherever
// nothing says the width, the frame is the desktop's, and a window crossing the width keeps the page. Roles, names
// and attributes only.
import type { CoreNav } from '@automatos/theme-sdk'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { host } from '@automatos/theme-harness/host'
import { CHATS_LABEL, MENU_LABEL, PLACES_LABEL, SHELF_LABEL, TOP_BAR_LABEL } from '../../src/components/play/shell/phone-bar.tsx'
import { CLOSE_LABEL, MENU_TITLE, SEARCH_LABEL } from '../../src/components/play/shell/phone-menu.tsx'
import { DESKTOP_MIN_WIDTH, PHONE_QUERY } from '../../src/lib/play/phone-layout.ts'
import { PlayFrameSlot } from '../../src/play-slots.tsx'
import { DESKTOP_WIDTH, PHONE_WIDTH, resetWindowWidth, setWindowWidth } from '../support/window-width.ts'

const SIDEBAR = 'Sidebar'
const UTILITIES = 'Header utilities'
const DESKTOP_SEARCH = 'Search ⌘K'
const WORDMARK = 'Automatos Play'
const PAGE_TEXT = 'The page the host hands the frame'

const NAV: CoreNav = {
  primary: [
    { id: 'chat', label: 'Chat', description: null, href: '/chat', group: 'OPERATIONS', external: false },
    { id: 'agents', label: 'Agents', description: null, href: '/agents', group: 'WORKFORCE', external: false },
  ],
  footer: [
    { id: 'docs', label: 'Docs', description: null, href: 'https://docs.example.com', group: null, external: true },
    { id: 'settings', label: 'Settings', description: null, href: '/settings', group: null, external: false },
  ],
}

function renderFrame({ fullBleed = false, widget = false }: { readonly fullBleed?: boolean; readonly widget?: boolean } = {}) {
  return render(
    <PlayFrameSlot fullBleed={fullBleed} autoWidget={widget ? <button type="button" data-testid="auto-widget">Auto</button> : undefined}>
      <p data-testid="page">{PAGE_TEXT}</p>
    </PlayFrameSlot>,
  )
}

const layoutOf = (container: HTMLElement): string | null => container.querySelector('[data-layout]')?.getAttribute('data-layout') ?? null
const bar = (): HTMLElement => screen.getByRole('banner', { name: TOP_BAR_LABEL })
const menuButton = (): HTMLElement => within(bar()).getByRole('button', { name: MENU_LABEL })
const menu = (): HTMLElement => screen.getByRole('dialog', { name: MENU_TITLE })
const utilities = (): HTMLElement | null => document.querySelector<HTMLElement>('[data-protected-surface="header-utilities"]')

/** The phone frame with its menu open; Menu, found before the bar goes inert. */
function openMenu(): { readonly button: HTMLElement; readonly dialog: HTMLElement } {
  const button = menuButton()
  fireEvent.click(button)
  return { button, dialog: menu() }
}

beforeEach(() => {
  host.reset()
  host.setCoreNav(NAV)
  host.setReducedMotion(true)
})

afterEach(() => {
  resetWindowWidth()
})

describe('the breakpoint', () => {
  it("is core's desktop width: the phone layout below 1024 px, the desktop's from 1024 up", () => {
    expect(DESKTOP_MIN_WIDTH).toBe(1024)
    expect(PHONE_QUERY).toBe('(max-width: 1023px)')
    setWindowWidth(DESKTOP_MIN_WIDTH - 1)
    const phone = renderFrame()
    expect(layoutOf(phone.container)).toBe('phone')
    phone.unmount()
    setWindowWidth(DESKTOP_MIN_WIDTH)
    const desktop = renderFrame()
    expect(layoutOf(desktop.container)).toBe('desktop')
  })

  it('switches as the window crosses it, and keeps the page as it is', () => {
    setWindowWidth(DESKTOP_WIDTH)
    renderFrame()
    const page = screen.getByTestId('page')
    expect(screen.getByRole('complementary', { name: SIDEBAR })).toBeInTheDocument()
    act(() => setWindowWidth(PHONE_WIDTH))
    expect(screen.queryByRole('complementary', { name: SIDEBAR })).toBeNull()
    expect(menuButton()).toBeInTheDocument()
    expect(screen.getByTestId('page')).toBe(page)
    act(() => setWindowWidth(DESKTOP_WIDTH))
    expect(screen.getByRole('complementary', { name: SIDEBAR })).toBeInTheDocument()
    expect(screen.getByTestId('page')).toBe(page)
  })

  it("is the desktop's frame, untouched, where nothing says the width (no matchMedia, as on the server)", () => {
    const { container } = renderFrame()
    expect(layoutOf(container)).toBe('desktop')
    expect(screen.getByRole('complementary', { name: SIDEBAR })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: DESKTOP_SEARCH })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: MENU_LABEL })).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('the phone bar', () => {
  beforeEach(() => setWindowWidth(PHONE_WIDTH))

  it("draws the design's bar: Menu, the wordmark to the chat, Chats and Shelf, and no sidebar or header row", () => {
    renderFrame()
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false')
    expect(menuButton()).toHaveAttribute('aria-haspopup', 'dialog')
    expect(within(bar()).getByRole('link', { name: WORDMARK })).toHaveAttribute('href', '/chat')
    const places = within(bar()).getByRole('navigation', { name: PLACES_LABEL })
    expect(within(places).getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      [CHATS_LABEL, '/x/conversations'],
      [SHELF_LABEL, '/deliverables'],
    ])
    expect(screen.queryByRole('complementary', { name: SIDEBAR })).toBeNull()
    expect(screen.queryByRole('group', { name: UTILITIES })).toBeNull()
    expect(screen.queryByRole('button', { name: DESKTOP_SEARCH })).toBeNull()
  })

  it.each([
    ['/x/conversations', CHATS_LABEL],
    ['/deliverables', SHELF_LABEL],
  ])('marks the current place on %s', (path, current) => {
    host.setPathname(path)
    renderFrame()
    const places = within(bar()).getByRole('navigation', { name: PLACES_LABEL })
    expect(within(places).getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page').map((link) => link.textContent)).toEqual([
      current,
    ])
  })

  it('marks neither place on the chat', () => {
    host.setPathname('/chat')
    renderFrame()
    expect(within(bar()).getAllByRole('link').filter((link) => link.hasAttribute('aria-current'))).toEqual([])
  })

  it('gives a page the whole width: the bar, then its main, and no column beside them, framed or full bleed', () => {
    const framed = renderFrame()
    expect(within(screen.getByRole('main')).getByTestId('page')).toHaveTextContent(PAGE_TEXT)
    expect(Array.from(screen.getByRole('main').parentElement?.children ?? [])).toEqual([bar(), screen.getByRole('main')])
    framed.unmount()
    renderFrame({ fullBleed: true })
    expect(screen.getByTestId('page').parentElement).toBe(screen.getByRole('main'))
  })
})

describe('the phone menu', () => {
  beforeEach(() => setWindowWidth(PHONE_WIDTH))

  it('opens from Menu as a modal dialog that takes the focus, its Close button first', () => {
    renderFrame()
    const { button, dialog } = openMenu()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(button.getAttribute('aria-controls')).toBe(dialog.id)
    expect(within(dialog).getByRole('button', { name: CLOSE_LABEL })).toHaveFocus()
  })

  it("holds the sidebar's nav, Conversations after Chat and Look on its own, Docs and Settings, New chat and search", () => {
    renderFrame()
    const { dialog } = openMenu()
    const nav = within(dialog).getByRole('navigation', { name: 'Main' })
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(['Chat', 'Conversations', 'Agents', 'Look'])
    expect(within(nav).getByRole('link', { name: 'Conversations' })).toHaveAttribute('href', '/x/conversations')
    const more = within(dialog).getByRole('list', { name: 'More' })
    expect(within(more).getAllByRole('link').map((link) => link.textContent)).toEqual(['Docs', 'Settings'])
    expect(within(dialog).getByRole('status')).toHaveTextContent('Connected')
    expect(within(dialog).getByRole('button', { name: 'New chat' })).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: SEARCH_LABEL }))
    expect(host.globalSearchOpens()).toBe(1)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it("holds the host's header utilities, mounted while it is shut, and they work once it is open", () => {
    renderFrame()
    expect(utilities()).not.toBeNull()
    expect(screen.queryByRole('group', { name: UTILITIES })).toBeNull()
    const { dialog } = openMenu()
    const group = within(dialog).getByRole('group', { name: UTILITIES })
    fireEvent.click(within(group).getByRole('button', { name: 'Notifications' }))
    expect(host.cardActions()).toEqual([{ card: 'header-utilities', id: 'Notifications', action: 'opened' }])
  })

  it("keeps Tab inside it: its last control to its first, Shift+Tab its first to its last", () => {
    renderFrame()
    const { dialog } = openMenu()
    const close = within(dialog).getByRole('button', { name: CLOSE_LABEL })
    const inUtilities = within(within(dialog).getByRole('group', { name: UTILITIES })).getAllByRole('button')
    const last = inUtilities[inUtilities.length - 1]
    last.focus()
    fireEvent.keyDown(last, { key: 'Tab' })
    expect(close).toHaveFocus()
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    expect(last).toHaveFocus()
  })

  it('shuts on Esc, on Close and on the glass, each time giving the focus back to Menu', () => {
    renderFrame()
    const shut = (button: HTMLElement): void => {
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(button).toHaveAttribute('aria-expanded', 'false')
      expect(button).toHaveFocus()
    }
    const esc = openMenu()
    fireEvent.keyDown(within(esc.dialog).getByRole('link', { name: 'Agents' }), { key: 'Escape' })
    shut(esc.button)
    const close = openMenu()
    fireEvent.click(within(close.dialog).getByRole('button', { name: CLOSE_LABEL }))
    shut(close.button)
    const glass = openMenu()
    const pane = glass.dialog.previousElementSibling
    if (pane === null) throw new Error('The menu has no glass beside it.')
    expect(pane).toHaveAttribute('aria-hidden', 'true')
    fireEvent.click(pane)
    shut(glass.button)
  })

  it("makes the bar, the page and the host's floating Auto widget inert while it is open, and none once it shuts", () => {
    renderFrame({ widget: true })
    const column = screen.getByRole('main').parentElement
    const widget = screen.getByTestId('auto-widget')
    expect(widget.closest('[inert]')).toBeNull()
    const { button, dialog } = openMenu()
    expect(button.closest('[inert]')).not.toBeNull()
    expect(column).toHaveAttribute('inert')
    expect(widget.closest('[inert]')).not.toBeNull()
    expect(dialog.closest('[inert]')).toBeNull()
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(column).not.toHaveAttribute('inert')
    expect(widget.closest('[inert]')).toBeNull()
  })

  it('shuts when a link in it is followed, leaving the focus to the page it opens', () => {
    renderFrame()
    const { button, dialog } = openMenu()
    fireEvent.click(within(dialog).getByRole('link', { name: 'Agents' }))
    expect(host.navigations()).toContainEqual({ method: 'push', href: '/agents' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(button).not.toHaveFocus()
  })

  it('shuts for New chat, which starts a fresh chat', () => {
    host.setPathname('/chat')
    renderFrame()
    const { dialog } = openMenu()
    fireEvent.click(within(dialog).getByRole('button', { name: 'New chat' }))
    expect(host.startedChats()).toBe(1)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('is no landmark or control of the page while it is shut', () => {
    renderFrame()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull()
    expect(screen.getAllByRole('navigation').map((nav) => nav.getAttribute('aria-label'))).toEqual([PLACES_LABEL])
  })
})
