// Candy's frame on the harness: on a desktop, the sidebar (the mark, Auto's card, Candy's pages, the two host pages
// the design keeps in view, More with the rest of the host's menu, Look, Pause motion and the workspace), the host's
// utilities and the page; the look's roundness on the frame's root; the asleep screen while the backend is down.
// Below 1024 px the phone: the top bar with the utilities, the menu sheet, and the floating tab bar with the host's
// voice button (not on the chat, which has its own). The workspace and the looks are made up.
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { host } from '@automatos/theme-harness/host'

import { ASLEEP_TITLE, CHECK_AGAIN } from '../src/edges/asleep.tsx'
import { Frame } from '../src/frame/frame.tsx'
import { cornersOf } from '../src/frame/look-vars.ts'
import { activeMenuId, bandOf, buildMenu, ownsHeader } from '../src/frame/menu.ts'
import { MORE_LABEL } from '../src/frame/menu-list.tsx'
import { MENU_LABEL, MENU_OPEN } from '../src/frame/phone-bar.tsx'
import { AUTO_LINE, SIDEBAR_LABEL } from '../src/frame/sidebar.tsx'
import { TABS_LABEL } from '../src/frame/tab-bar.tsx'
import { DEFAULT_LOOK, PRESETS } from '../src/looks/spec.ts'
import { PAUSE_LABEL } from '../src/motion/pause-toggle.tsx'
import { PHONE_WIDTH, resetWindowWidth, setWindowWidth } from './support/window-width.ts'

const UTILITIES = 'Header utilities'

function renderFrame(path = '/x/today') {
  host.setPathname(path)
  return render(
    <Frame>
      <p>The page</p>
    </Frame>,
  )
}

beforeEach(() => {
  host.reset()
})

afterEach(() => {
  resetWindowWidth()
})

describe('the menu as data', () => {
  const nav = {
    primary: [
      { id: 'chat', label: 'Chat', description: null, href: '/chat', group: 'OPERATIONS', external: false },
      { id: 'cmd', label: 'Command Centre', description: null, href: '/command-center', group: 'OPERATIONS', external: false },
      { id: 'assign', label: 'Assignments', description: null, href: '/assignments', group: 'OPERATIONS', external: false },
      { id: 'deliv', label: 'Deliverables', description: null, href: '/deliverables', group: 'OPERATIONS', external: false },
      { id: 'kb', label: 'Knowledge Base', description: null, href: '/documents', group: 'WORKFORCE', external: false },
    ],
    footer: [{ id: 'docs', label: 'Docs', description: null, href: 'https://docs.example.com', group: null, external: true }],
  }

  it("puts Candy's pages first, then the two host pages the design shows, the rest under More, Look last", () => {
    const menu = buildMenu(nav)
    expect(menu.main.map((item) => item.label)).toEqual(['Today', 'Chat', 'Deliverables', 'Agents', 'Assignments', 'Knowledge Base'])
    expect(menu.more.map((item) => item.label)).toEqual(['Command Centre', 'Docs'])
    expect(menu.look.href).toBe('/looks')
    expect(menu.main.map((item) => item.set)).toEqual([1, 2, 3, 1, 2, 3])
  })

  it('knows which item, band and header a path has', () => {
    expect(activeMenuId('/x/today')).toBe('candy-today')
    expect(activeMenuId('/looks/style')).toBe('candy-look')
    expect(bandOf('/x/today')).toBe('today')
    expect(bandOf('/chat')).toBe('chat')
    expect(bandOf('/assignments')).toBe('page')
    expect(ownsHeader('/deliverables')).toBe(true)
    expect(ownsHeader('/assignments')).toBe(false)
  })

  it('reads the roundness as r and r × 0.72, clamped to the knob', () => {
    expect(cornersOf(28)).toEqual([28, 20])
    expect(cornersOf(40)).toEqual([40, 29])
    expect(cornersOf(99)).toEqual([40, 29])
    expect(cornersOf('round')).toEqual([28, 20])
  })
})

describe('the desktop frame', () => {
  it("draws the page beside the sidebar, with the host's utilities", () => {
    renderFrame()
    expect(screen.getByText('The page')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: UTILITIES })).toBeInTheDocument()
    const sidebar = screen.getByRole('navigation', { name: SIDEBAR_LABEL })
    expect(within(sidebar).getByText(AUTO_LINE)).toBeInTheDocument()
    expect(within(sidebar).getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page')
    expect(within(sidebar).getByRole('link', { name: 'Chat' })).toHaveAttribute('href', '/chat')
    expect(within(sidebar).getByRole('link', { name: 'Agents' })).toHaveAttribute('href', '/x/agents')
    expect(within(sidebar).getByRole('link', { name: 'Look' })).toHaveAttribute('href', '/looks')
  })

  it("opens More with the rest of the host's pages, and opens it by itself on one of them", () => {
    renderFrame()
    const more = screen.getByRole('button', { name: MORE_LABEL })
    expect(more).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(more)
    expect(more).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Command Centre' })).toBeVisible()
  })

  it('moves the focus through the menu with the arrow keys', () => {
    renderFrame()
    const links = within(screen.getByRole('navigation', { name: SIDEBAR_LABEL })).getAllByRole('link')
    links[0].focus()
    fireEvent.keyDown(links[0], { key: 'ArrowDown' })
    expect(links[1]).toHaveFocus()
  })

  it('offers Pause motion, kept per account, and none under reduced motion', () => {
    renderFrame()
    const pause = screen.getByRole('button', { name: PAUSE_LABEL })
    expect(pause).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(pause)
    expect(screen.getByRole('button', { name: PAUSE_LABEL })).toHaveAttribute('aria-pressed', 'true')
  })

  it('has no pause control under reduced motion, since nothing moves', () => {
    host.setReducedMotion(true)
    renderFrame()
    expect(screen.queryByRole('button', { name: PAUSE_LABEL })).toBeNull()
  })

  it("sets the active look's roundness on its root", () => {
    host.setLooks({ look: { ...PRESETS[1] }, defaultLook: DEFAULT_LOOK })
    const { container } = renderFrame()
    const root = container.firstElementChild as HTMLElement
    expect(root.style.getPropertyValue('--candy-r')).toBe('32px')
    expect(root.style.getPropertyValue('--candy-rs')).toBe('23px')
  })

  it('shows the asleep screen while the backend is down, and Check again asks at once', () => {
    renderFrame()
    act(() => host.setHealth('down'))
    expect(screen.getByRole('heading', { name: ASLEEP_TITLE })).toHaveFocus()
    expect(screen.queryByText('The page')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: CHECK_AGAIN }))
    act(() => host.setHealth('connected'))
    expect(screen.getByText('The page')).toBeInTheDocument()
  })
})

describe('the phone', () => {
  beforeEach(() => setWindowWidth(PHONE_WIDTH))

  it("reaches Today, Chat, Shelf and Team from the tab bar, with the host's voice button in the middle", () => {
    renderFrame('/deliverables')
    const tabs = screen.getByRole('navigation', { name: TABS_LABEL })
    expect(within(tabs).getByRole('link', { name: 'Today' })).toHaveAttribute('href', '/x/today')
    expect(within(tabs).getByRole('link', { name: 'Shelf' })).toHaveAttribute('aria-current', 'page')
    expect(within(tabs).getByRole('link', { name: 'Team' })).toHaveAttribute('href', '/x/agents')
    expect(within(tabs).getByRole('button', { name: 'Hold to talk' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: UTILITIES })).toBeInTheDocument()
  })

  it('has no tab bar on the chat, which has its own voice button', () => {
    renderFrame('/chat')
    expect(screen.queryByRole('navigation', { name: TABS_LABEL })).toBeNull()
  })

  it('opens every page in the menu sheet, and Escape closes it', () => {
    renderFrame()
    fireEvent.click(screen.getByRole('button', { name: MENU_OPEN }))
    const menu = screen.getByRole('navigation', { name: MENU_LABEL })
    expect(menu).toHaveFocus()
    expect(within(menu).getByRole('link', { name: 'Look' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: TABS_LABEL })).toBeNull()
    fireEvent.keyDown(menu, { key: 'Escape' })
    expect(screen.queryByRole('navigation', { name: MENU_LABEL })).toBeNull()
    expect(screen.getByText('The page')).toBeVisible()
  })

  it('keeps the page when the window crosses the width', () => {
    renderFrame()
    const page = screen.getByText('The page')
    act(() => setWindowWidth(1280))
    expect(screen.getByText('The page')).toBe(page)
  })
})
