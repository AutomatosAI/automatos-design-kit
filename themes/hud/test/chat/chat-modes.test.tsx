// HUD 1.4.0, the row under the message box, on the harness. CODE, PLAN and MISSION are links in a group named Modes,
// after Send and before the keys on the desktop, each to the host's page for it (the chat with the code canvas, the
// chat in plan mode, Missions), a click a push there; on the phone they sit in the dock under the control row, the box
// open or shut, and the box holds no second row. The harness's chat is SDK 1.4.0's, which can choose no agent: no
// picker, and the box is "Message Auto". Then the picker on a chat that can (SDK 1.5.0's agentId and chooseAgent,
// handed in by a stand-in): its chip names the agent, its list holds Auto and the active agents that can run, a session
// agent as a link; a choice names the box and focuses it, a refused one changes nothing, Esc shuts the list. Roles,
// names and attributes only; every value is made up.
import type { HostChatController, RosterAgent } from '@automatos/theme-sdk'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useRef, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { host } from '@automatos/theme-harness/host'
import { Composer, PLACEHOLDER, SEND } from '../../src/chat/composer.tsx'
import { HudChatPage } from '../../src/chat/hud-chat.tsx'
import {
  type AgentChoice, agentChoiceOf, AUTO_NAME, chosenName, isSessionAgent, messagePlaceholder, pickableAgents, sessionHref,
  UNLISTED_AGENT,
} from '../../src/chat/modes/agent-choice.ts'
import { AGENTS_LIST_LABEL, AgentSeat, SESSION_TAG, TALKING_TO } from '../../src/chat/modes/agent-picker.tsx'
import { ModeRow } from '../../src/chat/modes/mode-row.tsx'
import { CHAT_MODES, CODE_HREF, MISSIONS_HREF, MODES_LABEL, PLAN_HREF } from '../../src/chat/modes/modes.ts'
import { CONTROLS_LABEL, TYPE_LABEL } from '../../src/chat/phone/phone-controls.tsx'
import { PHONE_WIDTH, resetWindowWidth, setWindowWidth } from '../support/window-width.ts'
import { readSource } from '../support/files.ts'
import { box, openChat, renderChat, stubClips } from './support.tsx'

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

const modes = (): HTMLElement => screen.getByRole('group', { name: MODES_LABEL })
const chip = (name: string): HTMLElement => screen.getByRole('button', { name: `${TALKING_TO} ${name}` })
const list = (): HTMLElement => screen.getByRole('list', { name: AGENTS_LIST_LABEL })

/** The composer with its row, on a stand-in for SDK 1.5.0's chat: it keeps the choice, refusing the ids in `refused`. */
function ChoosingComposer({ refused = [], asked }: { readonly refused?: readonly number[]; readonly asked: (id: number | null) => void }) {
  const [agentId, setAgentId] = useState<number | null>(null)
  const boxRef = useRef<HTMLTextAreaElement>(null)
  const chooseAgent = (id: number | null): boolean => {
    asked(id)
    if (id !== null && refused.includes(id)) return false
    setAgentId(id)
    return true
  }
  const choice: AgentChoice = { agentId, chooseAgent }
  return (
    <AgentSeat choice={choice} onChosen={() => boxRef.current?.focus()}>
      {(seat) => (
        <Composer
          boxRef={boxRef}
          streaming={false}
          onSend={() => true}
          onStop={() => undefined}
          placeholder={seat.placeholder}
          tools={<ModeRow agent={seat.picker} />}
        />
      )}
    </AgentSeat>
  )
}

function renderChoosing(refused: readonly number[] = []) {
  const asked = vi.fn<(id: number | null) => void>()
  render(<ChoosingComposer refused={refused} asked={asked} />)
  act(() => host.setPageQuery('useAgents', { data: ROSTER }))
  return asked
}

beforeEach(() => {
  host.reset()
  stubClips()
})

afterEach(() => {
  resetWindowWidth()
})

describe('the modes', () => {
  it("are CODE, PLAN and MISSION, links to the host's page for each, after Send and before the keys", async () => {
    await renderChat()
    const links = within(modes()).getAllByRole('link')
    expect(links.map((link) => [link.textContent, link.getAttribute('href'), link.title])).toEqual(
      CHAT_MODES.map((mode) => [mode.label, mode.href, mode.opens]),
    )
    expect([CODE_HREF, PLAN_HREF, MISSIONS_HREF]).toEqual(['/chat?repo=.', '/chat?mode=plan', '/assignments?tab=missions'])
    const keys = document.getElementById(box().getAttribute('aria-describedby') ?? '') as HTMLElement
    expect(screen.getByRole('button', { name: SEND }).compareDocumentPosition(modes()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(modes().compareDocumentPosition(keys) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    links.forEach((link) => {
      link.focus()
      expect(link).toHaveFocus()
    })
  })

  it('go where they say with a click: a push to the page, as a link inside the app does', () => {
    render(<ModeRow />)
    within(modes()).getAllByRole('link').forEach((link) => fireEvent.click(link))
    expect(host.navigations()).toEqual([CODE_HREF, PLAN_HREF, MISSIONS_HREF].map((href) => ({ method: 'push', href })))
  })

  it('come with no agent picker on a chat that can choose no agent (SDK 1.4.0): the box talks to Auto', async () => {
    await renderChat()
    expect(screen.queryByRole('button', { name: new RegExp(`^${TALKING_TO}`) })).toBeNull()
    expect(box()).toHaveAttribute('placeholder', PLACEHOLDER)
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

  it("are 32 px chips under the desktop's box and 44 px targets in the phone's dock", () => {
    const css = readSource('chat/modes/modes.module.css').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ')
    expect(css).toMatch(/\.mode, \.chip \{[^}]*min-height: 32px;/)
    expect(css).toMatch(/\.row\[data-layout="phone"\] \.mode, \.row\[data-layout="phone"\] \.chip \{ min-height: var\(--hud-tap-min\); \}/)
  })
})

describe('the agent picker', () => {
  it('names the agent the box talks to on its chip, Auto first, and lists Auto and the active agents that can run', () => {
    renderChoosing()
    expect(box()).toHaveAttribute('placeholder', PLACEHOLDER)
    expect(chip(AUTO_NAME)).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('list', { name: AGENTS_LIST_LABEL })).toBeNull()
    fireEvent.click(chip(AUTO_NAME))
    expect(chip(AUTO_NAME)).toHaveAttribute('aria-expanded', 'true')
    expect(within(list()).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Auto', 'Scout', `Builder ${SESSION_TAG}`])
    expect(within(list()).getByRole('button', { name: AUTO_NAME })).toHaveAttribute('aria-pressed', 'true')
    expect(chip(AUTO_NAME).compareDocumentPosition(modes()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("chooses an agent with the chat's chooseAgent: the chip and the box take its name, and the box the focus", () => {
    const asked = renderChoosing()
    fireEvent.click(chip(AUTO_NAME))
    fireEvent.click(within(list()).getByRole('button', { name: 'Scout' }))
    expect(asked.mock.calls).toEqual([[1]])
    expect(screen.getByRole('textbox', { name: 'Message Scout' })).toHaveFocus()
    expect(screen.queryByRole('list', { name: AGENTS_LIST_LABEL })).toBeNull()
    fireEvent.click(chip('Scout'))
    expect(within(list()).getByRole('button', { name: 'Scout' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(within(list()).getByRole('button', { name: AUTO_NAME }))
    expect(box()).toHaveFocus()
  })

  it('changes nothing when the host refuses the agent: the list stays open and the box talks to Auto', () => {
    const asked = renderChoosing([1])
    fireEvent.click(chip(AUTO_NAME))
    fireEvent.click(within(list()).getByRole('button', { name: 'Scout' }))
    expect(asked.mock.calls).toEqual([[1]])
    expect(box()).toHaveAttribute('placeholder', PLACEHOLDER)
    expect(list()).toBeInTheDocument()
  })

  it("opens a session agent's session with a link, and never chooses it", () => {
    const asked = renderChoosing()
    fireEvent.click(chip(AUTO_NAME))
    const session = within(list()).getByRole('link', { name: `Builder ${SESSION_TAG}` })
    expect(session).toHaveAttribute('href', CODE_HREF)
    expect(within(list()).queryByRole('button', { name: /Builder/ })).toBeNull()
    fireEvent.click(session)
    expect(asked).not.toHaveBeenCalled()
    expect(host.navigations()).toContainEqual({ method: 'push', href: CODE_HREF })
  })

  it('shuts the list on Esc and gives the chip the focus', () => {
    renderChoosing()
    fireEvent.click(chip(AUTO_NAME))
    fireEvent.keyDown(within(list()).getByRole('button', { name: 'Scout' }), { key: 'Escape' })
    expect(screen.queryByRole('list', { name: AGENTS_LIST_LABEL })).toBeNull()
    expect(chip(AUTO_NAME)).toHaveFocus()
  })
})

describe('the agent choice', () => {
  it("is the controller's agentId and chooseAgent where it has them (SDK 1.5.0), none where it hasn't", () => {
    expect(agentChoiceOf({} as HostChatController)).toBeNull()
    const chooseAgent = (id: number | null): boolean => id !== 9
    const choice = agentChoiceOf({ agentId: 4, chooseAgent } as unknown as HostChatController)
    expect(choice?.agentId).toBe(4)
    expect(choice?.chooseAgent(9)).toBe(false)
    expect(agentChoiceOf({ chooseAgent } as unknown as HostChatController)?.agentId).toBeNull()
  })

  it('lists the active agents that can run, tells a session agent by its runtime, and names the chosen one', () => {
    expect(pickableAgents(ROSTER).map((each) => each.name)).toEqual(['Scout', 'Builder'])
    expect(pickableAgents(null)).toEqual([])
    expect(ROSTER.map(isSessionAgent)).toEqual([false, false, false, true])
    expect(sessionHref(ROSTER[3])).toBe(CODE_HREF)
    expect([chosenName(ROSTER, null), chosenName(ROSTER, 2), chosenName(ROSTER, 99)]).toEqual([AUTO_NAME, 'Scribe', UNLISTED_AGENT])
    expect(messagePlaceholder(AUTO_NAME)).toBe(PLACEHOLDER)
  })
})
