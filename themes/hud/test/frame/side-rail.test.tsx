// HUD's side rail: the core nav (the SDK's useCoreNav: the Studio menu after its edition, role and plan filters) in
// its groups and order with HUD's Conversations after Chat, the current page marked by aria-current as well as by
// colour, RECENT's latest conversations under the nav, Docs and Settings at the foot, and every link the SDK's
// HostLink. buildRailNav is pure; the rail is drawn on the kit's harness. Every chat is made up.
import type { CoreNav } from '@automatos/theme-sdk'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { host } from '@automatos/theme-harness/host'
import { buildRailNav, CONVERSATIONS_ITEM, resolveRailActiveId } from '../../src/frame/rail-nav.ts'
import { HudChatPage } from '../../src/chat/hud-chat.tsx'
import { RECENT_LABEL, RECENT_SHOWN, SideRail } from '../../src/frame/side-rail.tsx'

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
  it("keeps the menu's groups in its own order, each item under its group, HUD's Conversations after Chat, and the rest at the foot", () => {
    const nav = buildRailNav(NAV)
    expect(nav.groups.map((group) => [group.label, group.items.map((item) => item.id)])).toEqual([
      ['OPERATIONS', ['chat', 'conversations', 'deliv']],
      ['WORKFORCE', ['agents']],
    ])
    expect(nav.footer.map((item) => item.id)).toEqual(['loose', 'docs'])
  })

  it('names Conversations at its theme route, and resolves that route to it', () => {
    expect(CONVERSATIONS_ITEM).toEqual({ id: 'conversations', label: 'Conversations', href: '/x/conversations', external: false })
    expect(resolveRailActiveId('/x/conversations')).toBe('conversations')
    expect(resolveRailActiveId('/chat')).toBe('chat')
  })
})

describe('the rail', () => {
  it("draws every core page in its group, and HUD's Conversations after Chat, under the Main nav", () => {
    host.setCoreNav(NAV)
    render(<SideRail />)
    const nav = screen.getByRole('navigation', { name: 'Main' })
    const operations = within(nav).getByRole('group', { name: 'OPERATIONS' })
    expect(within(operations).getAllByRole('link').map((link) => link.textContent)).toEqual(['Chat', 'Conversations', 'Deliverables'])
    expect(within(operations).getByRole('link', { name: 'Conversations' })).toHaveAttribute('href', '/x/conversations')
    expect(within(nav).getByRole('group', { name: 'WORKFORCE' })).toBeInTheDocument()
  })

  it('marks Conversations current on its page', () => {
    host.setPathname('/x/conversations')
    render(<SideRail />)
    const nav = screen.getByRole('navigation', { name: 'Main' })
    const current = within(nav).getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page')
    expect(current.map((link) => link.textContent)).toEqual(['Conversations'])
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

describe('RECENT', () => {
  const UPDATED = '2026-10-14T09:00:00+00:00'
  const chats = Array.from({ length: RECENT_SHOWN + 2 }, (_, index) => ({
    id: `c${index + 1}`, title: index === 1 ? '  ' : `Chat number ${index + 1}`, updatedAt: UPDATED, preview: null,
  }))
  const recent = () => within(screen.getByRole('group', { name: RECENT_LABEL }))

  it('lists the latest conversations under the nav, each opening in the chat, an untitled one as New chat', async () => {
    host.setConversations(chats)
    render(<SideRail />)
    await waitFor(() => expect(recent().getAllByRole('link')).toHaveLength(RECENT_SHOWN))
    expect(host.conversationsAsked()).toContainEqual({ limit: RECENT_SHOWN })
    const links = recent().getAllByRole('link')
    expect(links[0]).toHaveTextContent('Chat number 1')
    expect(links[0]).toHaveAttribute('href', '/chat?chatId=c1')
    expect(links[1]).toHaveTextContent('New chat')
  })

  it('marks the conversation the chat shows', async () => {
    host.setConversations(chats)
    host.setPathname('/chat')
    host.setSearchParams('chatId=c3')
    render(<><SideRail /><HudChatPage /></>)
    await waitFor(() => expect(recent().getByRole('link', { name: 'Chat number 3' })).toHaveAttribute('aria-current', 'page'))
    expect(recent().getAllByRole('link').filter((link) => link.hasAttribute('aria-current'))).toHaveLength(1)
  })

  it('is not drawn until there is a conversation', async () => {
    render(<SideRail />)
    await waitFor(() => expect(host.conversationsAsked().length).toBeGreaterThan(0))
    expect(screen.queryByRole('group', { name: RECENT_LABEL })).toBeNull()
  })
})
