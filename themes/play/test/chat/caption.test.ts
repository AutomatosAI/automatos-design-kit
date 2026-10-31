/**
 * PRD-260 §4 — the words around Play's chat, ported from Automatos Play's
 * tests/chat (caption and labels): what Auto's caption says, a tool call's
 * detail, and the conversation read for the chat (the newest reply and its
 * running tool call, and the reply being written as Auto reads it: T-003b), and
 * a done tool line's time in Play's one-decimal seconds (F12, P260-FX-31).
 *
 * Moved from core's components/play/chat/__tests__/caption.test.ts and rewritten for the kit: Play's chat
 * reads the SDK's messages (HostChatMessage), which the host has already read off its own ChatMessage
 * (core's lib/theme-sdk/internal/chat-view.ts over lib/chat/message-text.ts). The caption, the tool labels and
 * Play's own readings of the conversation (src/components/play/chat/reply.ts) keep every assertion, on
 * messages shaped as the SDK hands them. What the host reads off its own messages (a message's words from
 * its parts or its content, the conversation's title, the activity lines, a saved turn error's words, who
 * wrote a reply, the reasoning's length and a cap's words) and the core chat's whole-seconds formatter are
 * core's to prove: the ledger (test/moved-from-core/lib.json) names the core tests that hold them.
 */
import type { HostChatMessage, HostToolCall } from '@automatos/theme-sdk'
import { describe, expect, it } from 'vitest'

import { chatCaption, NAPPING, ON_THE_SHELF, WAKE_HINT } from '../../src/components/play/chat/caption.ts'
import { clip, SECONDS_DECIMALS, toolDetail, toolSeconds } from '../../src/components/play/chat/labels.ts'
import { latestReply, replyProgress, runningToolInput } from '../../src/components/play/chat/reply.ts'
import { NO_REPLY } from '@automatos/mascot/events'
import { captionFor } from '@automatos/mascot/media'

/** A message as the SDK hands it to a theme, with only what the case sets. */
function message(fields: Partial<HostChatMessage>): HostChatMessage {
  return {
    id: 'm',
    role: 'assistant',
    text: '',
    knownParts: [],
    activity: [],
    error: null,
    writing: false,
    stopped: false,
    receipts: null,
    above: [],
    deliverables: [],
    approvals: [],
    taskCards: [],
    toolCalls: [],
    provenance: null,
    savedError: null,
    limitReached: null,
    reasoningChars: 0,
    withdrawOffer: null,
    linkedDeliverables: [],
    ...fields,
  }
}

/** One of a reply's tool calls, as the SDK hands it. */
function toolCall(toolCallId: string, state: HostToolCall['state'], input?: unknown): HostToolCall {
  return { toolCallId, toolName: 'x', state, input, skipped: false, waiting: false }
}

describe('chatCaption', () => {
  it("says the state's own words by default", () => {
    expect(chatCaption('thinking')).toEqual({ caption: captionFor('thinking') })
  })

  it('names the running query beside a busy state', () => {
    expect(chatCaption('searching', { runningInput: { query: '  best   budget laptops ' } })).toEqual({
      caption: captionFor('searching'),
      detail: 'best budget laptops',
    })
    expect(chatCaption('reading', { runningInput: {} })).toEqual({ caption: captionFor('reading') })
  })

  it('says a nap is a nap, and not when Automatos is down', () => {
    expect(chatCaption('sleeping')).toEqual({ caption: NAPPING, detail: WAKE_HINT })
    expect(chatCaption('sleeping', { backendDown: true })).toEqual({ caption: captionFor('sleeping') })
  })

  it('celebrates the Deliverable by its kind', () => {
    expect(chatCaption('celebrate', { deliverableKind: 'report' })).toEqual({
      caption: 'Your report is ready',
      detail: ON_THE_SHELF,
    })
    expect(chatCaption('celebrate')).toEqual({ caption: captionFor('celebrate') })
  })
})

describe('toolDetail', () => {
  it('reads the first text field in order, clipped to one line', () => {
    expect(toolDetail({ url: 'https://example.com', query: 'laptops' })).toBe('laptops')
    expect(toolDetail({ title: 'x'.repeat(100) })).toBe(`${'x'.repeat(79)}…`)
    expect(clip('a\n\nb', 10)).toBe('a b')
  })

  it('is null for an input with no text field, or no input at all', () => {
    expect(toolDetail({ limit: 3, query: '   ' })).toBeNull()
    expect(toolDetail(undefined)).toBeNull()
    expect(toolDetail(['query'])).toBeNull()
  })
})

describe('toolSeconds (F12)', () => {
  it("reads a done call's time with one decimal, as the approved design: '2.1 s' from 2140 ms", () => {
    expect(SECONDS_DECIMALS).toBe(1)
    expect(toolSeconds(2140)).toBe('2.1 s')
    expect(toolSeconds(200)).toBe('0.2 s')
    expect(toolSeconds(12_400)).toBe('12.4 s')
    expect(toolSeconds(0)).toBe('0.0 s')
  })

  it('is empty with no usable time', () => {
    expect(toolSeconds(undefined)).toBe('')
    expect(toolSeconds(-1)).toBe('')
    expect(toolSeconds(Number.NaN)).toBe('')
  })
})

describe("the SDK's messages, read for Play", () => {
  it('finds the newest reply and its running tool call', () => {
    const reply = message({
      id: 'r2',
      activity: ['Checking prices first.', '3 of 5 pages'],
      toolCalls: [toolCall('a', 'completed', { query: 'old' }), toolCall('b', 'running', { query: 'new' })],
    })
    const messages = [message({ id: 'r1' }), message({ id: 'u', role: 'user' }), reply]
    expect(latestReply(messages)?.id).toBe('r2')
    expect(runningToolInput(reply)).toEqual({ query: 'new' })
    expect(runningToolInput(undefined)).toBeUndefined()
  })
})

describe('replyProgress: the reply being written, as Auto reads it (T-003b)', () => {
  const asked = message({ id: 'u', role: 'user', text: 'Battery?' })

  it('is no reply until the newest message is a reply: a turn awaiting its reply never reads the last one', () => {
    expect(replyProgress([])).toBe(NO_REPLY)
    expect(replyProgress([message({ id: 'r1', text: 'Old words' }), asked])).toBe(NO_REPLY)
  })

  it("says whether the reply's words have started (blank is not started), by its id", () => {
    expect(replyProgress([asked, message({ id: 'r2' })])).toEqual({ ...NO_REPLY, id: 'r2' })
    expect(replyProgress([asked, message({ id: 'r2', text: '  ' })]).hasText).toBe(false)
    expect(replyProgress([asked, message({ id: 'r2', text: 'Look for' })])).toEqual({
      ...NO_REPLY,
      id: 'r2',
      hasText: true,
    })
  })

  it('says whether one of its tool calls is still running', () => {
    const calls = (state: HostToolCall['state']) => [toolCall('a', 'completed'), toolCall('b', state)]
    expect(replyProgress([asked, message({ id: 'r2', toolCalls: calls('running') })]).toolRunning).toBe(true)
    expect(replyProgress([asked, message({ id: 'r2', toolCalls: calls('error') })]).toolRunning).toBe(false)
  })

  it("reads how long the model's reasoning on it is, and whether a cap ended its turn (P260-FX-16)", () => {
    expect(replyProgress([asked, message({ id: 'r2', reasoningChars: 16 })]).reasoningChars).toBe(16)
    expect(replyProgress([asked, message({ id: 'r2' })]).reasoningChars).toBe(0)
    const capped = 'I stopped after 8 rounds.'
    expect(replyProgress([asked, message({ id: 'r2', limitReached: capped })]).limitReached).toBe(true)
    expect(replyProgress([asked, message({ id: 'r2', limitReached: '' })]).limitReached).toBe(false)
    expect(replyProgress([asked, message({ id: 'r2' })]).limitReached).toBe(false)
  })
})
