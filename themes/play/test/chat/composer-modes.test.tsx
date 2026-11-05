// Play 1.5.0 on SDK 1.5.0, the row under the message box, on the harness. Code and Mission are links in a group named
// Modes, with Plan between them, a toggle on the host's own Plan switch, after Send and outside the box's form, on the
// first open, in a conversation and on a phone alike. The agent picker comes first: its pill names the agent, its list
// holds Auto and the active agents that can run, a session agent as a link to its session; a choice names the box
// after the agent and focuses it, and the next message goes to it; a refused one changes nothing; Esc shuts the list.
// Auto is a stand-in. Roles, names, attributes and the stylesheet's text; every value is made up.
import { type HostChatController, type RosterAgent, writeThemeState } from '@automatos/theme-sdk'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { host } from '@automatos/theme-harness/host'
import { AUTO_NAME, messagePlaceholder } from '../../src/components/play/chat/agent-choice.ts'
import { AGENTS_LIST_LABEL, SESSION_TAG, TALKING_TO } from '../../src/components/play/chat/agent-picker.tsx'
import { CODE, CODE_HREF, MISSION, MISSIONS_HREF, MODES_LABEL, PLAN_LABEL, PLAN_TITLE } from '../../src/components/play/chat/chat-modes.ts'
import { PLACEHOLDER } from '../../src/components/play/chat/message-box.tsx'
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
const ASKED = 'Which laptop wins?'
const HELD: Parameters<typeof host.setChatScript>[0][number] = { frames: [], hold: true }

/** A roster agent, active unless said otherwise; `runtime` is its configuration's. */
function agent(id: number, name: string, fields: Partial<RosterAgent> & { readonly runtime?: string } = {}): RosterAgent {
  const { runtime, ...rest } = fields
  const configuration = runtime === undefined ? null : { runtime }
  const base = { description: null, agent_type: 'custom', premium_icon: null, created_at: STAMP, updated_at: STAMP }
  return { id, name, status: 'active', configuration, ...base, ...rest }
}

const ROSTER: readonly RosterAgent[] = [
  agent(1, 'Scout'),
  agent(2, 'Scribe', { status: 'inactive' }),
  agent(3, 'Analyst', { unavailable: 'No AI credit' }),
  agent(4, 'Builder', { runtime: 'cli' }),
]

const box = () => screen.getByRole('textbox', { name: PLACEHOLDER })
const modes = (): HTMLElement => screen.getByRole('group', { name: MODES_LABEL })
const plan = (): HTMLElement => within(modes()).getByRole('button', { name: PLAN_LABEL })
const pill = (name: string): HTMLElement => screen.getByRole('button', { name: `${TALKING_TO} ${name}` })
const list = (): HTMLElement => screen.getByRole('list', { name: AGENTS_LIST_LABEL })

/** The stored conversation c1 on screen through its ?chatId= link, its next send held open and the roster answered. */
async function renderConversation() {
  host.setConversations([
    { id: 'c1', title: 'Laptop for uni', updatedAt: STAMP, preview: null, messages: [{ role: 'user', text: 'Which laptop?' }] },
  ])
  host.setSearchParams('chatId=c1')
  host.setChatScript([HELD])
  render(<PlayChat />)
  await screen.findByRole('list', { name: 'Conversation' })
  act(() => host.setPageQuery('useAgents', { data: ROSTER }))
}

/** Type into a box and press Enter. */
function sendFrom(field: HTMLElement): void {
  fireEvent.change(field, { target: { value: ASKED } })
  fireEvent.keyDown(field, { key: 'Enter' })
}

/** Play's composer on a stand-in chat that refuses every agent, as the host does while its roster loads. */
function RefusingComposer({ asked }: { readonly asked: (id: number | null) => void }) {
  const boxRef = useRef<HTMLTextAreaElement>(null)
  const chooseAgent = (id: number | null): boolean => {
    asked(id)
    return false
  }
  const chat = { streaming: false, send: () => true, agentId: null, chooseAgent, planMode: false, setPlanMode: () => undefined }
  const none = (): void => undefined
  return (
    <PlayComposer
      chat={chat as unknown as HostChatController} box={boxRef} fill={null} onStop={none} onFocus={none} onBlur={none}
      autoFocus={false} voiceHotkey={null}
    />
  )
}

beforeEach(() => {
  host.reset()
  writeThemeState(HELLO_KEY, true, HELLO_STATE)
})

afterEach(() => {
  resetWindowWidth()
})

describe('the modes under the message box (Play 1.5.0)', () => {
  it("are Code and Mission, links to the host's page for each, with Plan between them, after Send and outside the form", async () => {
    await renderConversation()
    const controls = Array.from(modes().querySelectorAll<HTMLElement>('a, button'))
    expect(controls.map((control) => [control.tagName, control.textContent, control.title])).toEqual([
      ['A', CODE.label, CODE.opens], ['BUTTON', PLAN_LABEL, PLAN_TITLE], ['A', MISSION.label, MISSION.opens],
    ])
    expect(within(modes()).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([CODE_HREF, MISSIONS_HREF])
    expect([CODE_HREF, MISSIONS_HREF]).toEqual(['/chat?repo=.', '/assignments?tab=missions'])
    const form = box().closest('form') as HTMLFormElement
    expect(form).not.toContainElement(modes())
    const send = within(form).getByRole('button', { name: 'Send' })
    expect(send.compareDocumentPosition(modes()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('stand under the box on the first open and on a phone too', () => {
    setWindowWidth(PHONE_WIDTH)
    render(<PlayChat />)
    expect(box().compareDocumentPosition(modes()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('go where they say with a click: a push to the page, as a link inside the app does', async () => {
    await renderConversation()
    fireEvent.click(within(modes()).getByRole('link', { name: MISSION.label }))
    expect(host.navigations()).toContainEqual({ method: 'push', href: MISSIONS_HREF })
  })

  it("turn the host's Plan on and off with Plan, and the next message goes with Plan", async () => {
    await renderConversation()
    expect(plan()).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(plan())
    expect(plan()).toHaveAttribute('aria-pressed', 'true')
    expect(host.chatPlanMode()).toBe(true)
    sendFrom(box())
    expect(host.chatSent()).toEqual([{ chatId: 'c1', text: ASKED, retry: false, planMode: true }])
    fireEvent.click(plan())
    expect(host.chatPlanMode()).toBe(false)
  })

  it('are 32 px outlined pills, 44 px targets on a phone, Plan edged in the accent as text while on', () => {
    expect(declaredFor(COMPOSER_CSS, '.mode').get('min-height')).toBe('32px')
    expect(declaredFor(COMPOSER_CSS, '.mode').get('border')).toBe('1px solid var(--pl-line-button)')
    expect(declaredFor(COMPOSER_CSS, '.mode', PHONE_MEDIA).get('min-height')).toBe('var(--pl-tap-min)')
    expect(declaredFor(COMPOSER_CSS, '.agentChip', PHONE_MEDIA).get('min-height')).toBe('var(--pl-tap-min)')
    expect(declaredFor(COMPOSER_CSS, '.mode[aria-pressed="true"]').get('border-color')).toBe('var(--pl-color-accent-text)')
  })
})

describe('the agent picker (Play 1.5.0)', () => {
  it('names the agent the box talks to on its pill, Auto first, and lists Auto and the active agents that can run', async () => {
    await renderConversation()
    expect(messagePlaceholder(AUTO_NAME)).toBe(PLACEHOLDER)
    expect(pill(AUTO_NAME)).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('list', { name: AGENTS_LIST_LABEL })).toBeNull()
    fireEvent.click(pill(AUTO_NAME))
    expect(within(list()).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Auto', 'Scout', `Builder ${SESSION_TAG}`])
    expect(within(list()).getByRole('button', { name: AUTO_NAME })).toHaveAttribute('aria-pressed', 'true')
    expect(pill(AUTO_NAME).compareDocumentPosition(modes()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('chooses an agent: the pill and the box take its name, the box the focus, and the next message goes to it', async () => {
    await renderConversation()
    fireEvent.click(pill(AUTO_NAME))
    fireEvent.click(within(list()).getByRole('button', { name: 'Scout' }))
    const scoutBox = screen.getByRole('textbox', { name: 'Message Scout' })
    expect(scoutBox).toHaveFocus()
    expect(pill('Scout')).toHaveAttribute('aria-expanded', 'false')
    sendFrom(scoutBox)
    expect(host.chatSent()).toEqual([{ chatId: 'c1', text: ASKED, retry: false, agentId: 1 }])
  })

  it("opens a session agent's session with a link to /chat?agent=<id>, never a choice, and shuts the list on Esc", async () => {
    await renderConversation()
    fireEvent.click(pill(AUTO_NAME))
    expect(within(list()).getByRole('link', { name: `Builder ${SESSION_TAG}` })).toHaveAttribute('href', '/chat?agent=4')
    expect(within(list()).queryByRole('button', { name: /Builder/ })).toBeNull()
    fireEvent.keyDown(within(list()).getByRole('button', { name: 'Scout' }), { key: 'Escape' })
    expect(screen.queryByRole('list', { name: AGENTS_LIST_LABEL })).toBeNull()
    expect(pill(AUTO_NAME)).toHaveFocus()
  })

  it('changes nothing when the host refuses the agent: the list stays open and the box talks to Auto', () => {
    const asked = vi.fn<(id: number | null) => void>()
    render(<RefusingComposer asked={asked} />)
    act(() => host.setPageQuery('useAgents', { data: ROSTER }))
    fireEvent.click(pill(AUTO_NAME))
    fireEvent.click(within(list()).getByRole('button', { name: 'Scout' }))
    expect(asked.mock.calls).toEqual([[1]])
    expect(box()).toBeInTheDocument()
    expect(list()).toBeInTheDocument()
  })
})
