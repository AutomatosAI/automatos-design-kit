// Play 1.5.0, the row under the message box, on the harness. Code, Plan and Mission are links in a group named Modes,
// after Send and outside the box's form, each to the host's page for it (the chat with the code canvas, the chat in
// plan mode, Missions), a click a push there, on the first open, in a conversation and on a phone alike. The harness's
// chat is SDK 1.4.0's, which can choose no agent: no picker, and the box is "Message Auto". Then the picker on a chat
// that can (a stand-in controller with SDK 1.5.0's agentId and chooseAgent): its pill names the agent, its list holds
// Auto and the active agents that can run, a session agent as a link; a choice names the box and focuses it, a
// refused one changes nothing, Esc shuts the list. Auto is a stand-in. Roles, names, attributes and the stylesheet's
// text; every value is made up.
import { type HostChatController, type RosterAgent, writeThemeState } from '@automatos/theme-sdk'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useRef, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { host } from '@automatos/theme-harness/host'
import { AUTO_NAME, messagePlaceholder } from '../../src/components/play/chat/agent-choice.ts'
import { AGENTS_LIST_LABEL, SESSION_TAG, TALKING_TO } from '../../src/components/play/chat/agent-picker.tsx'
import { CHAT_MODES, CODE_HREF, MISSIONS_HREF, MODES_LABEL, PLAN_HREF } from '../../src/components/play/chat/chat-modes.ts'
import { PLACEHOLDER } from '../../src/components/play/chat/message-box.tsx'
import { ModeRow } from '../../src/components/play/chat/mode-row.tsx'
import { PlayChat } from '../../src/components/play/chat/play-chat.tsx'
import { PlayComposer } from '../../src/components/play/chat/play-composer.tsx'
import { HELLO_KEY, HELLO_STATE } from '../../src/lib/mascot/session.ts'
import { declaredFor } from '../support/rule-values.ts'
import { PHONE_WIDTH, resetWindowWidth, setWindowWidth } from '../support/window-width.ts'

vi.mock('../../src/components/mascot/auto-mascot.tsx', async () => {
  const { createElement } = await import('react')
  return { AutoMascot: ({ state }: { readonly state: string }) => createElement('div', { 'data-testid': 'auto', 'data-state': state }) }
})

const COMPOSER_CSS = 'components/play/chat/composer.module.css'
const PHONE_MEDIA = '@media (max-width: 1023px)'
const STAMP = '2026-10-14T09:00:00+00:00'

/** A roster agent, active unless said otherwise; `runtime` is SDK 1.5.0's configuration.runtime. */
function agent(id: number, name: string, fields: Partial<RosterAgent> & { readonly runtime?: string } = {}): RosterAgent {
  const { runtime, ...rest } = fields
  const configured = runtime === undefined ? {} : { configuration: { runtime } }
  const base = { description: null, agent_type: 'custom', premium_icon: null, created_at: STAMP, updated_at: STAMP }
  return { id, name, status: 'active', ...base, ...rest, ...configured }
}

const ROSTER: readonly RosterAgent[] = [
  agent(1, 'Scout'),
  agent(2, 'Scribe', { status: 'inactive' }),
  agent(3, 'Analyst', { unavailable: 'No AI credit' }),
  agent(4, 'Builder', { runtime: 'cli' }),
]

const box = () => screen.getByRole('textbox', { name: PLACEHOLDER })
const modes = (): HTMLElement => screen.getByRole('group', { name: MODES_LABEL })
const pill = (name: string): HTMLElement => screen.getByRole('button', { name: `${TALKING_TO} ${name}` })
const list = (): HTMLElement => screen.getByRole('list', { name: AGENTS_LIST_LABEL })

/** The stored conversation c1 on screen through its ?chatId= link. */
async function renderConversation() {
  host.setConversations([
    { id: 'c1', title: 'Laptop for uni', updatedAt: STAMP, preview: null, messages: [{ role: 'user', text: 'Which laptop?' }] },
  ])
  host.setSearchParams('chatId=c1')
  render(<PlayChat />)
  await screen.findByRole('list', { name: 'Conversation' })
}

/** Play's composer on a stand-in for SDK 1.5.0's chat: it keeps the choice, refusing the ids in `refused`. */
function ChoosingComposer({ refused, asked }: { readonly refused: readonly number[]; readonly asked: (id: number | null) => void }) {
  const [agentId, setAgentId] = useState<number | null>(null)
  const boxRef = useRef<HTMLTextAreaElement>(null)
  const chooseAgent = (id: number | null): boolean => {
    asked(id)
    if (id !== null && refused.includes(id)) return false
    setAgentId(id)
    return true
  }
  const chat = { streaming: false, send: () => true, agentId, chooseAgent } as unknown as HostChatController
  const none = (): void => undefined
  return <PlayComposer chat={chat} box={boxRef} fill={null} onStop={none} onFocus={none} onBlur={none} autoFocus={false} voiceHotkey={null} />
}

function renderChoosing(refused: readonly number[] = []) {
  const asked = vi.fn<(id: number | null) => void>()
  render(<ChoosingComposer refused={refused} asked={asked} />)
  act(() => host.setPageQuery('useAgents', { data: ROSTER }))
  return asked
}

beforeEach(() => {
  host.reset()
  writeThemeState(HELLO_KEY, true, HELLO_STATE)
})

afterEach(() => {
  resetWindowWidth()
})

describe('the modes under the message box (Play 1.5.0)', () => {
  it("are Code, Plan and Mission, links to the host's page for each, after Send and outside the box's form", async () => {
    await renderConversation()
    const links = within(modes()).getAllByRole('link')
    expect(links.map((link) => [link.textContent, link.getAttribute('href'), link.title])).toEqual(
      CHAT_MODES.map((mode) => [mode.label, mode.href, mode.opens]),
    )
    expect([CODE_HREF, PLAN_HREF, MISSIONS_HREF]).toEqual(['/chat?repo=.', '/chat?mode=plan', '/assignments?tab=missions'])
    const form = box().closest('form') as HTMLFormElement
    expect(form).not.toContainElement(modes())
    const send = within(form).getByRole('button', { name: 'Send' })
    expect(send.compareDocumentPosition(modes()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    links.forEach((link) => {
      link.focus()
      expect(link).toHaveFocus()
    })
  })

  it('stand under the box on the first open and on a phone too', () => {
    setWindowWidth(PHONE_WIDTH)
    render(<PlayChat />)
    expect(box().compareDocumentPosition(modes()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('go where they say with a click: a push to the page, as a link inside the app does', () => {
    render(<ModeRow />)
    within(modes()).getAllByRole('link').forEach((link) => fireEvent.click(link))
    expect(host.navigations()).toEqual([CODE_HREF, PLAN_HREF, MISSIONS_HREF].map((href) => ({ method: 'push', href })))
  })

  it('come with no agent picker on a chat that can choose no agent (SDK 1.4.0): the box talks to Auto', async () => {
    await renderConversation()
    expect(screen.queryByRole('button', { name: new RegExp(`^${TALKING_TO}`) })).toBeNull()
    expect(messagePlaceholder(AUTO_NAME)).toBe(PLACEHOLDER)
    expect(box()).toHaveAttribute('placeholder', PLACEHOLDER)
  })

  it('are 32 px outlined pills, 44 px targets on a phone', () => {
    expect(declaredFor(COMPOSER_CSS, '.mode').get('min-height')).toBe('32px')
    expect(declaredFor(COMPOSER_CSS, '.mode').get('border')).toBe('1px solid var(--pl-line-button)')
    expect(declaredFor(COMPOSER_CSS, '.mode', PHONE_MEDIA).get('min-height')).toBe('var(--pl-tap-min)')
    expect(declaredFor(COMPOSER_CSS, '.agentChip', PHONE_MEDIA).get('min-height')).toBe('var(--pl-tap-min)')
  })
})

describe('the agent picker (Play 1.5.0, on SDK 1.5.0)', () => {
  it('names the agent the box talks to on its pill, Auto first, and lists Auto and the active agents that can run', () => {
    renderChoosing()
    expect(pill(AUTO_NAME)).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('list', { name: AGENTS_LIST_LABEL })).toBeNull()
    fireEvent.click(pill(AUTO_NAME))
    expect(within(list()).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Auto', 'Scout', `Builder ${SESSION_TAG}`])
    expect(within(list()).getByRole('button', { name: AUTO_NAME })).toHaveAttribute('aria-pressed', 'true')
    expect(pill(AUTO_NAME).compareDocumentPosition(modes()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("chooses an agent with the chat's chooseAgent: the pill and the box take its name, and the box the focus", () => {
    const asked = renderChoosing()
    fireEvent.click(pill(AUTO_NAME))
    fireEvent.click(within(list()).getByRole('button', { name: 'Scout' }))
    expect(asked.mock.calls).toEqual([[1]])
    expect(screen.getByRole('textbox', { name: 'Message Scout' })).toHaveFocus()
    expect(pill('Scout')).toHaveAttribute('aria-expanded', 'false')
  })

  it('changes nothing when the host refuses the agent: the list stays open and the box talks to Auto', () => {
    const asked = renderChoosing([1])
    fireEvent.click(pill(AUTO_NAME))
    fireEvent.click(within(list()).getByRole('button', { name: 'Scout' }))
    expect(asked.mock.calls).toEqual([[1]])
    expect(box()).toBeInTheDocument()
    expect(list()).toBeInTheDocument()
  })

  it("opens a session agent's session with a link, never a choice, and shuts the list on Esc", () => {
    const asked = renderChoosing()
    fireEvent.click(pill(AUTO_NAME))
    expect(within(list()).getByRole('link', { name: `Builder ${SESSION_TAG}` })).toHaveAttribute('href', CODE_HREF)
    expect(within(list()).queryByRole('button', { name: /Builder/ })).toBeNull()
    fireEvent.keyDown(within(list()).getByRole('button', { name: 'Scout' }), { key: 'Escape' })
    expect(screen.queryByRole('list', { name: AGENTS_LIST_LABEL })).toBeNull()
    expect(pill(AUTO_NAME)).toHaveFocus()
    expect(asked).not.toHaveBeenCalled()
  })
})
