// PRD-260 T-004: Play's sidebar: the nav built from the host's core nav (the SDK's useCoreNav: the Studio menu
// after the host's edition, role and plan filters) with Play's Conversations and Look added; the wordmark; New chat;
// Recent; and the connection pill from the host's health. Moved from core's
// components/play/shell/__tests__/play-sidebar.test.tsx and rewritten for the kit's harness: the edition, the role,
// the path, the conversations and the health are what a test sets on the fake host (host.setEdition, setRole,
// setPathname, setConversations, setHealth); the fake's core nav is core's Studio menu filtered by edition and role,
// and a test hands it another (host.setCoreNav) for the plan's exposure. Every assertion of what Play draws is kept:
// the links in order, the groups with Look alone, the current page, the wordmark, New chat, at most 8 Recent with the
// open one marked on the chat, and the pill's words. How the host filters the nav (an unknown role, the exposure,
// no workspace), what it asks on the wire (getChatHistory's limit, /health with its timeout) and when /health counts
// as down (its retries) are the host's; test/moved-from-core/shell.json names those tests. Roles, attributes and
// text only (CSS modules are proxies).
import { type CoreNav, type CoreNavItem, useChatController } from '@automatos/theme-sdk'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { PlaySidebar } from '../../src/components/play/shell/play-sidebar.tsx'
import { host } from '@automatos/theme-harness/host'

/** The fake core nav's Docs link (an example host: the harness's menu is fake data). */
const DOCS_HREF = 'https://docs.example.com'
/** Every entry Play's nav shows an admin in the hosted edition, in order. */
const SAAS_NAV = [
  '/chat', '/x/conversations', '/command-center', '/assignments', '/deliverables',
  '/agents', '/tools', '/documents', '/marketplace',
  '/team', '/analytics', '/admin/workspaces',
  '/looks',
]
const ELEVEN = [
  'Chat', 'Conversations', 'Command Centre', 'Assignments', 'Deliverables', 'Agent Management',
  'Tools & Integrations', 'Knowledge Base', 'Marketplace', 'Analytics', 'Look',
]
/** How many Recent the sidebar shows: useRecentChats' own limit, which Play does not change. */
const RECENT_LIMIT = 8
const CHATTED = '2026-10-14T09:00:00Z'

function chat(id: string, title: string) {
  return { id, title, updatedAt: CHATTED, preview: null }
}

function navItem(id: string, label: string, href: string, group: string | null, external = false): CoreNavItem {
  return { id, label, description: null, href, group, external }
}

/** The conversation the host's chat has on screen, as its ?chatId= link opens it (the SDK's useChatController). */
function ChatOnScreen() {
  useChatController()
  return null
}

function renderSidebar() {
  return render(<PlaySidebar />)
}

/** Let the lists the host loads on the next tick answer. */
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

function navHrefs(): string[] {
  const main = screen.getByRole('navigation', { name: 'Main' })
  return within(main).getAllByRole('link').map((link) => link.getAttribute('href') ?? '')
}

beforeEach(() => {
  host.reset()
})

describe('Play nav — the core nav, Conversations and Look (hosted edition)', () => {
  beforeEach(() => {
    host.setEdition('saas')
  })

  it('lists every core page for an admin, Conversations after Chat, Look last', () => {
    renderSidebar()
    expect(navHrefs()).toEqual(SAAS_NAV)
    const main = screen.getByRole('navigation', { name: 'Main' })
    for (const label of ELEVEN) expect(within(main).getByRole('link', { name: label })).toBeInTheDocument()
    expect(within(main).getByRole('link', { name: 'Team Management' })).toBeInTheDocument()
    expect(within(main).getByRole('link', { name: 'Workspace Admin' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings')
    expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute('href', DOCS_HREF)
    expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute('target', '_blank')
  })

  it('groups the menu as Studio does, with Look standing alone', () => {
    renderSidebar()
    expect(screen.getAllByRole('group')).toHaveLength(3)
    expect(screen.getByRole('group', { name: 'Operations' })).toContainElement(screen.getByRole('link', { name: 'Conversations' }))
    expect(screen.getByRole('group', { name: 'Workspace' })).not.toContainElement(screen.getByRole('link', { name: 'Look' }))
    expect(screen.getByText('Operations')).toBeInTheDocument()
    expect(screen.getByText('Workforce')).toBeInTheDocument()
    expect(screen.getByText('Workspace')).toBeInTheDocument()
  })

  it('a member sees neither Workspace Admin nor Settings', () => {
    host.setRole({ workspaceRole: 'member', systemRole: 'user', isAdmin: false })
    renderSidebar()
    expect(navHrefs()).toEqual(SAAS_NAV.filter((href) => href !== '/admin/workspaces'))
    expect(screen.queryByRole('link', { name: 'Settings' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Docs' })).toBeInTheDocument()
  })

  it("shows exactly the core nav the host hands it (a plan's exposure turned Team and Analytics off), Play's pages added", () => {
    const coreNav: CoreNav = {
      primary: [
        navItem('chat', 'Chat', '/chat', 'OPERATIONS'),
        navItem('deliv', 'Deliverables', '/deliverables', 'OPERATIONS'),
        navItem('agents', 'Agent Management', '/agents', 'WORKFORCE'),
      ],
      footer: [navItem('docs', 'Docs', DOCS_HREF, null, true)],
    }
    host.setCoreNav(coreNav)
    renderSidebar()
    expect(navHrefs()).toEqual(['/chat', '/x/conversations', '/deliverables', '/agents', '/looks'])
    expect(screen.queryByRole('link', { name: 'Team Management' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Analytics' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Settings' })).toBeNull()
  })
})

describe('Play nav — local edition', () => {
  it("drops Team and Workspace Admin, keeps Analytics, as the host's nav does for the local edition", () => {
    renderSidebar()
    expect(navHrefs()).toEqual(SAAS_NAV.filter((href) => href !== '/team' && href !== '/admin/workspaces'))
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Docs' })).toBeInTheDocument()
  })
})

describe('Play sidebar — the page you are on', () => {
  it.each([
    ['/command-center', 'Command Centre'],
    ['/chat', 'Chat'],
    ['/x/conversations', 'Conversations'],
    ['/looks/style', 'Look'],
    ['/deliverables/explorer', 'Deliverables'],
    ['/settings', 'Settings'],
  ])('%s marks %s as the current page, and only it', (pathname, label) => {
    host.setEdition('saas')
    host.setPathname(pathname)
    renderSidebar()
    const current = screen.getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page')
    expect(current.map((link) => link.textContent)).toEqual([label])
  })
})

describe('Play sidebar — wordmark, New chat, Recent', () => {
  it('the wordmark reads Automatos Play and opens the chat', () => {
    renderSidebar()
    expect(screen.getByRole('link', { name: 'Automatos Play' })).toHaveAttribute('href', '/chat')
  })

  it("New chat starts the host's fresh chat, then opens the chat", () => {
    renderSidebar()
    fireEvent.click(screen.getByRole('button', { name: 'New chat' }))
    expect(host.startedChats()).toBe(1)
    expect(host.navigations()).toContainEqual({ method: 'push', href: '/chat' })
  })

  it('lists at most 8 recent conversations, each opening in the chat', async () => {
    const chats = Array.from({ length: 9 }, (_, index) => chat(`c${index}`, `Chat number ${index}`))
    host.setConversations([...chats, chat('c9', '')])
    renderSidebar()
    const recent = await screen.findByRole('region', { name: 'Recent' })
    const links = within(recent).getAllByRole('link')
    expect(host.conversationsAsked()).toEqual([{ limit: RECENT_LIMIT }])
    expect(links).toHaveLength(RECENT_LIMIT)
    expect(links[0]).toHaveTextContent('Chat number 0')
    expect(links[0]).toHaveAttribute('href', '/chat?chatId=c0')
  })

  it('names an untitled conversation and marks the open one on the chat', async () => {
    host.setPathname('/chat')
    host.setSearchParams('chatId=c2')
    host.setConversations([chat('c1', ''), chat('c2', 'Laptop for uni')])
    render(
      <>
        <ChatOnScreen />
        <PlaySidebar />
      </>,
    )
    const recent = await screen.findByRole('region', { name: 'Recent' })
    expect(within(recent).getByRole('link', { name: 'Conversation' })).toHaveAttribute('href', '/chat?chatId=c1')
    expect(within(recent).getByRole('link', { name: 'Laptop for uni' })).toHaveAttribute('aria-current', 'true')
  })

  it('shows no Recent section while there are no conversations', async () => {
    renderSidebar()
    await waitFor(() => expect(host.conversationsAsked()).toHaveLength(1))
    await settle()
    expect(screen.queryByRole('region', { name: 'Recent' })).toBeNull()
  })
})

describe("Play sidebar — the connection pill (the host's health)", () => {
  it('reads Checking… until the host has an answer, then Connected with the API host', () => {
    host.setHealth('checking')
    renderSidebar()
    const pill = screen.getByRole('status')
    expect(pill).toHaveTextContent('Checking…')
    act(() => host.setHealth('connected', { host: 'localhost' }))
    expect(pill).toHaveTextContent('Connected · localhost')
  })

  it('reads Not running only once the host says the backend is down, never while it is still checking', () => {
    host.setHealth('checking', { checking: true })
    renderSidebar()
    const pill = screen.getByRole('status')
    expect(pill).toHaveTextContent('Checking…')
    act(() => host.setHealth('down'))
    expect(pill).toHaveTextContent('Not running')
  })

  it('stays Connected while a poll is asked again, and reads Not running once the host says down', () => {
    host.setHealth('connected', { host: 'localhost' })
    renderSidebar()
    const pill = screen.getByRole('status')
    expect(pill).toHaveTextContent('Connected · localhost')
    act(() => host.setHealth('connected', { host: 'localhost', checking: true }))
    expect(pill).toHaveTextContent('Connected · localhost')
    act(() => host.setHealth('down', { host: 'localhost' }))
    expect(pill).toHaveTextContent('Not running')
  })
})
