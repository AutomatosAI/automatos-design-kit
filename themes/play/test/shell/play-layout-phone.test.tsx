// PRD-260 P260-FX-25 (M69): one width source for Play, the SDK's useThemeLayout. Moved from core's
// components/play/__tests__/play-layout-phone.test.tsx, its Play-owned assertions only, on the kit's harness. Core's
// test ran the host's own switches (MainLayout, the chat and Deliverables layouts, the 404, the look pages) in a
// phone-wide window; below a theme's width the host draws its own pages and never mounts the theme's frame, chat,
// look screens or 404, which is the host's to prove (test/moved-from-core/shell.json names those tests). The one
// Play screen that reads the width itself is Conversations, a theme route the host renders at any width: on a phone
// it sends the browser to /chat without asking for the list or showing Auto, and on the server, where no width is
// known, it renders nothing. A laptop-wide run proves the same spies see Play when it does mount: Play's chat in
// Play's frame opens the linked conversation, holds the board's event lane and asks for Recent. Roles, attributes
// and text only (CSS modules are proxies).
import { render, screen, within } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PlayChat } from '../../src/components/play/chat/play-chat.tsx'
import { PlayConversations } from '../../src/components/play/conversations/play-conversations.tsx'
import { PlayFrameSlot } from '../../src/play-slots.tsx'
import { host } from '@automatos/theme-harness/host'

/** Auto, a spy: none of Play's screens may show him where Play does not mount. */
const mascot = vi.hoisted(() => ({ shown: [] as string[] }))
vi.mock('../../src/components/mascot/auto-mascot.tsx', async () => {
  const { createElement } = await import('react')
  return {
    AutoMascot: ({ state }: { readonly state: string }) => {
      mascot.shown.push(state)
      return createElement('div', { 'data-testid': 'auto', 'data-state': state })
    },
  }
})

/** A phone below Play's minWidth (1024 px), and a laptop above it. */
const PHONE_WIDTH = 390
const LAPTOP_WIDTH = 1440
/** useRecentChats' own limit: the sidebar's Recent. */
const RECENT_LIMIT = 8
const ASKED = 'Which laptop should I take to uni?'
const LINKED = {
  id: 'c1',
  title: 'Laptop for uni',
  updatedAt: '2026-10-14T09:00:00Z',
  preview: 'The Vivobook S 14.',
  messages: [{ role: 'user' as const, text: ASKED }, { role: 'assistant' as const, text: 'The Vivobook S 14.' }],
}

/** Nothing of Play's Conversations ran: no list asked for, no navigation but the one named, no Auto. */
function expectNoConversationsScreen() {
  expect(host.conversationsAsked(), 'Conversations asked for the list').toEqual([])
  expect(mascot.shown, 'Auto shows on a Play screen').toEqual([])
  expect(screen.queryByRole('searchbox')).toBeNull()
}

beforeEach(() => {
  host.reset()
  mascot.shown.length = 0
  host.setConversations([LINKED])
})

describe("below the theme's width (a phone), Play's Conversations never mounts (M69)", () => {
  it('sends the browser to /chat without asking for the list, and Auto never shows', () => {
    host.setWidth(PHONE_WIDTH)
    host.setPathname('/x/conversations')
    render(<PlayConversations />)
    expect(host.navigations()).toEqual([{ method: 'replace', href: '/chat' }])
    expectNoConversationsScreen()
  })
})

describe("on the server, where no width is known, Play's Conversations renders nothing", () => {
  it('sends no markup, goes nowhere and asks for nothing', () => {
    host.setWidth(null)
    expect(renderToString(<PlayConversations />)).toBe('')
    expect(host.navigations()).toEqual([])
    expectNoConversationsScreen()
  })
})

describe("at the theme's width (a laptop), the same spies see Play when it mounts", () => {
  it("Play's chat in Play's frame opens the linked conversation, holds the board's lane and asks for Recent", async () => {
    host.setWidth(LAPTOP_WIDTH)
    host.setPathname('/chat')
    host.setSearchParams('chatId=c1')
    render(
      <PlayFrameSlot fullBleed>
        <PlayChat />
      </PlayFrameSlot>,
    )
    expect(await within(screen.getByRole('main')).findByText(ASKED)).toBeInTheDocument()
    expect(host.boardStreams()).toBe(1)
    expect(host.conversationsAsked()).toContainEqual({ limit: RECENT_LIMIT })
    const recent = await screen.findByRole('region', { name: 'Recent' })
    expect(within(recent).getByRole('link', { name: LINKED.title })).toHaveAttribute('aria-current', 'true')
    expect(mascot.shown).not.toEqual([])
  })
})
