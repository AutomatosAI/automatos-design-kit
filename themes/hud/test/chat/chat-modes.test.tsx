// HUD 1.4.0 on SDK 1.5.0, the row under the message box, on the harness. CODE and MISSION are links in a group named
// Modes, with PLAN between them, a toggle on the host's own Plan switch; the row stands after Send and before the keys
// on the desktop, and in the phone's dock under the control row, the box open or shut. The agent picker comes first:
// its chip names the agent, its list holds Auto and the active agents that can run, a session agent as a link to its
// session; a choice names the box after the agent and focuses it, and the next message goes to it; a refused one
// changes nothing; Esc shuts the list. AGENTS' rows of agents that can run choose the agent too. Roles, names and
// attributes only; every value is made up.
import type { RosterAgent } from '@automatos/theme-sdk'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { host } from '@automatos/theme-harness/host'
import { Composer, PLACEHOLDER, SEND } from '../../src/chat/composer.tsx'
import { HudChatPage } from '../../src/chat/hud-chat.tsx'
import {
  type AgentChoice, AUTO_NAME, chosenName, isSessionAgent, messagePlaceholder, pickableAgents, sessionHref, UNLISTED_AGENT,
} from '../../src/chat/modes/agent-choice.ts'
import { AGENTS_LIST_LABEL, SESSION_TAG, TALKING_TO, useAgentSeat } from '../../src/chat/modes/agent-picker.tsx'
import { CODE, CODE_HREF, MISSION, MISSIONS_HREF, MODES_LABEL, PLAN_LABEL, PLAN_TITLE } from '../../src/chat/modes/modes.ts'
import { AGENTS_TITLE } from '../../src/chat/panels/agents-panel.tsx'
import { CONTROLS_LABEL, TYPE_LABEL } from '../../src/chat/phone/phone-controls.tsx'
import { PHONE_WIDTH, resetWindowWidth, setWindowWidth } from '../support/window-width.ts'
import { readSource } from '../support/files.ts'
import { ask, ASKED, box, HELD, openChat, renderChat, stubClips } from './support.tsx'

const STAMP = '2026-10-14T09:00:00+00:00'

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

const modes = (): HTMLElement => screen.getByRole('group', { name: MODES_LABEL })
const plan = (): HTMLElement => within(modes()).getByRole('button', { name: PLAN_LABEL })
const chip = (name: string): HTMLElement => screen.getByRole('button', { name: `${TALKING_TO} ${name}` })
const list = (): HTMLElement => screen.getByRole('list', { name: AGENTS_LIST_LABEL })
const agentsPanel = (): HTMLElement => screen.getByRole('region', { name: AGENTS_TITLE })

/** The stored conversation on screen, its roster answered. */
async function renderWithRoster(turns = [HELD]) {
  await renderChat(turns)
  act(() => host.setPageQuery('useAgents', { data: ROSTER }))
}

/** The composer and its picker on a stand-in chat that refuses every agent, as the host does while its roster loads. */
function RefusingComposer({ asked }: { readonly asked: (id: number | null) => void }) {
  const boxRef = useRef<HTMLTextAreaElement>(null)
  const chooseAgent = (id: number | null): boolean => {
    asked(id)
    return false
  }
  const choice: AgentChoice = { agentId: null, chooseAgent }
  const seat = useAgentSeat(choice, () => boxRef.current?.focus())
  return <Composer boxRef={boxRef} streaming={false} onSend={() => true} onStop={() => undefined} placeholder={seat.placeholder} tools={seat.picker} />
}

beforeEach(() => {
  host.reset()
  stubClips()
})

afterEach(() => {
  resetWindowWidth()
})

describe('the modes', () => {
  it('are CODE and MISSION, links to the host page for each, with PLAN between them, after Send and before the keys', async () => {
    await renderChat()
    const controls = Array.from(modes().querySelectorAll<HTMLElement>('a, button'))
    expect(controls.map((control) => [control.tagName, control.textContent, control.title])).toEqual([
      ['A', CODE.label, CODE.opens], ['BUTTON', PLAN_LABEL, PLAN_TITLE], ['A', MISSION.label, MISSION.opens],
    ])
    expect([CODE_HREF, MISSIONS_HREF]).toEqual(['/chat?repo=.', '/assignments?tab=missions'])
    expect(within(modes()).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([CODE_HREF, MISSIONS_HREF])
    const keys = document.getElementById(box().getAttribute('aria-describedby') ?? '') as HTMLElement
    expect(screen.getByRole('button', { name: SEND }).compareDocumentPosition(modes()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(modes().compareDocumentPosition(keys) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('go where they say with a click: a push to the page, as a link inside the app does', async () => {
    await renderChat()
    fireEvent.click(within(modes()).getByRole('link', { name: MISSION.label }))
    expect(host.navigations()).toContainEqual({ method: 'push', href: MISSIONS_HREF })
  })

  it("turn the host's Plan on and off with PLAN, and the next message goes with Plan", async () => {
    await renderChat([HELD])
    expect(plan()).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(plan())
    expect(plan()).toHaveAttribute('aria-pressed', 'true')
    expect(host.chatPlanMode()).toBe(true)
    ask()
    expect(host.chatSent()).toEqual([{ chatId: 'c1', text: ASKED, retry: false, planMode: true }])
    fireEvent.click(plan())
    expect(host.chatPlanMode()).toBe(false)
  })

  it('show Plan on when the host has it on (a /chat?mode=plan link, Studio)', async () => {
    host.setChatPlanMode(true)
    await renderChat()
    expect(plan()).toHaveAttribute('aria-pressed', 'true')
  })

  it('sit in the phone dock under the control row, the box shut or open, and only there', async () => {
    setWindowWidth(PHONE_WIDTH)
    openChat()
    render(<HudChatPage />)
    await screen.findByRole('article', { name: 'You said' })
    const controls = screen.getByRole('group', { name: CONTROLS_LABEL })
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(controls.compareDocumentPosition(modes()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(modes().parentElement).toHaveAttribute('data-layout', 'phone')
    fireEvent.click(within(controls).getByRole('button', { name: TYPE_LABEL }))
    expect(box()).toBeInTheDocument()
    expect(screen.getAllByRole('group', { name: MODES_LABEL })).toHaveLength(1)
  })

  it("are 32 px chips under the desktop's box and 44 px targets in the phone's dock, PLAN lit while on", () => {
    const css = readSource('chat/modes/modes.module.css').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ')
    expect(css).toMatch(/\.mode, \.chip \{[^}]*min-height: 32px;/)
    expect(css).toMatch(/\.row\[data-layout="phone"\] \.mode, \.row\[data-layout="phone"\] \.chip \{ min-height: var\(--hud-tap-min\); \}/)
    expect(css).toMatch(/\.mode\[aria-pressed="true"\] \{[^}]*color: var\(--hud-accent-text\);/)
  })
})

describe('the agent picker', () => {
  it('names the agent the box talks to on its chip, Auto first, and lists Auto and the active agents that can run', async () => {
    await renderWithRoster()
    expect(box()).toHaveAttribute('placeholder', PLACEHOLDER)
    expect(chip(AUTO_NAME)).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('list', { name: AGENTS_LIST_LABEL })).toBeNull()
    fireEvent.click(chip(AUTO_NAME))
    expect(within(list()).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Auto', 'Scout', `Builder ${SESSION_TAG}`])
    expect(within(list()).getByRole('button', { name: AUTO_NAME })).toHaveAttribute('aria-pressed', 'true')
    expect(chip(AUTO_NAME).compareDocumentPosition(modes()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('chooses an agent: the chip and the box take its name, the box the focus, and the next message goes to it', async () => {
    await renderWithRoster()
    fireEvent.click(chip(AUTO_NAME))
    fireEvent.click(within(list()).getByRole('button', { name: 'Scout' }))
    const scoutBox = screen.getByRole('textbox', { name: 'Message Scout' })
    expect(scoutBox).toHaveFocus()
    expect(screen.queryByRole('list', { name: AGENTS_LIST_LABEL })).toBeNull()
    fireEvent.change(scoutBox, { target: { value: ASKED } })
    fireEvent.keyDown(scoutBox, { key: 'Enter' })
    expect(host.chatSent()).toEqual([{ chatId: 'c1', text: ASKED, retry: false, agentId: 1 }])
    fireEvent.click(chip('Scout'))
    fireEvent.click(within(list()).getByRole('button', { name: AUTO_NAME }))
    expect(box()).toHaveFocus()
  })

  it("opens a session agent's session with a link to /chat?agent=<id>, and never chooses it", async () => {
    await renderWithRoster()
    fireEvent.click(chip(AUTO_NAME))
    const session = within(list()).getByRole('link', { name: `Builder ${SESSION_TAG}` })
    expect(session).toHaveAttribute('href', '/chat?agent=4')
    expect(within(list()).queryByRole('button', { name: /Builder/ })).toBeNull()
    fireEvent.click(session)
    expect(host.navigations()).toContainEqual({ method: 'push', href: '/chat?agent=4' })
  })

  it('shuts the list on Esc and gives the chip the focus', async () => {
    await renderWithRoster()
    fireEvent.click(chip(AUTO_NAME))
    fireEvent.keyDown(within(list()).getByRole('button', { name: 'Scout' }), { key: 'Escape' })
    expect(screen.queryByRole('list', { name: AGENTS_LIST_LABEL })).toBeNull()
    expect(chip(AUTO_NAME)).toHaveFocus()
  })

  it('changes nothing when the host refuses the agent: the list stays open and the box talks to Auto', () => {
    const asked = vi.fn<(id: number | null) => void>()
    render(<RefusingComposer asked={asked} />)
    act(() => host.setPageQuery('useAgents', { data: ROSTER }))
    fireEvent.click(chip(AUTO_NAME))
    fireEvent.click(within(list()).getByRole('button', { name: 'Scout' }))
    expect(asked.mock.calls).toEqual([[1]])
    expect(box()).toHaveAttribute('placeholder', PLACEHOLDER)
    expect(list()).toBeInTheDocument()
  })
})

describe("AGENTS' rows", () => {
  it('choose an agent that can run, link a session agent to its session, and only say the rest', async () => {
    await renderWithRoster()
    const scout = within(agentsPanel()).getByRole('button', { name: /^Scout/ })
    expect(scout).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(scout)
    expect(screen.getByRole('textbox', { name: 'Message Scout' })).toHaveFocus()
    expect(within(agentsPanel()).getByRole('button', { name: /^Scout/ })).toHaveAttribute('aria-pressed', 'true')
    const builder = within(agentsPanel()).getByRole('link', { name: /^Builder/ })
    expect(builder).toHaveAttribute('href', '/chat?agent=4')
    expect(builder).toHaveTextContent(SESSION_TAG)
    expect(within(agentsPanel()).queryByRole('button', { name: /^Scribe|^Analyst/ })).toBeNull()
    expect(within(agentsPanel()).queryByRole('link', { name: /^Scribe|^Analyst/ })).toBeNull()
  })
})

describe('the agent choice', () => {
  it('lists the active agents that can run, tells a session agent by its runtime, and names the chosen one', () => {
    expect(pickableAgents(ROSTER).map((each) => each.name)).toEqual(['Scout', 'Builder'])
    expect(pickableAgents(null)).toEqual([])
    expect(ROSTER.map(isSessionAgent)).toEqual([false, false, false, true])
    expect(sessionHref(ROSTER[3])).toBe('/chat?agent=4')
    expect([chosenName(ROSTER, null), chosenName(ROSTER, 2), chosenName(ROSTER, 99)]).toEqual([AUTO_NAME, 'Scribe', UNLISTED_AGENT])
    expect(messagePlaceholder(AUTO_NAME)).toBe(PLACEHOLDER)
  })
})
