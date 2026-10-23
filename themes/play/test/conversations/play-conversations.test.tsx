// PRD-260 T-006: Play's Conversations page over the SDK's useConversationList. Moved from core's
// components/play/conversations/__tests__/play-conversations.test.tsx and rewritten for the kit's harness: the
// history is what a test sets on the fake host (host.setConversations), loaded on the next tick, failing while the
// backend is down; New chat, the router and the width are the fake host's too (host.startedChats(),
// host.navigations(), host.setWidth). Every assertion of what Play renders is kept: Today, This week and Earlier with a
// fixed now, each row's title, time and newest line, a row's link (/chat?chatId=<id>), the title search and its one
// status line (P260-FX-24, M22), the title and New chat heading the list's column (P260-FX-14), the empty, loading
// and failed states, and the page sending the browser to /chat wherever the host draws its own page or below the
// theme's width, and doing nothing while the width isn't known (P260-FX-25, M69). The history's page size on the
// wire, the failure's log, the backend's rename and New chat's fresh draft are the host's to prove;
// test/moved-from-core/conversations.json names those tests. Roles, attributes and text only (CSS modules are
// proxies). "Now" is pinned to a local date, so it passes in any time zone.
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CONVERSATIONS_TITLE,
  LIST_FAILED,
  LOADING_LIST,
  matchLine,
  NEW_CHAT,
  NO_CONVERSATIONS,
  noMatchLine,
  PlayConversations,
  SEARCH_LABEL,
} from '../../src/components/play/conversations/play-conversations.tsx'
import { host } from '@automatos/theme-harness/host'

// Auto as his state only, as core's test has him.
vi.mock('../../src/components/mascot/auto-mascot.tsx', async () => {
  const { createElement } = await import('react')
  return { AutoMascot: ({ state }: { readonly state: string }) => createElement('div', { 'data-testid': 'auto', 'data-state': state }) }
})

const NOW = new Date(2026, 9, 14, 15, 30) // Wed 14 Oct 2026, 15:30
/** The host's page of the history (hooks/use-conversation-list.ts CONVERSATION_LIMIT): Play asks for no size of its own. */
const HOST_PAGE_SIZE = 50
/** A window below Play's minWidth (1024 px): the host draws its own pages there. */
const PHONE_WIDTH = 390

function at(day: number, hour: number, minute = 0): string {
  return new Date(2026, 9, day, hour, minute).toISOString()
}

function chat(id: string, title: string, updatedAt: string, preview: string | null) {
  return { id, title, updatedAt, preview }
}

const HISTORY = [
  chat('c-laptop', 'Laptop for uni', at(14, 15, 28), 'Done! Three laptops make the cut.'),
  chat('c-chem', 'Revision plan for chemistry', at(13, 18), 'Week 1 covers bonding and moles.'),
  chat('c-bake', 'Instagram captions for the bake sale', at(12, 10), null),
  chat('c-cafe', 'Cover letter for the café job', at(1, 10), 'I tightened the opening line.'),
]

function renderPage() {
  const user = userEvent.setup()
  render(<PlayConversations now={NOW} />)
  return { user }
}

function group(name: string) {
  return within(screen.getByRole('region', { name }))
}

const replaced = () => host.navigations().filter((navigation) => navigation.method === 'replace')

beforeEach(() => {
  host.reset()
  host.setConversations(HISTORY)
})

describe('PlayConversations — the list', () => {
  it('groups the history into Today, This week and Earlier, asked for once at the host page size', async () => {
    renderPage()
    expect(screen.getByRole('status')).toHaveTextContent('Loading your conversations')
    await screen.findByRole('region', { name: 'Today' })

    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual(['Today', 'This week', 'Earlier'])
    expect(group('Today').getAllByRole('link')).toHaveLength(1)
    expect(group('This week').getAllByRole('link')).toHaveLength(2)
    expect(group('Earlier').getByRole('link')).toHaveAccessibleName(/Cover letter for the café job/)
    expect(host.conversationsAsked()).toEqual([{ limit: HOST_PAGE_SIZE }])
    expect(screen.getByRole('heading', { level: 1, name: 'Conversations' })).toBeInTheDocument()
    expect(screen.getByTestId('auto')).toHaveAttribute('data-state', 'idle')
  })

  it("shows each conversation's title, relative time and newest line", async () => {
    renderPage()
    const laptop = await screen.findByRole('link', { name: /Laptop for uni/ })
    expect(laptop).toHaveTextContent('2 min')
    expect(laptop).toHaveTextContent('Done! Three laptops make the cut.')
    expect(laptop).not.toHaveTextContent('Auto:')
    expect(group('This week').getByRole('link', { name: /Revision plan/ })).toHaveTextContent('Yesterday')
    expect(group('This week').getByRole('link', { name: /bake sale/ })).toHaveTextContent('Mon')
    expect(group('Earlier').getByRole('link')).toHaveTextContent('1 Oct')
  })

  it('opens a conversation in the chat by its deep link', async () => {
    renderPage()
    await screen.findByRole('region', { name: 'Today' })
    expect(group('Today').getByRole('link')).toHaveAttribute('href', '/chat?chatId=c-laptop')
    expect(screen.getByRole('link', { name: /café job/ })).toHaveAttribute('href', '/chat?chatId=c-cafe')
  })

  it('filters by title as you type, and says when nothing matches', async () => {
    const { user } = renderPage()
    await screen.findByRole('link', { name: /Laptop for uni/ })
    const search = screen.getByRole('searchbox', { name: 'Search conversations' })

    await user.type(search, 'LAPTOP')
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.getByRole('link', { name: /Laptop for uni/ })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'This week' })).not.toBeInTheDocument()

    await user.clear(search)
    await user.type(search, 'lisbon')
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText(/No conversation titles match “lisbon”/)).toBeInTheDocument()

    await user.clear(search)
    expect(screen.getAllByRole('region')).toHaveLength(3)
  })

  it('says the search result in one status line under the search box: the count, or that nothing matches (P260-FX-24, M22)', async () => {
    const { user } = renderPage()
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(LOADING_LIST)
    await screen.findByRole('region', { name: 'Today' })
    const search = screen.getByRole('searchbox', { name: SEARCH_LABEL })
    // The same paragraph, kept from loading on: a screen reader hears each change to it.
    expect(screen.getByRole('status')).toBe(status)
    expect(search.nextElementSibling).toBe(status)
    expect(status).toHaveTextContent('4 conversations.')

    await user.type(search, 'the')
    expect(screen.getAllByRole('link')).toHaveLength(2)
    expect(screen.getByRole('status')).toBe(status)
    expect(status).toHaveTextContent('2 conversations match “the”.')
    expect(status).toHaveTextContent(matchLine(2, 'the'))

    await user.clear(search)
    await user.type(search, 'laptop')
    expect(status).toHaveTextContent('1 conversation matches “laptop”.')

    await user.clear(search)
    await user.type(search, 'lisbon')
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toBe(status)
    expect(status).toHaveTextContent('No conversation titles match “lisbon”.')
    expect(status).toHaveTextContent(noMatchLine('lisbon'))
  })

  it("heads the list's own column with the title and New chat, over the search box, as in the Play app (P260-FX-14)", async () => {
    renderPage()
    await screen.findByRole('region', { name: 'Today' })
    const search = screen.getByRole('searchbox', { name: SEARCH_LABEL })
    const column = search.parentElement as HTMLElement
    const heading = within(column).getByRole('heading', { level: 1, name: CONVERSATIONS_TITLE })
    const newChat = within(column).getByRole('button', { name: NEW_CHAT })
    const titleRow = column.firstElementChild
    expect(titleRow).toContainElement(heading)
    expect(titleRow).toContainElement(newChat)
    expect(titleRow?.nextElementSibling).toBe(search)
  })

  it("starts a new chat: the host's fresh chat, then the chat", async () => {
    const { user } = renderPage()
    await screen.findByRole('region', { name: 'Today' })
    await user.click(screen.getByRole('button', { name: 'New chat' }))
    expect(host.startedChats()).toBe(1)
    expect(host.navigations()).toContainEqual({ method: 'push', href: '/chat' })
  })
})

describe('PlayConversations — empty and failed', () => {
  it('says so when there are no conversations yet', async () => {
    host.setConversations([])
    renderPage()
    expect(await screen.findByText(NO_CONVERSATIONS)).toBeInTheDocument()
    expect(screen.getByText(/No conversations yet/)).toBeInTheDocument()
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })

  it('shows a clear error with no internals when the history fails, asks again on Try again, and loads once it answers', async () => {
    host.setHealth('down')
    const { user } = renderPage()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(LIST_FAILED)
    expect(alert).not.toHaveTextContent(/502|10\.0\.0\.7|upstream|Failed to fetch/)

    await user.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(host.conversationsAsked()).toHaveLength(2)
    expect(await screen.findByRole('alert')).toHaveTextContent(LIST_FAILED)
    act(() => host.setHealth('connected'))
    expect(await screen.findByRole('link', { name: /Laptop for uni/ })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('PlayConversations — only where Play draws its pages', () => {
  it('sends the browser to /chat where the host draws its own page (no theme at its width), showing nothing', () => {
    host.setMinWidth(null)
    renderPage()
    expect(replaced()).toEqual([{ method: 'replace', href: '/chat' }])
    expect(screen.queryByRole('heading', { name: 'Conversations' })).not.toBeInTheDocument()
    expect(host.conversationsAsked()).toEqual([])
  })

  it("sends the browser to /chat below the theme's width (1024 px), where Play pages do not render (D7)", () => {
    host.setWidth(PHONE_WIDTH)
    renderPage()
    expect(replaced()).toEqual([{ method: 'replace', href: '/chat' }])
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
  })

  it('while the width is not known, shows nothing, sends nowhere and asks for nothing (M69)', () => {
    host.setWidth(null)
    renderPage()
    expect(host.navigations()).toEqual([])
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
    expect(host.conversationsAsked()).toEqual([])
  })

  it('stays put under Play on a desktop', async () => {
    renderPage()
    await screen.findByRole('region', { name: 'Today' })
    expect(replaced()).toEqual([])
  })
})
