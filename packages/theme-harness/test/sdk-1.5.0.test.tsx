/**
 * SDK 1.5.0: who answers a theme's chat, and Plan, on the fake chat controller (src/internal/scripted/chat-partner.ts,
 * after core's internal/chat-partner.ts at 5e357cd7ffa5dc89725349784445fee5de985265), through the fake host as a
 * theme's test drives it. A conversation starts with Auto; chooseAgent picks an agent of the roster the test answers
 * for useAgents, and refuses a session agent (configuration.runtime 'cli'), an id the roster lacks and anything while
 * the roster loads, throwing for a value that is no agent id; the roster read is the host's, never a theme's ask.
 * Plan is the host's one switch: setPlanMode sets it (throwing for anything but true or false), a test sets it with
 * setChatPlanMode and reads it with chatPlanMode, and host.reset() turns it off. A send carries both (chatSent's
 * agentId and planMode, absent for Auto and with Plan off). The chat screen is built as in chat-controls.test.tsx.
 * Every value is made up.
 */
import type { HostChatController, HostChatConversation, RosterAgent } from '@automatos/theme-sdk'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useChatController } from '../src/sdk/chat.ts'
import { host } from '../src/host.ts'

const WORDS = 'Compare these laptops'
const STAMP = '2026-10-14T09:00:00+00:00'

function agent(id: number, name: string, runtime?: string): RosterAgent {
  const configuration = runtime === undefined ? null : { runtime }
  return { id, name, description: null, agent_type: 'custom', status: 'active', premium_icon: null, configuration, created_at: STAMP, updated_at: STAMP }
}

const ROSTER: readonly RosterAgent[] = [agent(1, 'Scout'), agent(4, 'Builder', 'cli')]

function Conversation({ conversation, onView }: { readonly conversation: HostChatConversation; readonly onView: (chat: HostChatController) => void }) {
  const chat = useChatController(conversation)
  onView(chat)
  return (
    <button type="button" onClick={() => chat.send(WORDS)}>
      Send
    </button>
  )
}

function ChatScreen({ onView }: { readonly onView: (chat: HostChatController) => void }) {
  const { conversation } = useChatController()
  return conversation === null ? null : <Conversation key={conversation.key} conversation={conversation} onView={onView} />
}

function renderChat(): () => HostChatController {
  const onView = vi.fn<(chat: HostChatController) => void>()
  render(<ChatScreen onView={onView} />)
  return () => {
    const last = onView.mock.lastCall?.[0]
    if (last === undefined) throw new Error('The chat screen has not rendered.')
    return last
  }
}

const send = (): void => {
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))
}

beforeEach(() => {
  host.reset()
})

describe('who answers (chooseAgent)', () => {
  it('starts with Auto, and refuses every agent while the roster loads', () => {
    const chat = renderChat()
    expect(chat().agentId).toBeNull()
    let picked = true
    act(() => {
      picked = chat().chooseAgent(1)
    })
    expect(picked).toBe(false)
    expect(chat().agentId).toBeNull()
  })

  it("picks an agent of the roster, and Auto again with null; the roster read is the host's, never a theme's ask", () => {
    const chat = renderChat()
    act(() => host.setPageQuery('useAgents', { data: ROSTER }))
    const picks: boolean[] = []
    act(() => {
      picks.push(chat().chooseAgent(1))
    })
    expect(chat().agentId).toBe(1)
    act(() => {
      picks.push(chat().chooseAgent(null))
    })
    expect([picks, chat().agentId]).toEqual([[true, true], null])
    expect(host.pageAsks().filter((ask) => ask.hook === 'useAgents')).toEqual([])
  })

  it('refuses a session agent and an id the roster lacks, and throws for a value that is no agent id', () => {
    const chat = renderChat()
    act(() => host.setPageQuery('useAgents', { data: ROSTER }))
    expect([chat().chooseAgent(4), chat().chooseAgent(99)]).toEqual([false, false])
    expect(chat().agentId).toBeNull()
    expect(() => chat().chooseAgent(1.5)).toThrow(TypeError)
    expect(() => chat().chooseAgent('1' as unknown as number)).toThrow(TypeError)
  })

  it("goes with the next message: chatSent's agentId, absent for Auto", () => {
    host.setChatScript([{ frames: [{ text: 'One' }], hold: true }])
    const chat = renderChat()
    act(() => host.setPageQuery('useAgents', { data: ROSTER }))
    act(() => {
      chat().chooseAgent(1)
    })
    send()
    expect(host.chatSent()).toEqual([{ chatId: null, text: WORDS, retry: false, agentId: 1 }])
  })
})

describe('Plan (setPlanMode)', () => {
  it("is the host's one switch: off to start, set by the chat or by a test, and read back", () => {
    const chat = renderChat()
    expect([chat().planMode, host.chatPlanMode()]).toEqual([false, false])
    act(() => chat().setPlanMode(true))
    expect([chat().planMode, host.chatPlanMode()]).toEqual([true, true])
    act(() => host.setChatPlanMode(false))
    expect(chat().planMode).toBe(false)
  })

  it('is off again once the host is reset', () => {
    host.setChatPlanMode(true)
    host.reset()
    expect(host.chatPlanMode()).toBe(false)
  })

  it('throws for anything but true or false', () => {
    const chat = renderChat()
    expect(() => chat().setPlanMode('on' as unknown as boolean)).toThrow(TypeError)
    expect(host.chatPlanMode()).toBe(false)
  })

  it("goes with the next message: chatSent's planMode, absent with Plan off", () => {
    host.setChatScript([{ frames: [{ text: 'One' }], hold: true }])
    renderChat()
    act(() => host.setChatPlanMode(true))
    send()
    expect(host.chatSent()).toEqual([{ chatId: null, text: WORDS, retry: false, planMode: true }])
  })
})
