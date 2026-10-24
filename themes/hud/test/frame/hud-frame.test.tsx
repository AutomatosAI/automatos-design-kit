// HUD's frame (frame@1) around a page, rendered on the kit's harness as the host renders it: the page, fullBleed and
// Auto's widget as props, the look runtime holding each of HUD's five presets in turn. Under every preset it draws
// the AUTOMATOS // HUD top bar with the host's utilities, search and LOOK, the side rail from the core nav, the
// backdrop, the page in its main and the widget beside it; Auto's dock shows exactly while the preset's auto is on,
// and steps aside on HUD's core screen (/chat), whose voice core shows him, but not on the host's own chat there.
// Roles, names and attributes only: the colours are the host's painted variables, which jsdom never paints.
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { captionFor } from '@automatos/mascot/media'
import { host } from '@automatos/theme-harness/host'
import { ARC, PRESETS } from '../../src/lib/looks/presets.ts'
import type { HudLook } from '../../src/lib/looks/types.ts'
import { HudFrameSlot } from '../../src/slots/frame.tsx'

const PAGE_TEXT = 'The page the host hands the frame'
const BRAND = 'Automatos HUD'
const SEARCH = 'Open search (⌘K)'
const UTILITIES = 'Header utilities'
const IDLE = captionFor('idle')

function renderFrame(props: { readonly fullBleed?: boolean } = {}) {
  return render(
    <HudFrameSlot {...props} autoWidget={<div data-testid="auto-widget" />}>
      <p data-testid="page">{PAGE_TEXT}</p>
    </HudFrameSlot>,
  )
}

function lookUp(look: HudLook): void {
  host.setLooks({ look })
}

beforeEach(() => {
  host.reset()
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
})

describe.each(PRESETS.map((look): [string, HudLook] => [look.id, look]))('the frame under %s', (_id, look) => {
  beforeEach(() => lookUp(look))

  it('draws the top bar, the rail, the backdrop and the page in its main, carrying the look', () => {
    const { container } = renderFrame()
    const bar = screen.getByRole('banner')
    expect(within(bar).getByRole('link', { name: BRAND })).toHaveAttribute('href', '/chat')
    expect(screen.getByRole('complementary', { name: 'Sidebar' })).toBeInTheDocument()
    expect(within(screen.getByRole('main')).getByTestId('page')).toHaveTextContent(PAGE_TEXT)
    expect(screen.getByTestId('hud-backdrop')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByTestId('hud-scan')).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('[data-look]')).toHaveAttribute('data-look', look.id)
  })

  it(`shows Auto's dock ${look.auto === 'on' ? 'with' : 'without'} Auto, as the look's auto knob says`, () => {
    renderFrame()
    const rail = screen.getByRole('complementary', { name: 'Sidebar' })
    const auto = within(rail).queryByRole('img', { name: IDLE })
    if (look.auto === 'on') {
      expect(auto).toBeInTheDocument()
      expect(within(rail).getByRole('heading', { name: 'Auto' })).toBeInTheDocument()
    } else {
      expect(auto).toBeNull()
      expect(within(rail).queryByRole('heading', { name: 'Auto' })).toBeNull()
    }
  })
})

describe("Auto's dock on the chat", () => {
  const dockIn = (): HTMLElement | null =>
    within(screen.getByRole('complementary', { name: 'Sidebar' })).queryByRole('heading', { name: 'Auto' })

  beforeEach(() => lookUp(ARC))

  it("steps aside on HUD's core screen, which shows Auto in its voice core", () => {
    host.setPathname('/chat')
    host.setSearchParams('chatId=c-1')
    renderFrame({ fullBleed: true })
    expect(dockIn()).toBeNull()
  })

  it('stays where the host draws its own chat at /chat (a keepCorePage link), and on every other page', () => {
    host.setPathname('/chat')
    host.setSearchParams('repo=r-1')
    const { unmount } = renderFrame({ fullBleed: true })
    expect(dockIn()).toBeInTheDocument()
    unmount()
    host.setPathname('/looks')
    host.setSearchParams('')
    renderFrame()
    expect(dockIn()).toBeInTheDocument()
  })
})

describe('the top bar', () => {
  it("keeps the host's header utilities in it, untouched", () => {
    renderFrame()
    const utilities = within(screen.getByRole('banner')).getByRole('group', { name: UTILITIES })
    expect(utilities).toHaveAttribute('data-protected-surface', 'header-utilities')
    fireEvent.click(within(utilities).getByRole('button', { name: 'Notifications' }))
    expect(host.cardActions()).toEqual([{ card: 'header-utilities', id: 'Notifications', action: 'opened' }])
  })

  it("opens the host's search", () => {
    renderFrame()
    fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: SEARCH }))
    expect(host.globalSearchOpens()).toBe(1)
  })

  it('links LOOK to the look editor, current while it is open', () => {
    host.setPathname('/looks/style')
    renderFrame()
    expect(within(screen.getByRole('banner')).getByRole('link', { name: 'Look' })).toHaveAttribute('aria-current', 'page')
  })

  it("says where Automatos runs and whether it answers, in words", () => {
    host.setHealth('down')
    renderFrame()
    expect(within(screen.getByRole('banner')).getByRole('status')).toHaveTextContent('Local · offline')
  })

  it('shows the time', () => {
    const { container } = renderFrame()
    expect(container.querySelector('time')?.getAttribute('dateTime')).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  })
})

describe('the page', () => {
  it('fullBleed: the page fills the main itself, unwrapped', () => {
    renderFrame({ fullBleed: true })
    expect(screen.getByTestId('page').parentElement).toBe(screen.getByRole('main'))
  })

  it('a framed page sits in a capped wrapper inside the scrolling main', () => {
    renderFrame()
    const wrapper = screen.getByTestId('page').parentElement
    expect(wrapper).not.toBe(screen.getByRole('main'))
    expect(wrapper?.parentElement).toBe(screen.getByRole('main'))
  })

  it("draws the host's floating Auto widget beside the page, outside its main", () => {
    renderFrame()
    expect(screen.getByRole('main')).not.toContainElement(screen.getByTestId('auto-widget'))
  })

  it('outside a look runtime it is the default look, ARC', () => {
    const { container } = renderFrame()
    expect(container.querySelector('[data-look]')).toHaveAttribute('data-look', 'arc')
  })
})
