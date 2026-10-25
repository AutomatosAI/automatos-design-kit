// PRD-260 T-004: Play's frame (frame@1) around a page, as the host draws it under Play at its width. Moved from
// core's components/play/shell/__tests__/play-frame.test.tsx and rewritten for the kit's harness: core's test drew
// the frame through MainLayout, which picks the chrome; here the frame is Play's registration, rendered as the host
// renders it (the page, fullBleed and Auto's widget as props), with the backend up (edges.test.tsx covers the asleep
// screen in its place). Every assertion of what Play's frame draws is kept: Play's sidebar and the page in its main,
// the host's header utilities in its header (the SDK's HeaderUtilities, a stand-in whose clicks the fake host keeps),
// the global search (host.globalSearchOpens()), fullBleed's unwrapped main, the capped wrapper of a framed page, and
// the floating Auto widget the host hands over. Which chrome MainLayout picks (the Studio shell, the fallback below
// the theme's width, nothing while the width isn't known), the utilities' members and the widget's page and
// visibility are the host's; test/moved-from-core/shell.json names those tests. Roles, attributes and text only.
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PlayFrameSlot } from '../../src/play-slots.tsx'
import { host } from '@automatos/theme-harness/host'

// The frame's sidebar has its own test (play-sidebar.test.tsx).
vi.mock('../../src/components/play/shell/play-sidebar.tsx', async () => {
  const { createElement } = await import('react')
  return { PlaySidebar: () => createElement('aside', { 'data-testid': 'play-sidebar' }) }
})

/** The search button's name is what it shows (Play 1.1.1: no aria-label of its own, test/shell/search-button.test.tsx). */
const SEARCH = 'Search ⌘K'
const UTILITIES = 'Header utilities'

function renderFrame(props: { readonly fullBleed?: boolean } = {}) {
  return render(
    <PlayFrameSlot {...props} autoWidget={<div data-testid="auto-widget" />}>
      <div data-testid="page">The page</div>
    </PlayFrameSlot>,
  )
}

beforeEach(() => {
  host.reset()
})

describe("Play's frame at the theme's width", () => {
  it("draws Play's sidebar, the header and the page in its main", () => {
    renderFrame()
    expect(screen.getByTestId('play-sidebar')).toBeInTheDocument()
    expect(within(screen.getByRole('main')).getByTestId('page')).toHaveTextContent('The page')
    expect(screen.getByRole('banner')).toBeInTheDocument()
  })

  it("keeps the host's header utilities in its header: Help, notifications, the theme menu and the account", () => {
    renderFrame()
    const utilities = within(screen.getByRole('banner')).getByRole('group', { name: UTILITIES })
    expect(utilities).toHaveAttribute('data-protected-surface', 'header-utilities')
    fireEvent.click(within(utilities).getByRole('button', { name: 'Notifications' }))
    expect(host.cardActions()).toEqual([{ card: 'header-utilities', id: 'Notifications', action: 'opened' }])
  })

  it('opens the global search from the header', () => {
    renderFrame()
    fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: SEARCH }))
    expect(host.globalSearchOpens()).toBe(1)
  })

  it('fullBleed: the page fills the main column itself, unwrapped', () => {
    renderFrame({ fullBleed: true })
    expect(screen.getByTestId('page').parentElement).toBe(screen.getByRole('main'))
  })

  it('a framed page sits in a capped wrapper inside the scrolling main', () => {
    renderFrame()
    const wrapper = screen.getByTestId('page').parentElement
    expect(wrapper).not.toBe(screen.getByRole('main'))
    expect(wrapper?.parentElement).toBe(screen.getByRole('main'))
  })

  it('draws the floating Auto widget the host hands over, beside the page and outside its main', () => {
    renderFrame()
    const widget = screen.getByTestId('auto-widget')
    expect(screen.getByRole('main')).not.toContainElement(widget)
    expect(screen.getByTestId('play-sidebar').parentElement).toContainElement(widget)
  })
})
