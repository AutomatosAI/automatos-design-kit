/**
 * PRD-264 EUAI-09 (Art. 50(2)) — Auto's reply in Play's chat is marked machine-readable
 * as AI-generated: its root carries `data-ai-generated="true"`, while it streams and once
 * it is done, as the core chat's MessageWithReceipts does. The core's cards and the
 * markdown renderer are stand-ins; the reply itself is real.
 *
 * Moved from core's components/play/chat/__tests__/auto-reply-ai-generated.test.tsx (at 101a0bf33) as it is:
 * only the paths of the two stand-ins and of the reply follow the kit's layout (src/components/play/chat/).
 */
import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { HostChatMessage } from '@automatos/theme-sdk'

vi.mock('../../src/components/play/chat/play-markdown.tsx', () => ({
  PlayMarkdown: ({ text }: { text: string }) => <div data-testid="the-answer">{text}</div>,
}))
vi.mock('../../src/components/play/chat/reply-cards.tsx', () => ({ ReplyCards: () => null }))

import { AutoReply, SPEAKER } from '../../src/components/play/chat/auto-reply.tsx'

afterEach(cleanup)

const reply: HostChatMessage = {
  id: 'a1',
  role: 'assistant',
  text: 'Done.',
  activity: [],
  error: null,
  writing: false,
  stopped: false,
  receipts: null,
  above: [],
  deliverables: [],
  approvals: [],
  taskCards: [],
  toolCalls: [],
  provenance: null,
  savedError: null,
  limitReached: null,
  reasoningChars: 0,
  linkedDeliverables: [],
} as unknown as HostChatMessage

describe("Auto's reply in Play is marked AI-generated", () => {
  it('carries data-ai-generated="true" on the reply that holds the answer', () => {
    render(<AutoReply message={reply} streaming={false} />)
    const holder = screen.getByRole('article', { name: `${SPEAKER} said` })
    expect(holder).toHaveAttribute('data-ai-generated', 'true')
    expect(holder).toContainElement(screen.getByTestId('the-answer'))
  })

  it('carries it while the reply still streams', () => {
    render(<AutoReply message={{ ...reply, text: '' }} streaming />)
    expect(screen.getByRole('article', { name: `${SPEAKER} said` })).toHaveAttribute('data-ai-generated', 'true')
  })
})
