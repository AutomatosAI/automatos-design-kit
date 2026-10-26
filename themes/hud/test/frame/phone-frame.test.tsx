// HUD's frame on a phone, on the kit's harness. Below the desktop width (src/lib/phone-layout.ts: core's 1024 px, read
// through matchMedia, which test/support/window-width.ts stands in for, jsdom having none) it draws the design's phone
// bar (MENU, the brand, the status), no rail, and the page in the whole width. MENU opens the menu: a modal dialog with
// New chat, search, LOOK, the rail's pages and the host's header utilities, which takes the focus, keeps Tab inside it,
// and shuts on Esc, Close or the glass with the focus back on MENU, or on a link followed; the bar and the page are
// inert behind it. From 1024 px up, and wherever nothing says the width, the frame is the desktop's, and a window
// crossing the width keeps the page. Roles, names and attributes only.
import type { CoreNav } from '@automatos/theme-sdk'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { KeyboardEvent } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { host } from '@automatos/theme-harness/host'
import { focusables, trapKey } from '../../src/frame/focus-trap.ts'
import { CLOSE_LABEL, DRAWER_LABEL } from '../../src/frame/nav-drawer.tsx'
import { MENU_LABEL } from '../../src/frame/phone-top-bar.tsx'
import { DESKTOP_MIN_WIDTH, PHONE_QUERY } from '../../src/lib/phone-layout.ts'
import { HudFrameSlot } from '../../src/slots/frame.tsx'
import { DESKTOP_WIDTH, PHONE_WIDTH, resetWindowWidth, setWindowWidth } from '../support/window-width.ts'

const TOP_BAR = 'Top bar'
const BRAND = 'Automatos HUD'
const SIDEBAR = 'Sidebar'
const UTILITIES = 'Header utilities'
const SEARCH = /^Search\s*⌘K$/
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
    <HudFrameSlot fullBleed={fullBleed} autoWidget={widget ? <button type="button" data-testid="auto-widget">Auto</button> : undefined}>
      <p data-testid="page">{PAGE_TEXT}</p>
    </HudFrameSlot>,
  )
}

const layoutOf = (container: HTMLElement): string | null => container.querySelector('[data-layout]')?.getAttribute('data-layout') ?? null
const bar = (): HTMLElement => screen.getByRole('banner', { name: TOP_BAR })
const menuButton = (): HTMLElement => within(bar()).getByRole('button', { name: MENU_LABEL })
const menu = (): HTMLElement => screen.getByRole('dialog', { name: DRAWER_LABEL })
const utilities = (): HTMLElement | null => document.querySelector<HTMLElement>('[data-protected-surface="header-utilities"]')
/** The bar's connection status: a status with its connection named (MIC LIVE's status beside it says none). */
const connection = (): HTMLElement | undefined =>
  within(bar()).getAllByRole('status').find((status) => status.hasAttribute('data-connection'))

/** The phone frame with its menu open; MENU, found before the bar goes inert. */
function openMenu(): { readonly button: HTMLElement; readonly dialog: HTMLElement } {
  const button = menuButton()
  fireEvent.click(button)
  return { button, dialog: menu() }
}

beforeEach(() => {
  host.reset()
  host.setCoreNav(NAV)
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
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
    expect(within(bar()).getByRole('button', { name: SEARCH })).toBeInTheDocument()
    expect(within(bar()).getByRole('group', { name: UTILITIES })).toBeInTheDocument()
    expect(within(bar()).queryByRole('button', { name: MENU_LABEL })).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('the phone frame', () => {
  beforeEach(() => setWindowWidth(PHONE_WIDTH))

  it("draws the design's phone bar, MENU, the brand and the status in words, and no rail", () => {
    renderFrame()
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false')
    expect(menuButton()).toHaveAttribute('aria-haspopup', 'dialog')
    expect(within(bar()).getByRole('link', { name: BRAND })).toHaveAttribute('href', '/chat')
    expect(connection()).toHaveTextContent(/^● ?online$/)
    expect(screen.queryByRole('complementary', { name: SIDEBAR })).toBeNull()
    expect(screen.queryByRole('group', { name: UTILITIES })).toBeNull()
    expect(screen.queryByRole('button', { name: SEARCH })).toBeNull()
  })

  it('says the backend is down in words', () => {
    host.setHealth('down')
    renderFrame()
    expect(connection()).toHaveTextContent('offline')
  })

  it('gives a page the whole width: its main alone in the body, no rail beside it, framed or full bleed', () => {
    const framed = renderFrame()
    expect(screen.getByRole('main').parentElement?.children).toHaveLength(1)
    expect(within(screen.getByRole('main')).getByTestId('page')).toHaveTextContent(PAGE_TEXT)
    framed.unmount()
    renderFrame({ fullBleed: true })
    expect(screen.getByTestId('page').parentElement).toBe(screen.getByRole('main'))
    expect(screen.getByRole('main').parentElement?.children).toHaveLength(1)
  })
})

describe('the menu', () => {
  beforeEach(() => setWindowWidth(PHONE_WIDTH))

  it('opens from MENU as a modal dialog that takes the focus, its Close button first', () => {
    renderFrame()
    const { button, dialog } = openMenu()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(button.getAttribute('aria-controls')).toBe(dialog.id)
    expect(within(dialog).getByRole('button', { name: CLOSE_LABEL })).toHaveFocus()
  })

  it("holds the rail's pages with Conversations after Chat, Docs and Settings, New chat, search and LOOK", () => {
    renderFrame()
    const { dialog } = openMenu()
    const nav = within(dialog).getByRole('navigation', { name: 'Main' })
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(['Chat', 'Conversations', 'Agents'])
    expect(within(nav).getByRole('link', { name: 'Conversations' })).toHaveAttribute('href', '/x/conversations')
    const more = within(dialog).getByRole('list', { name: 'More' })
    expect(within(more).getAllByRole('link').map((link) => link.textContent?.replace('↗', '').trim())).toEqual(['Docs', 'Settings'])
    expect(within(dialog).getByRole('link', { name: 'Look' })).toHaveAttribute('href', '/looks')
    expect(within(dialog).getByRole('button', { name: 'New chat' })).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: SEARCH }))
    expect(host.globalSearchOpens()).toBe(1)
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

  it('keeps Tab inside it: its last control to its first, Shift+Tab its first to its last, the rest the browser\'s', () => {
    renderFrame()
    const { dialog } = openMenu()
    const controls = focusables(dialog)
    const [first, second] = controls
    const last = controls[controls.length - 1]
    expect(first).toHaveAccessibleName(CLOSE_LABEL)
    expect(dialog).toContainElement(utilities())
    expect(utilities()).toContainElement(last)
    last.focus()
    fireEvent.keyDown(last, { key: 'Tab' })
    expect(first).toHaveFocus()
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })
    expect(last).toHaveFocus()
    second.focus()
    expect(fireEvent.keyDown(second, { key: 'Tab' })).toBe(true)
    expect(second).toHaveFocus()
  })

  it('shuts on Esc, on Close and on the glass, each time giving the focus back to MENU', () => {
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
    const body = screen.getByRole('main').parentElement
    const widget = screen.getByTestId('auto-widget')
    expect(widget.closest('[inert]')).toBeNull()
    const { button, dialog } = openMenu()
    expect(button.closest('header')).toHaveAttribute('inert')
    expect(body).toHaveAttribute('inert')
    expect(widget.closest('[inert]')).not.toBeNull()
    expect(dialog.closest('[inert]')).toBeNull()
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(button.closest('header')).not.toHaveAttribute('inert')
    expect(body).not.toHaveAttribute('inert')
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

  it('shuts for New chat, which starts a fresh chat, on the chat itself too', () => {
    host.setPathname('/chat')
    renderFrame()
    const { dialog } = openMenu()
    fireEvent.click(within(dialog).getByRole('button', { name: 'New chat' }))
    expect(host.startedChats()).toBe(1)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('leaves alone a key pressed outside its own elements, such as in a host menu drawn elsewhere in the page', () => {
    const container = document.createElement('div')
    const outside = document.createElement('button')
    document.body.append(container, outside)
    const onEscape = vi.fn()
    const preventDefault = vi.fn()
    const event = { target: outside, key: 'Escape', shiftKey: false, preventDefault } as unknown as KeyboardEvent<HTMLElement>
    trapKey(event, container, onEscape)
    expect(onEscape).not.toHaveBeenCalled()
    expect(preventDefault).not.toHaveBeenCalled()
    container.remove()
    outside.remove()
  })
})
