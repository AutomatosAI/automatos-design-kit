// Play 1.1.1: Conversations with none yet, the empty shelf's pattern. No mascot column: Auto stands in the middle of
// the list's column at his regular size, the empty message his caption, then Start a chat. The one status line under
// the search box still says it, to screen readers only, since his caption shows it (P260-FX-24, M22). Auto is a
// stand-in showing his state, size and caption; the block's layout is the stylesheet's text (css: false).
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AutoMascotProps } from '../../src/components/mascot/auto-mascot.tsx'
import {
  NO_CONVERSATIONS, PlayConversations, SEARCH_LABEL, START_A_CHAT,
} from '../../src/components/play/conversations/play-conversations.tsx'
import { host } from '@automatos/theme-harness/host'
import { declaredFor } from '../support/rule-values.ts'

vi.mock('../../src/components/mascot/auto-mascot.tsx', async () => {
  const { createElement } = await import('react')
  return {
    AutoMascot: ({ state, caption, size = 'regular' }: Pick<AutoMascotProps, 'state' | 'caption' | 'size'>) =>
      createElement('div', { 'data-testid': 'auto', 'data-state': state, 'data-size': size }, caption),
  }
})

const NOW = new Date(2026, 9, 14, 15, 30)
const CONVERSATIONS_CSS = 'components/play/conversations/conversations.module.css'

beforeEach(() => {
  host.reset()
  host.setConversations([])
})

describe('Conversations with none yet (Play 1.1.1)', () => {
  it("has no mascot column: one regular Auto in the list's column, the message his caption, then Start a chat", async () => {
    render(<PlayConversations now={NOW} />)
    const start = await screen.findByRole('button', { name: START_A_CHAT })
    expect(screen.queryByRole('complementary', { name: 'Auto' })).toBeNull()
    const autos = screen.getAllByTestId('auto')
    expect(autos).toHaveLength(1)
    const [auto] = autos
    expect(auto).toHaveAttribute('data-size', 'regular')
    expect(auto).toHaveTextContent(NO_CONVERSATIONS)
    expect(auto.parentElement).toBe(start.parentElement)
    const column = screen.getByRole('searchbox', { name: SEARCH_LABEL }).parentElement as HTMLElement
    expect(column).toContainElement(auto)
  })

  it('says it in the one status line to screen readers only, and Start a chat starts one', async () => {
    const user = userEvent.setup()
    render(<PlayConversations now={NOW} />)
    await user.click(await screen.findByRole('button', { name: START_A_CHAT }))
    expect(screen.getByRole('status')).toHaveTextContent(NO_CONVERSATIONS)
    expect(screen.getByRole('status')).toHaveClass('sr-only')
    expect(host.startedChats()).toBe(1)
  })

  it('keeps Auto in the mascot column once there is a conversation', async () => {
    host.setConversations([{ id: 'c1', title: 'Laptop for uni', updatedAt: '2026-10-14T15:28:00Z', preview: null }])
    render(<PlayConversations now={NOW} />)
    await screen.findByRole('link', { name: /Laptop for uni/ })
    expect(screen.getByRole('complementary', { name: 'Auto' })).toContainElement(screen.getByTestId('auto'))
    expect(screen.queryByRole('button', { name: START_A_CHAT })).toBeNull()
  })

  it('lays the empty block out centred', () => {
    const empty = declaredFor(CONVERSATIONS_CSS, '.empty')
    expect([empty.get('align-items'), empty.get('text-align')]).toEqual(['center', 'center'])
  })
})
