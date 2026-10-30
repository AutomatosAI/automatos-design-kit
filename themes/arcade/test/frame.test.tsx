// Arcade's frame on the harness: on a desktop, the status bar (the wordmark, today's counters from the host's
// activity stats, the pause control, search and the host's utilities) over the pause menu (THEME, HOST PAGES and
// SYSTEM, the page on screen current, the arrow keys moving through it) and the page; below 1024 px the handheld:
// the page in the screen, the D-pad reaching Chat, Quests, Inventory and the menu (which holds the host's utilities),
// and the host's voice button in its surround. The numbers are made up.
import { type ActivityStats } from '@automatos/theme-sdk'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { host } from '@automatos/theme-harness/host'

import { BRAND, DPAD_LABEL, MENU_WORD } from '../src/frame/controls.tsx'
import { Frame } from '../src/frame/frame.tsx'
import { MENU_LABEL } from '../src/frame/pause-menu.tsx'
import { PHONE_MENU_LABEL } from '../src/frame/phone-menu.tsx'
import { SEARCH_LABEL } from '../src/frame/status-bar.tsx'
import { TODAY_LABEL } from '../src/frame/today.tsx'
import { PAUSE_LABEL } from '../src/motion/pause-toggle.tsx'
import { PHONE_WIDTH, resetWindowWidth, setWindowWidth } from './support/window-width.ts'

const STATS: ActivityStats = {
  working_now: 3, channels_live: 0, completed_today: 5, needs_attention: 2, agents_active: 4, tasks_in_queue: 1, period: '1d',
}
const UTILITIES = 'Header utilities'

function renderFrame(path = '/chat') {
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

describe('the desktop frame', () => {
  it("draws the page inside the frame, with the host's utilities and search", () => {
    renderFrame()
    expect(screen.getByText('The page')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: UTILITIES })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: SEARCH_LABEL }))
    expect(host.globalSearchOpens()).toBe(1)
  })

  it("shows today's counters from the host's activity stats, as game words with their numbers", () => {
    renderFrame()
    act(() => host.setPageQuery('useActivityStats', { data: STATS }))
    const today = screen.getByRole('list', { name: TODAY_LABEL })
    expect(within(today).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'XP5done today', '!2need you', 'QUEST3in progress',
    ])
  })

  it('lists THEME, HOST PAGES and SYSTEM, the page on screen current', () => {
    renderFrame('/x/quests')
    const menu = screen.getByRole('navigation', { name: MENU_LABEL })
    expect(within(menu).getByRole('group', { name: 'Theme' })).toBeInTheDocument()
    expect(within(menu).getByRole('group', { name: 'Host pages' })).toBeInTheDocument()
    expect(within(menu).getByRole('link', { name: /Quests/ })).toHaveAttribute('aria-current', 'page')
    expect(within(menu).getByRole('link', { name: /Inventory/ })).toHaveAttribute('href', '/deliverables')
    expect(within(menu).getByRole('link', { name: /Options/ })).toHaveAttribute('href', '/looks')
    expect(within(menu).queryByRole('link', { name: /^▶Deliverables$/ })).toBeNull()
  })

  it('moves the focus through the menu with the arrow keys', () => {
    renderFrame()
    const menu = screen.getByRole('navigation', { name: MENU_LABEL })
    const links = within(menu).getAllByRole('link')
    links[0].focus()
    fireEvent.keyDown(links[0], { key: 'ArrowDown' })
    expect(links[1]).toHaveFocus()
    fireEvent.keyDown(links[1], { key: 'End' })
    expect(links[links.length - 1]).toHaveFocus()
  })

  it('offers to pause the animation, kept per account', () => {
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
})

describe('the handheld', () => {
  beforeEach(() => setWindowWidth(PHONE_WIDTH))

  it('reaches Chat, Quests, Inventory and the menu from the D-pad, the page on screen current', () => {
    renderFrame('/deliverables')
    const pad = screen.getByRole('navigation', { name: DPAD_LABEL })
    expect(within(pad).getByRole('link', { name: /Quests/ })).toHaveAttribute('href', '/x/quests')
    expect(within(pad).getByRole('link', { name: /Chat/ })).toHaveAttribute('href', '/chat')
    expect(within(pad).getByRole('link', { name: /Inventory/ })).toHaveAttribute('aria-current', 'page')
    expect(within(pad).getByRole('button', { name: new RegExp(MENU_WORD) })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('navigation', { name: MENU_LABEL })).toBeNull()
    expect(screen.getByText(BRAND)).toBeInTheDocument()
  })

  it("opens the menu in the screen's place, the host's utilities at its top, and Escape closes it", () => {
    renderFrame()
    fireEvent.click(screen.getByRole('button', { name: new RegExp(MENU_WORD) }))
    const menu = screen.getByRole('navigation', { name: PHONE_MENU_LABEL })
    expect(within(menu).getByRole('group', { name: UTILITIES })).toBeInTheDocument()
    expect(within(menu).getByRole('link', { name: /Sprite gallery/ })).toBeInTheDocument()
    expect(screen.queryByText('The page')).not.toBeVisible()
    fireEvent.keyDown(menu, { key: 'Escape' })
    expect(screen.queryByRole('navigation', { name: PHONE_MENU_LABEL })).toBeNull()
    expect(screen.getByText('The page')).toBeVisible()
  })

  it("places the host's voice button under the screen", () => {
    renderFrame()
    expect(screen.getByRole('button', { name: 'Hold to talk' })).toBeInTheDocument()
  })

  it('keeps the page when the window crosses the width', () => {
    renderFrame()
    const page = screen.getByText('The page')
    act(() => setWindowWidth(1280))
    expect(screen.getByText('The page')).toBe(page)
  })
})
