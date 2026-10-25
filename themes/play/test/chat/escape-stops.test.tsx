// Play 1.1.1: Esc in the message box stops a reply Auto is writing, as Stop does and as HUD's composer does. Esc does
// nothing while he is not answering, and nothing during an IME composition (where it cancels the composition).
// Through the whole chat it is the same stop as the Stop button: the turn ends, the words so far are kept, Send is back.
import { writeThemeState } from '@automatos/theme-sdk'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { STOPPED_NOTICE } from '../../src/components/play/chat/auto-reply.tsx'
import { MessageBox, PLACEHOLDER } from '../../src/components/play/chat/message-box.tsx'
import { PlayChat } from '../../src/components/play/chat/play-chat.tsx'
import { HELLO_KEY, HELLO_STATE } from '../../src/lib/mascot/session.ts'
import { host } from '@automatos/theme-harness/host'

vi.mock('../../src/components/mascot/auto-mascot.tsx', async () => {
  const { createElement } = await import('react')
  return { AutoMascot: ({ state }: { readonly state: string }) => createElement('div', { 'data-testid': 'auto', 'data-state': state }) }
})

const box = () => screen.getByRole('textbox', { name: PLACEHOLDER })

function renderBox(streaming: boolean) {
  const onStop = vi.fn()
  const onSend = vi.fn(() => true)
  render(<MessageBox streaming={streaming} onSend={onSend} onStop={onStop} />)
  return { onStop, onSend }
}

beforeEach(() => {
  host.reset()
  writeThemeState(HELLO_KEY, true, HELLO_STATE)
})

describe('Esc in the message box (Play 1.1.1)', () => {
  it('stops Auto while he answers', () => {
    const { onStop } = renderBox(true)
    fireEvent.keyDown(box(), { key: 'Escape' })
    expect(onStop).toHaveBeenCalledTimes(1)
  })

  it('does nothing while he is not answering, and sends nothing', () => {
    const { onStop, onSend } = renderBox(false)
    fireEvent.change(box(), { target: { value: 'Plan my week' } })
    fireEvent.keyDown(box(), { key: 'Escape' })
    expect(onStop).not.toHaveBeenCalled()
    expect(onSend).not.toHaveBeenCalled()
    expect(box()).toHaveValue('Plan my week')
  })

  it('leaves an IME composition alone: Esc there cancels the composition, not the reply', () => {
    const { onStop } = renderBox(true)
    fireEvent.keyDown(box(), { key: 'Escape', isComposing: true })
    expect(onStop).not.toHaveBeenCalled()
  })

  it("is the chat's Stop: the turn ends, what Auto wrote is kept as stopped, and Send is back", async () => {
    host.setConversations([
      { id: 'c1', title: 'Laptop for uni', updatedAt: '2026-10-14T09:00:00+00:00', preview: null, messages: [{ role: 'user', text: 'Hi' }] },
    ])
    host.setSearchParams('chatId=c1')
    host.setChatScript([{ frames: [], hold: true }])
    render(<PlayChat />)
    await screen.findByRole('list', { name: 'Conversation' })
    fireEvent.change(box(), { target: { value: 'And the battery?' } })
    fireEvent.keyDown(box(), { key: 'Enter' })
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
    fireEvent.keyDown(box(), { key: 'Escape' })
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument()
    expect(screen.getByText(STOPPED_NOTICE)).toBeInTheDocument()
  })
})
