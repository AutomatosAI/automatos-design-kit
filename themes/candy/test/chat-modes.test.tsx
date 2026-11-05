// Candy 1.1.0 on SDK 1.5.0, the row under the message box, on the harness (after themes/hud/test/chat/chat-modes.test.tsx,
// HUD 1.4.0). Code and Mission are links in a group named Modes, with Plan between them, a toggle on the host's own Plan
// switch, under the pill and after Send, on a desktop and on the phone. The agent picker comes first: its pill names the
// agent, its list holds Auto and the active agents that can run, a session agent as a link to its session; a choice
// names the box after the agent and focuses it, and the next message goes to it; a refused one changes nothing; Esc
// shuts the list. Roles, names and attributes only; every value is made up.
import type { RosterAgent } from '@automatos/theme-sdk'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { host } from '@automatos/theme-harness/host'

import { type AgentChoice, AUTO_NAME, messagePlaceholder, sessionHref } from '../src/chat/agent-choice.ts'
import { AGENTS_LIST_LABEL, SESSION_TAG, TALKING_TO, useAgentSeat } from '../src/chat/agent-picker.tsx'
import { ChatPage } from '../src/chat/chat-page.tsx'
import { CODE, CODE_HREF, MISSION, MISSIONS_HREF, MODES_LABEL, PLAN_LABEL, PLAN_TITLE } from '../src/chat/chat-modes.ts'
import { Composer, PLACEHOLDER, SEND } from '../src/chat/composer.tsx'
import { PHONE_WIDTH, resetWindowWidth, setWindowWidth } from './support/window-width.ts'

type Turn = Parameters<typeof host.setChatScript>[0][number]

const MODES_CSS = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'chat', 'modes.module.css')
const STAMP = '2026-10-14T09:00:00+00:00'
const ASKED = 'Which laptop wins?'
const HELD: Turn = { frames: [], hold: true }

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

const box = (): HTMLElement => screen.getByRole('textbox', { name: PLACEHOLDER })
const modes = (): HTMLElement => screen.getByRole('group', { name: MODES_LABEL })
const plan = (): HTMLElement => within(modes()).getByRole('button', { name: PLAN_LABEL })
const pill = (name: string): HTMLElement => screen.getByRole('button', { name: `${TALKING_TO} ${name}` })
const list = (): HTMLElement => screen.getByRole('list', { name: AGENTS_LIST_LABEL })

/** A new chat on screen, its next send held open and the roster answered. */
async function renderChat(): Promise<void> {
  host.setChatScript([HELD])
  render(<ChatPage />)
  await screen.findByRole('textbox', { name: PLACEHOLDER })
  act(() => host.setPageQuery('useAgents', { data: ROSTER }))
}

/** Type into a box and press Enter. */
function sendFrom(field: HTMLElement): void {
  fireEvent.change(field, { target: { value: ASKED } })
  fireEvent.keyDown(field, { key: 'Enter' })
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
})

afterEach(() => {
  resetWindowWidth()
})

describe('the modes under the message box', () => {
  it("are Code and Mission, links to the host's page for each, with Plan between them, under the pill and after Send", async () => {
    await renderChat()
    const controls = Array.from(modes().querySelectorAll<HTMLElement>('a, button'))
    expect(controls.map((control) => [control.tagName, control.textContent, control.title])).toEqual([
      ['A', CODE.label, CODE.opens], ['BUTTON', PLAN_LABEL, PLAN_TITLE], ['A', MISSION.label, MISSION.opens],
    ])
    expect(within(modes()).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([CODE_HREF, MISSIONS_HREF])
    expect([CODE_HREF, MISSIONS_HREF]).toEqual(['/chat?repo=.', '/assignments?tab=missions'])
    expect(box().closest('form')).not.toContainElement(modes())
    expect(screen.getByRole('button', { name: SEND }).compareDocumentPosition(modes()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(modes().parentElement).toHaveAttribute('data-layout', 'desktop')
  })

  it('are 44 px targets on the phone, under the floating pill', async () => {
    setWindowWidth(PHONE_WIDTH)
    await renderChat()
    expect(modes().parentElement).toHaveAttribute('data-layout', 'phone')
    expect(box().compareDocumentPosition(modes()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const css = readFileSync(MODES_CSS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ')
    expect(css).toContain('.row[data-layout="phone"] .mode, .row[data-layout="phone"] .chip { min-height: var(--candy-target); }')
  })

  it('go where they say with a click: a push to the page, as a link inside the app does', async () => {
    await renderChat()
    fireEvent.click(within(modes()).getByRole('link', { name: MISSION.label }))
    expect(host.navigations()).toContainEqual({ method: 'push', href: MISSIONS_HREF })
  })

  it("turn the host's Plan on and off with Plan, and the next message goes with Plan", async () => {
    await renderChat()
    expect(plan()).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(plan())
    expect(plan()).toHaveAttribute('aria-pressed', 'true')
    expect(host.chatPlanMode()).toBe(true)
    sendFrom(box())
    expect(host.chatSent()).toEqual([{ chatId: null, text: ASKED, retry: false, planMode: true }])
    fireEvent.click(plan())
    expect(host.chatPlanMode()).toBe(false)
  })
})

describe('the agent picker', () => {
  it('names the agent the box talks to on its pill, Auto first, and lists Auto and the active agents that can run', async () => {
    await renderChat()
    expect(messagePlaceholder(AUTO_NAME)).toBe(PLACEHOLDER)
    expect(pill(AUTO_NAME)).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(pill(AUTO_NAME))
    expect(within(list()).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Auto', 'Scout', `Builder ${SESSION_TAG}`])
    expect(within(list()).getByRole('button', { name: AUTO_NAME })).toHaveAttribute('aria-pressed', 'true')
  })

  it('chooses an agent: the pill and the box take its name, the box the focus, and the next message goes to it', async () => {
    await renderChat()
    fireEvent.click(pill(AUTO_NAME))
    fireEvent.click(within(list()).getByRole('button', { name: 'Scout' }))
    const scoutBox = screen.getByRole('textbox', { name: 'Message Scout' })
    expect(scoutBox).toHaveFocus()
    expect(pill('Scout')).toHaveAttribute('aria-expanded', 'false')
    sendFrom(scoutBox)
    expect(host.chatSent()).toEqual([{ chatId: null, text: ASKED, retry: false, agentId: 1 }])
  })

  it("opens a session agent's session with a link to /chat?agent=<id>, never a choice, and shuts the list on Esc", async () => {
    await renderChat()
    fireEvent.click(pill(AUTO_NAME))
    expect(within(list()).getByRole('link', { name: `Builder ${SESSION_TAG}` })).toHaveAttribute('href', sessionHref(ROSTER[3]))
    expect(sessionHref(ROSTER[3])).toBe('/chat?agent=4')
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
