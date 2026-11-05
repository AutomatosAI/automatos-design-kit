// Arcade 1.1.0, the row under the message box, on the harness (after themes/hud/test/chat/chat-modes.test.tsx, HUD
// 1.4.0). Code, Plan and Mission are links in a group named Modes, on the host strip after Send and before the keys,
// each to the host's page for it (the chat with the code canvas, the chat in plan mode, Missions), a click a push
// there, on a desktop and on the handheld. The harness's chat is SDK 1.4.0's, which can choose no agent: no picker, and the box is "Message
// Auto". Then the picker on a chat that can (SDK 1.5.0's agentId and chooseAgent, handed in by a stand-in): its pill
// names the agent, its list holds Auto and the active agents that can run, a session agent as a link; a choice names
// the box and focuses it, a refused one changes nothing, Esc shuts the list. Roles, names and attributes only; every
// value is made up.
import type { RosterAgent } from '@automatos/theme-sdk'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { useRef, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { host } from '@automatos/theme-harness/host'

import { type AgentChoice, AUTO_NAME, messagePlaceholder } from '../src/chat/agent-choice.ts'
import { AGENTS_LIST_LABEL, AgentSeat, SESSION_TAG, TALKING_TO } from '../src/chat/agent-picker.tsx'
import { ChatPage } from '../src/chat/chat-page.tsx'
import { CHAT_MODES, CODE_HREF, MISSIONS_HREF, MODES_LABEL, PLAN_HREF } from '../src/chat/chat-modes.ts'
import { Composer, PLACEHOLDER, SEND } from '../src/chat/composer.tsx'
import { DIALOGUE_LABEL } from '../src/chat/dialogue.tsx'
import { ModeRow } from '../src/chat/mode-row.tsx'
import { PHONE_WIDTH, resetWindowWidth, setWindowWidth } from './support/window-width.ts'

const MODES_CSS = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'chat', 'modes.module.css')
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

const box = (): HTMLElement => screen.getByRole('textbox', { name: PLACEHOLDER })
const modes = (): HTMLElement => screen.getByRole('group', { name: MODES_LABEL })
const pill = (name: string): HTMLElement => screen.getByRole('button', { name: `${TALKING_TO} ${name}` })
const list = (): HTMLElement => screen.getByRole('list', { name: AGENTS_LIST_LABEL })

async function renderChat(): Promise<void> {
  render(<ChatPage />)
  await screen.findByRole('region', { name: DIALOGUE_LABEL })
}

/** The composer with its row, on a stand-in for SDK 1.5.0's chat: it keeps the choice, refusing the ids in `refused`. */
function ChoosingComposer({ refused, asked }: { readonly refused: readonly number[]; readonly asked: (id: number | null) => void }) {
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
})

afterEach(() => {
  resetWindowWidth()
})

describe('the modes under the message box', () => {
  it("are Code, Plan and Mission, links to the host's page for each, after Send and before the keys", async () => {
    await renderChat()
    const links = within(modes()).getAllByRole('link')
    expect(links.map((link) => [link.textContent, link.getAttribute('href'), link.title])).toEqual(
      CHAT_MODES.map((mode) => [mode.label, mode.href, mode.opens]),
    )
    expect([CODE_HREF, PLAN_HREF, MISSIONS_HREF]).toEqual(['/chat?repo=.', '/chat?mode=plan', '/assignments?tab=missions'])
    expect(box().closest('form')).not.toContainElement(modes())
    expect(screen.getByRole('button', { name: SEND }).compareDocumentPosition(modes()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(modes().parentElement).toHaveAttribute('data-layout', 'desktop')
    const keys = document.getElementById(box().getAttribute('aria-describedby') ?? '') as HTMLElement
    expect(modes().compareDocumentPosition(keys) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    links.forEach((link) => {
      link.focus()
      expect(link).toHaveFocus()
    })
  })

  it('are 44 px targets on the handheld, under the box', async () => {
    setWindowWidth(PHONE_WIDTH)
    await renderChat()
    expect(modes().parentElement).toHaveAttribute('data-layout', 'phone')
    expect(box().compareDocumentPosition(modes()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const css = readFileSync(MODES_CSS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ')
    expect(css).toContain('.row[data-layout="phone"] .mode, .row[data-layout="phone"] .chip { min-height: 44px; }')
  })

  it('go where they say with a click: a push to the page, as a link inside the app does', () => {
    render(<ModeRow />)
    within(modes()).getAllByRole('link').forEach((link) => fireEvent.click(link))
    expect(host.navigations()).toEqual([CODE_HREF, PLAN_HREF, MISSIONS_HREF].map((href) => ({ method: 'push', href })))
  })

  it('come with no agent picker on a chat that can choose no agent (SDK 1.4.0): the box talks to Auto', async () => {
    await renderChat()
    expect(screen.queryByRole('button', { name: new RegExp(`^${TALKING_TO}`) })).toBeNull()
    expect(messagePlaceholder(AUTO_NAME)).toBe(PLACEHOLDER)
  })
})

describe('the agent picker (on SDK 1.5.0)', () => {
  it('names the agent the box talks to on its pill, Auto first, and lists Auto and the active agents that can run', () => {
    renderChoosing()
    expect(pill(AUTO_NAME)).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(pill(AUTO_NAME))
    expect(within(list()).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Auto', 'Scout', `Builder ${SESSION_TAG}`])
    expect(within(list()).getByRole('button', { name: AUTO_NAME })).toHaveAttribute('aria-pressed', 'true')
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
