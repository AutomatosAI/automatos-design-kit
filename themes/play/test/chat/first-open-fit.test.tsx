// Play 1.1.1: the first chat screen fits a laptop's window (the real app needed ~1032 css px). An empty chat has no
// page header: "Hi, I'm Auto." is its one h1, and a conversation still has its title. Auto at the large size is at
// most 36% of the window's height (200 to 380 px), the hero is padded 24px above and below, and the message box takes
// the focus as it appears without scrolling the page (focus({ preventScroll: true }), not the autofocus attribute,
// whose scroll into view pushed Auto off the top in Chromium). Roles and text, and the stylesheets' text (css: false).
import { writeThemeState } from '@automatos/theme-sdk'
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HELLO_TITLE } from '../../src/components/play/chat/first-open.tsx'
import { PLACEHOLDER } from '../../src/components/play/chat/message-box.tsx'
import { PlayChat } from '../../src/components/play/chat/play-chat.tsx'
import { HELLO_KEY, HELLO_STATE } from '../../src/lib/mascot/session.ts'
import { host } from '@automatos/theme-harness/host'
import { declaredFor, tokenValue } from '../support/rule-values.ts'

// Auto as his state only: this test is about the page around him.
vi.mock('../../src/components/mascot/auto-mascot.tsx', async () => {
  const { createElement } = await import('react')
  return { AutoMascot: ({ state }: { readonly state: string }) => createElement('div', { 'data-testid': 'auto', 'data-state': state }) }
})

const THEME_CSS = 'app/play-theme.css'
const FIRST_OPEN_CSS = 'components/play/chat/first-open.module.css'
const STORED_TITLE = 'Laptop for uni'

const box = () => screen.getByRole('textbox', { name: PLACEHOLDER })

beforeEach(() => {
  host.reset()
  writeThemeState(HELLO_KEY, true, HELLO_STATE)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('the first chat screen on a laptop (Play 1.1.1)', () => {
  it("draws no page header on an empty chat: 'Hi, I'm Auto.' is the page's one h1", () => {
    render(<PlayChat />)
    const headings = screen.getAllByRole('heading', { level: 1 })
    expect(headings.map((heading) => heading.textContent)).toEqual([HELLO_TITLE])
  })

  it('keeps the page header, the conversation title, once there is a conversation', async () => {
    host.setConversations([
      { id: 'c1', title: STORED_TITLE, updatedAt: '2026-10-14T09:00:00+00:00', preview: null, messages: [{ role: 'user', text: 'Hi' }] },
    ])
    host.setSearchParams('chatId=c1')
    render(<PlayChat />)
    await screen.findByRole('list', { name: 'Conversation' })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(STORED_TITLE)
    expect(screen.queryByRole('heading', { name: HELLO_TITLE })).toBeNull()
  })

  it('focuses the message box as it appears without scrolling the page, and carries no autofocus attribute', () => {
    const focus = vi.spyOn(HTMLElement.prototype, 'focus')
    render(<PlayChat />)
    expect(box()).toHaveFocus()
    expect(box()).not.toHaveAttribute('autofocus')
    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
  })

  it("sizes Auto at the large size to the window's height, 200 to 380 px, and pads the hero 24px above and below", () => {
    expect(tokenValue(THEME_CSS, '--pl-mascot-size-large')).toBe('clamp(200px, 36dvh, 380px)')
    expect(declaredFor(FIRST_OPEN_CSS, '.hero').get('padding')).toBe('var(--pl-space-5) var(--pl-space-6)')
  })
})
