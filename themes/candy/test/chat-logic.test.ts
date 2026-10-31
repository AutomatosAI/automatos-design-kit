// Candy's chat helpers, pure, and its style sheets: the stage's state from the turn and the voice session, the
// conversations newest first with the one on screen marked, a reply's tool chips, a Deliverable's link and gradient,
// when "Auto is writing" stands alone, and the chat's CSS (the reply takes its bubble's size; no colour literal, no
// !important, no @import, no rule on a bare element). Every value is made up.
import type { HostChatMessage, HostChatSummary, HostReceipt } from '@automatos/theme-sdk'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { conversationRows, newestFirst, UNTITLED } from '../src/chat/conversation-rows.ts'
import { deliverableHref, isDeliverableId } from '../src/chat/links.ts'
import { deliverableSet, toolChipsOf, toolWords } from '../src/chat/lines.ts'
import { SPEAKING, stageLabel, stageOf } from '../src/chat/stage-state.ts'
import { awaitingReply, failedBeforeReply } from '../src/chat/thread.tsx'

const CHAT_DIR = join(dirname(fileURLToPath(import.meta.url)), '../src/chat')
/** A local time on Friday 30 October 2026, so the words pass in any time zone. */
const at = (day: number, hour: number, minute = 0, second = 0): Date => new Date(2026, 9, day, hour, minute, second)
const NOW = at(30, 12).getTime()

function message(fields: Partial<HostChatMessage>): HostChatMessage {
  return {
    id: 'm-1', role: 'assistant', text: '', knownParts: [], activity: [], error: null, writing: false, stopped: false, receipts: null,
    above: [], deliverables: [], approvals: [], taskCards: [], toolCalls: [], provenance: null, savedError: null,
    limitReached: null, reasoningChars: 0, withdrawOffer: null, linkedDeliverables: [], ...fields,
  }
}

function receipt(fields: Partial<HostReceipt>): HostReceipt {
  return { action: 'write', kind: 'write', status: 'done', subject: '#0422', effect: 'moved to Done', link: null, reason: null, ...fields }
}

function chat(id: string, title: string, updatedAt: string): HostChatSummary {
  return { id, title, updatedAt, preview: null }
}

describe('the stage', () => {
  it("shows the turn's state as a glyph and a word, and names Auto with its caption", () => {
    const stage = stageOf('working', 'idle')
    expect(stage).toEqual({ state: 'working', glyph: '●', word: 'Working', caption: 'Working on it' })
    expect(stageLabel(stage)).toBe('Auto, Working on it')
    expect(stageOf('celebrate', 'idle')).toMatchObject({ glyph: '✓', word: 'Done' })
    expect(stageOf('idle', 'idle')).toMatchObject({ glyph: '○', word: 'Ready' })
  })

  it('follows the voice session over the turn while it runs', () => {
    expect(stageOf('working', 'connecting').state).toBe('loading')
    expect(stageOf('idle', 'listening')).toMatchObject({ state: 'listening', word: 'Listening' })
    expect(stageOf('idle', 'thinking')).toMatchObject({ state: 'thinking', word: 'Thinking' })
    expect(stageOf('working', 'speaking')).toEqual({ state: 'idle', glyph: '●', word: SPEAKING, caption: SPEAKING })
    expect(stageOf('idle', 'error').state).toBe('oops')
    expect(stageOf('searching', 'ended').state).toBe('searching')
  })
})

describe('the conversations', () => {
  const chats = [
    chat('a', 'Holiday campaign', at(26, 9).toISOString()),
    chat('b', 'Spring launch post', at(30, 11, 59, 40).toISOString()),
    chat('c', '  ', at(30, 10).toISOString()),
  ]

  it('lists them newest first, without changing the list it was given', () => {
    const before = chats.map((one) => one.id)
    expect(newestFirst(chats).map((one) => one.id)).toEqual(['b', 'c', 'a'])
    expect(chats.map((one) => one.id)).toEqual(before)
  })

  it('gives each row its dot, title, time and link, the one on screen current', () => {
    const rows = conversationRows(chats, 'c', NOW)
    expect(rows.map((row) => [row.title, row.when, row.set, row.current])).toEqual([
      ['Spring launch post', 'Now', 1, false],
      [UNTITLED, '2 h', 2, true],
      ['Holiday campaign', 'Mon', 3, false],
    ])
    expect(rows[0]?.href).toBe('/chat?chatId=b')
    expect(conversationRows(chats, null, NOW).some((row) => row.current)).toBe(false)
  })
})

describe('the tool chips', () => {
  it("says the receipts in the host's words (a refused one's reason once), none for a skip or an ask", () => {
    const chips = toolChipsOf(message({
      receipts: [
        receipt({ link: '/command-center?task=422' }),
        receipt({ status: 'refused', subject: 'Instagram', reason: 'not connected' }),
        receipt({ status: 'skipped' }),
        receipt({ status: 'waiting' }),
      ],
    }))
    expect(chips.map((chip) => [chip.tone, chip.text, chip.href])).toEqual([
      ['done', '#0422: moved to Done', '/command-center?task=422'],
      ['failed', 'Instagram: tried, refused: not connected', null],
    ])
  })

  it('says the tool calls by their summaries when there are no receipts', () => {
    const chips = toolChipsOf(message({
      toolCalls: [
        { toolCallId: 't1', toolName: 'web_search', state: 'completed', summary: 'Found 3 laptops', skipped: false, waiting: false },
        { toolCallId: 't2', toolName: 'read_page', state: 'running', skipped: false, waiting: false },
        { toolCallId: 't3', toolName: 'post_draft', state: 'error', error: 'too long', skipped: false, waiting: false },
        { toolCallId: 't4', toolName: 'web_search', state: 'completed', skipped: true, waiting: false },
        { toolCallId: 't5', toolName: 'ask_owner', state: 'completed', skipped: false, waiting: true },
        { toolCallId: 't6', toolName: 'make_chart', state: 'completed', skipped: false, waiting: false },
      ],
    }))
    expect(chips.map((chip) => [chip.tone, chip.text])).toEqual([
      ['done', 'Found 3 laptops'],
      ['running', 'read page…'],
      ['failed', 'post draft: too long'],
      ['done', 'Used make chart'],
    ])
    expect(toolWords('__')).toBe('a tool')
  })
})

describe('a Deliverable', () => {
  it('links to its page only with a checked id, and wears its kind\'s gradient', () => {
    expect(deliverableHref('d 42')).toBe('/deliverables?deliverable=d%2042')
    expect(isDeliverableId('d-42_x')).toBe(true)
    expect(isDeliverableId('../d')).toBe(false)
    expect(deliverableSet({ id: 'd', title: 'T', kind: 'document' })).toBe(2)
    expect(deliverableSet({ id: 'd', title: 'T', kind: 'image' })).toBe(3)
    expect(deliverableSet({ id: 'd', title: 'T', kind: 'video' })).toBe(1)
  })
})

describe('the thread', () => {
  it('stands "Auto is writing" alone only while your message waits on a running turn', () => {
    const asked = [message({ role: 'user', text: 'Hi' })]
    expect(awaitingReply(asked, true)).toBe(true)
    expect(awaitingReply(asked, false)).toBe(false)
    expect(awaitingReply([...asked, message({ id: 'm-2', writing: true })], true)).toBe(false)
  })

  it('says a turn failed before a reply only when no reply holds the failure', () => {
    const asked = [message({ role: 'user', text: 'Hi' })]
    expect(failedBeforeReply('error', asked, false)).toBe(true)
    expect(failedBeforeReply('error', asked, true)).toBe(false)
    expect(failedBeforeReply('error', [...asked, message({ id: 'm-2', error: { message: 'No', code: null } })], false)).toBe(false)
    expect(failedBeforeReply('idle', asked, false)).toBe(false)
  })
})

describe("the chat's style sheets", () => {
  const sheets = readdirSync(CHAT_DIR).filter((name) => name.endsWith('.module.css'))
  const read = (name: string): string => readFileSync(join(CHAT_DIR, name), 'utf8')

  it("set the reply in its bubble's size, naming only its own class", () => {
    const css = read('thread.module.css')
    const start = css.indexOf('.markdown {')
    const rule = css.slice(start, css.indexOf('}', start))
    expect(rule).toContain('font-size: inherit')
    expect(rule).toContain('line-height: inherit')
  })

  it('hold no colour literal, no !important, no @import and no rule on a bare element', () => {
    expect(sheets.length).toBeGreaterThanOrEqual(4)
    for (const name of sheets) {
      const css = read(name).replace(/\/\*[\s\S]*?\*\//g, '')
      expect(css, name).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(\s*[0-9]|hsla?\(\s*[0-9]|\bwhite\b|\bblack\b/)
      expect(css, name).not.toMatch(/!important|@import/)
      const selectors = css.split('{').slice(0, -1).map((chunk) => chunk.split(/[;}]/).pop()?.trim() ?? '')
      const bare = selectors.filter((selector) => !selector.startsWith('@') && /(^|[\s,>+~])[a-z][a-z0-9]*(?=$|[\s,:.[>+~])/.test(selector) && !/^(from|to|\d)/.test(selector))
      expect(bare, name).toEqual([])
    }
  })

  it('keep the writing dots still under reduced motion and on the Motion clock', () => {
    const css = read('thread.module.css')
    expect(css).toContain('animation-play-state: var(--candy-play, running)')
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.writing\[data-moving="true"\] \.dot \{\s*animation: none;/)
  })
})
