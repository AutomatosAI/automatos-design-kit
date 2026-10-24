// HUD's side rail: the core nav (the SDK's useCoreNav: the Studio menu after its edition, role and plan filters) in
// its groups and order, the current page marked by aria-current as well as by colour, Docs and Settings at the foot,
// and every link the SDK's HostLink. buildRailNav is pure; the rail is drawn on the kit's harness.
import type { CoreNav } from '@automatos/theme-sdk'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { host } from '@automatos/theme-harness/host'
import { buildRailNav } from '../../src/frame/rail-nav.ts'
import { SideRail } from '../../src/frame/side-rail.tsx'

const NAV: CoreNav = {
  primary: [
    { id: 'chat', label: 'Chat', description: null, href: '/chat', group: 'OPERATIONS', external: false },
    { id: 'agents', label: 'Agents', description: null, href: '/agents', group: 'WORKFORCE', external: false },
    { id: 'deliv', label: 'Deliverables', description: null, href: '/deliverables', group: 'OPERATIONS', external: false },
    { id: 'loose', label: 'Loose', description: null, href: '/loose', group: null, external: false },
  ],
  footer: [{ id: 'docs', label: 'Docs', description: null, href: 'https://docs.example.com', group: null, external: true }],
}

beforeEach(() => {
  host.reset()
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
})

describe('buildRailNav', () => {
  it("keeps the menu's groups in its own order, each item under its group, and the rest at the foot", () => {
    const nav = buildRailNav(NAV)
    expect(nav.groups.map((group) => [group.label, group.items.map((item) => item.id)])).toEqual([
      ['OPERATIONS', ['chat', 'deliv']],
      ['WORKFORCE', ['agents']],
    ])
    expect(nav.footer.map((item) => item.id)).toEqual(['loose', 'docs'])
  })
})

describe('the rail', () => {
  it('draws every core page in its group, under the Main nav', () => {
    host.setCoreNav(NAV)
    render(<SideRail />)
    const nav = screen.getByRole('navigation', { name: 'Main' })
    const operations = within(nav).getByRole('group', { name: 'OPERATIONS' })
    expect(within(operations).getAllByRole('link').map((link) => link.textContent)).toEqual(['Chat', 'Deliverables'])
    expect(within(nav).getByRole('group', { name: 'WORKFORCE' })).toBeInTheDocument()
  })

  it('marks the current page with aria-current, and only it', () => {
    host.setPathname('/deliverables')
    render(<SideRail />)
    const nav = screen.getByRole('navigation', { name: 'Main' })
    const current = within(nav).getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page')
    expect(current.map((link) => link.textContent)).toEqual(['Deliverables'])
  })

  it('moves the host router on a plain click, and opens Docs in a new tab', () => {
    host.setCoreNav(NAV)
    render(<SideRail />)
    fireEvent.click(screen.getByRole('link', { name: 'Agents' }))
    expect(host.navigations()).toEqual([{ method: 'push', href: '/agents' }])
    const docs = within(screen.getByRole('list', { name: 'More' })).getByRole('link', { name: 'Docs' })
    expect(docs).toHaveAttribute('target', '_blank')
  })

  it("follows the host's filters: the hosted edition's admin pages only for an admin", () => {
    host.setEdition('saas')
    host.setRole({ systemRole: 'user', isAdmin: false })
    render(<SideRail />)
    expect(screen.getByRole('link', { name: 'Team Management' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Workspace Admin' })).toBeNull()
  })
})
