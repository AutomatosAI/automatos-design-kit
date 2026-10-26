// HUD's Conversations page, its route `conversations` (/x/conversations), over the SDK's useConversationList on the
// kit's harness, after Play's test (themes/play/test/conversations/play-conversations.test.tsx, Play 1.1.1): the
// history is what a test sets on the fake host (host.setConversations), loaded on the next tick, failing while the
// backend is down; New chat, the router and the width are the fake host's too. Today, This week and Earlier are HUD
// panels, each a region named by its heading; a row's title, time and newest line, its link (/chat?chatId=<id>), the
// title search and its one status line, the heading and New chat over the search box, the empty, loading and failed
// states, and the page sending the browser to /chat wherever HUD doesn't draw. The route's address is theme.json's.
// Roles, attributes and text only. "Now" is pinned to a local date, so it passes in any time zone. Made-up chats.
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { host } from '@automatos/theme-harness/host'
import { NEW_CHAT } from '../../src/components/new-chat.tsx'
import {
  CONVERSATIONS_TITLE, HudConversations, LIST_FAILED, SEARCH_LABEL, TRY_AGAIN,
} from '../../src/conversations/conversations-screen.tsx'
import { CONVERSATIONS_HREF, CONVERSATIONS_ROUTE } from '../../src/conversations/route.ts'
import { LOADING_LIST, matchLine, NO_CONVERSATIONS, noMatchLine } from '../../src/conversations/status.ts'
import { readThemeJson } from '../support/files.ts'

interface Manifest {
  readonly minWidth: number
  readonly routes?: readonly string[]
  readonly nav?: readonly { readonly id: string; readonly label: string; readonly path: string }[]
}

const NOW = new Date(2026, 9, 14, 15, 30) // Wed 14 Oct 2026, 15:30
/** HUD's minWidth, as theme.json says it: below it the host draws its own pages. */
const MIN_WIDTH = readThemeJson<Manifest>('theme.json').minWidth
/** A window just below HUD's minWidth. */
const BELOW_MIN_WIDTH = MIN_WIDTH - 1
/** The Command design's phone, which HUD draws. */
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
  chat('c-bake', 'Captions for the bake sale', at(12, 10), null),
  chat('c-cafe', 'Cover letter for the café job', at(1, 10), 'I tightened the opening line.'),
]

function renderPage() {
  const user = userEvent.setup()
  render(<HudConversations now={NOW} />)
  return { user }
}

const group = (name: string) => within(screen.getByRole('region', { name }))
const replaced = () => host.navigations().filter((navigation) => navigation.method === 'replace')

beforeEach(() => {
  host.reset()
  host.setConversations(HISTORY)
})

describe('the route', () => {
  it("is theme.json's route, at the address its first nav entry names", () => {
    const manifest = readThemeJson<Manifest>('theme.json')
    expect(manifest.routes).toEqual([CONVERSATIONS_ROUTE])
    expect(CONVERSATIONS_HREF).toBe('/x/conversations')
    expect(manifest.nav?.[0]).toEqual({ id: 'nav-hud-conversations', label: 'Conversations', path: CONVERSATIONS_HREF })
  })
})

describe('the list', () => {
  it('groups the history into Today, This week and Earlier panels under the heading', async () => {
    renderPage()
    expect(screen.getByRole('status')).toHaveTextContent(LOADING_LIST)
    await screen.findByRole('region', { name: 'Today' })
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual(['Today', 'This week', 'Earlier'])
    expect(group('Today').getAllByRole('link')).toHaveLength(1)
    expect(group('This week').getAllByRole('link')).toHaveLength(2)
    expect(group('This week').getByText('2')).toBeInTheDocument()
    expect(group('Earlier').getByRole('link')).toHaveAccessibleName(/Cover letter for the café job/)
    const heading = screen.getByRole('heading', { level: 1, name: CONVERSATIONS_TITLE })
    expect(heading).toHaveAttribute('data-theme-heading', 'true')
  })

  it("shows each conversation's title, relative time and newest line, and opens it in the chat", async () => {
    renderPage()
    const laptop = await screen.findByRole('link', { name: /Laptop for uni/ })
    expect(laptop).toHaveTextContent('2 min')
    expect(laptop).toHaveTextContent('Done! Three laptops make the cut.')
    expect(laptop).toHaveAttribute('href', '/chat?chatId=c-laptop')
    expect(group('This week').getByRole('link', { name: /Revision plan/ })).toHaveTextContent('Yesterday')
    expect(group('This week').getByRole('link', { name: /bake sale/ })).toHaveTextContent('Mon')
    expect(group('Earlier').getByRole('link')).toHaveTextContent('1 Oct')
  })

  it('filters by title as you type, saying the result in one status line under the search box', async () => {
    const { user } = renderPage()
    const status = screen.getByRole('status')
    await screen.findByRole('region', { name: 'Today' })
    const search = screen.getByRole('searchbox', { name: SEARCH_LABEL })
    expect(search.nextElementSibling).toBe(status)
    expect(status).toHaveTextContent(matchLine(4, ''))
    await user.type(search, 'LAPTOP')
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.getByRole('status')).toBe(status)
    expect(status).toHaveTextContent(matchLine(1, 'LAPTOP'))
    await user.clear(search)
    await user.type(search, 'lisbon')
    expect(screen.queryByRole('link')).toBeNull()
    expect(status).toHaveTextContent(noMatchLine('lisbon'))
  })

  it('heads its column with the heading and New chat, over the search box, and New chat starts a chat', async () => {
    const { user } = renderPage()
    await screen.findByRole('region', { name: 'Today' })
    const search = screen.getByRole('searchbox', { name: SEARCH_LABEL })
    const titleRow = search.parentElement?.firstElementChild
    expect(titleRow).toContainElement(screen.getByRole('heading', { level: 1, name: CONVERSATIONS_TITLE }))
    expect(titleRow?.nextElementSibling).toBe(search)
    const newChat = within(titleRow as HTMLElement).getByRole('button', { name: NEW_CHAT })
    await user.click(newChat)
    expect(host.startedChats()).toBe(1)
    expect(host.navigations()).toContainEqual({ method: 'push', href: '/chat' })
  })
})

describe('empty and failed', () => {
  it('says so when there are no conversations yet', async () => {
    host.setConversations([])
    renderPage()
    expect(await screen.findByText(NO_CONVERSATIONS)).toBeInTheDocument()
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('shows a plain error when the history fails, asks again on Try again, and loads once it answers', async () => {
    host.setHealth('down')
    const { user } = renderPage()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(LIST_FAILED)
    await user.click(within(alert).getByRole('button', { name: TRY_AGAIN }))
    expect(host.conversationsAsked()).toHaveLength(2)
    act(() => host.setHealth('connected'))
    expect(await screen.findByRole('link', { name: /Laptop for uni/ })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('only where HUD draws its pages', () => {
  beforeEach(() => host.setMinWidth(MIN_WIDTH))

  it("sends the browser to /chat below HUD's width, showing nothing and asking for nothing", () => {
    host.setWidth(BELOW_MIN_WIDTH)
    renderPage()
    expect(replaced()).toEqual([{ method: 'replace', href: '/chat' }])
    expect(screen.queryByRole('searchbox')).toBeNull()
    expect(host.conversationsAsked()).toEqual([])
  })

  it('while the width is not known, shows nothing, sends nowhere and asks for nothing', () => {
    host.setWidth(null)
    renderPage()
    expect(host.navigations()).toEqual([])
    expect(screen.queryByRole('searchbox')).toBeNull()
    expect(host.conversationsAsked()).toEqual([])
  })

  it('stays put on a desktop', async () => {
    renderPage()
    await screen.findByRole('region', { name: 'Today' })
    expect(replaced()).toEqual([])
  })

  it("stays put on a phone: HUD draws from its minWidth up, the design's 390 px phone among them", async () => {
    expect(PHONE_WIDTH).toBeGreaterThanOrEqual(MIN_WIDTH)
    host.setWidth(PHONE_WIDTH)
    renderPage()
    await screen.findByRole('region', { name: 'Today' })
    expect(replaced()).toEqual([])
  })
})
