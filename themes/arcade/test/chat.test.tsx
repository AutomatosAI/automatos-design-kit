// Arcade's /chat on the harness's scripted chat (a frame per tick) and its card stand-ins (protected surfaces that
// keep their clicks): the dialogue box greets a new chat; a sent message is a YOU line and Auto's reply is said in
// the dialogue box, whole under reduced motion, and announced once; what the turn did is a ★ line; a Deliverable is
// an ITEM RECEIVED window linked to its item; an approval is the host's own card under "! A choice awaits"; the
// voice button sits beside the message box, outside its form; the party lists the
// roster with each state word from the host's data. Every value is made up. Roles, names and text only.
import { type ActivityFeed, type NeedsYou, type RosterAgent } from '@automatos/theme-sdk'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { host } from '@automatos/theme-harness/host'

import { ChatPage } from '../src/chat/chat-page.tsx'
import { CHOICE_AWAITS } from '../src/chat/cards.tsx'
import { PLACEHOLDER } from '../src/chat/composer.tsx'
import { DIALOGUE_LABEL } from '../src/chat/dialogue.tsx'
import { ITEM_RECEIVED } from '../src/chat/entries.tsx'
import { PARTY_LABEL } from '../src/chat/party.tsx'
import { GREETING } from '../src/chat/saying.ts'
import { STORY_LABEL } from '../src/chat/story.tsx'
import { PHONE_WIDTH, resetWindowWidth, setWindowWidth } from './support/window-width.ts'

type Turn = Parameters<typeof host.setChatScript>[0][number]
type Frame = Turn['frames'][number]

const STAMP = '2026-10-14T09:00:00+00:00'
const words = (text: string): Frame => ({ text })
const toolData = (data: unknown): Frame => ({ data: { type: 'tool-data', data } })
const TOOL_APPROVAL = { grant_id: 42, action: 'platform_web_search', message: 'Search the web?', requires_approval: true }

function agent(id: number, name: string, jobTitle: string): RosterAgent {
  return { id, name, description: null, job_title: jobTitle, agent_type: 'custom', status: 'active', premium_icon: null, created_at: STAMP, updated_at: STAMP }
}

const NEEDS_YOU: NeedsYou = {
  total: 1,
  counts: { review: 0, question: 1, approval: 0, stuck: 0, failed: 0 },
  rows: {
    review: [], approval: [], stuck: [], failed: [],
    question: [{ source: 'grant', id: 'g1', title: 'Which shop?', ticket_id: null, agent_name: 'Scout', at: STAMP }],
  },
}

const FEED: ActivityFeed = {
  total: 1, limit: 100, offset: 0,
  items: [{
    id: 'run-1', type: 'task', name: 'Write the report', status: 'running', started_at: STAMP, completed_at: null,
    duration_seconds: null, agent: { id: 2, name: 'Quill', avatar_url: null }, agents: [], summary: '', source_id: null,
    source_url: null, trigger: null, error_message: null,
  }],
}

const box = (): HTMLElement => screen.getByRole('textbox', { name: PLACEHOLDER })
const dialogue = (): HTMLElement => screen.getByRole('region', { name: DIALOGUE_LABEL })
const story = (): HTMLElement => screen.getByRole('region', { name: STORY_LABEL })

function ask(text: string): void {
  fireEvent.change(box(), { target: { value: text } })
  fireEvent.keyDown(box(), { key: 'Enter' })
}

async function renderChat(turns: readonly Turn[] = []) {
  host.setChatScript(turns)
  render(<ChatPage />)
  await screen.findByRole('region', { name: DIALOGUE_LABEL })
}

beforeEach(() => {
  host.reset()
  host.setReducedMotion(true)
})

afterEach(() => {
  resetWindowWidth()
})

describe('the dialogue box', () => {
  it('greets a new chat, whole under reduced motion', async () => {
    await renderChat()
    expect(dialogue()).toHaveTextContent(GREETING)
  })

  it("says Auto's reply, and the story keeps your line", async () => {
    await renderChat([{ frames: [words('Three laptops, all under budget.')] }])
    ask('Find three laptops')
    await waitFor(() => expect(dialogue()).toHaveTextContent('Three laptops, all under budget.'))
    expect(within(story()).getByRole('article', { name: 'You said' })).toHaveTextContent('Find three laptops')
    expect(host.chatSent().map((sent) => sent.text)).toEqual(['Find three laptops'])
    await waitFor(() => expect(dialogue().querySelector('[aria-live="polite"]')).toHaveTextContent('Three laptops'))
  })

  it('keeps the voice button beside the message box, outside its form', async () => {
    await renderChat()
    const form = box().closest('form')
    expect(form).not.toBeNull()
    const voice = within(dialogue()).getByRole('button', { name: 'Hold to talk' })
    expect(form?.contains(voice)).toBe(false)
  })

  it('has no voice button of its own on the handheld (the frame places it)', async () => {
    setWindowWidth(PHONE_WIDTH)
    await renderChat()
    expect(within(dialogue()).queryByRole('button', { name: 'Hold to talk' })).toBeNull()
  })
})

describe('the story', () => {
  it('shows a Deliverable the turn made as an ITEM RECEIVED window that opens its item', async () => {
    const made = { generated_document: { deliverable_id: 'd-42', title: 'Laptop shortlist', format: 'pdf' } }
    await renderChat([{ frames: [toolData(made), words('Done.')] }])
    ask('Write it up')
    const item = await within(story()).findByRole('group', { name: `${ITEM_RECEIVED} Laptop shortlist` })
    expect(within(item).getByRole('link', { name: 'Open Laptop shortlist' })).toHaveAttribute('href', '/deliverables?deliverable=d-42')
  })

  it("places the host's own approval card under ! A choice awaits; its buttons are the host's", async () => {
    await renderChat([{ frames: [toolData({ tool_approval: TOOL_APPROVAL })], hold: true }])
    ask('Check student discounts')
    const choice = await within(story()).findByRole('region', { name: CHOICE_AWAITS })
    const surface = within(choice).getByRole('region', { name: 'Action approval needed' })
    expect(surface).toHaveAttribute('data-protected-surface', 'tool-approval')
    fireEvent.click(within(surface).getByRole('button', { name: /approve & run/i }))
    expect(host.cardActions()).toEqual([{ card: 'tool-approval', id: '42', action: 'approved' }])
  })
})

describe("the reply's size", () => {
  // The host's Markdown sets 12.5 px on its own box; the preset's html.arcade wrap puts this rule above it.
  it('takes the size of the line it sits in, naming only its own class', () => {
    const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/chat/chat.module.css'), 'utf8')
    const start = css.indexOf('.markdown {')
    const rule = css.slice(start, css.indexOf('}', start))
    expect(rule).toContain('font-size: inherit')
    expect(rule).toContain('line-height: inherit')
  })

  it('leaves the story room on the handheld: a floor under the story, a lower cap on the typed reply', () => {
    const dir = dirname(fileURLToPath(import.meta.url))
    const chatCss = readFileSync(join(dir, '../src/chat/chat.module.css'), 'utf8')
    const dialogueCss = readFileSync(join(dir, '../src/chat/dialogue.module.css'), 'utf8')
    expect(chatCss).toMatch(/\.chat\[data-layout="phone"\] \.story \{\s*min-height: 140px;/)
    expect(dialogueCss).toMatch(/\.dialogue\[data-layout="phone"\] \.typed \{[^}]*max-height: 14vh;/)
  })

  it("sets the D-pad's words at 11 px, so Inventory fits its 64 px target", () => {
    const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/frame/handheld.module.css'), 'utf8')
    const pad = css.slice(css.indexOf('.pad {'), css.indexOf('}', css.indexOf('.pad {')))
    expect(pad).toContain('font-size: 11px')
    expect(css).toMatch(/grid-template-columns: repeat\(3, 64px\)/)
  })
})

describe('the party', () => {
  it("lists the roster with each state word from the host's data", async () => {
    await renderChat()
    act(() => {
      host.setPageQuery('useAgents', { data: [agent(1, 'Scout', 'Research analyst'), agent(2, 'Quill', 'Writer'), agent(3, 'Pixel', 'Designer')] })
      host.setPageQuery('useNeedsYou', { data: NEEDS_YOU })
      host.setPageQuery('useActivityFeed', { data: FEED })
    })
    const party = screen.getByRole('complementary', { name: PARTY_LABEL })
    expect(party).toHaveTextContent('3 agents')
    expect(within(party).getAllByRole('listitem').map((row) => row.textContent)).toEqual([
      'ScoutResearch analyst! NEEDS YOU',
      'QuillWriter● WORKING',
      'PixelDesigner— IDLE',
    ])
  })
})
