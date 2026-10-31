// @vitest-environment node
/**
 * Play 1.4.0 (PRD-268 §6.6, §6.11.2, §6.12.4, SDK 1.4.0) — src/lib/play/proactive.ts, Play's readings of a message's
 * parts (HostChatMessage.knownParts), on messages shaped as the SDK hands them: the brief by its `brief@1` part and
 * never by its words, the suggestions a message posts, the reply chips under Auto's last message only, and the
 * suggestions the pinned line leaves to what the screen already shows. Pure.
 */
import type { HostChatMessage, HostMessagePart } from '@automatos/theme-sdk'
import { describe, expect, it } from 'vitest'

import {
  briefOf, briefsOnScreen, isHeldBrief, listedSuggestionIds, replyChipsOf, replyChipsShown, suggestionIdsOf, threadSuggestionsOf,
} from '../../src/lib/play/proactive.ts'
import { BRIEF, LISTED, LISTED_ID, NEWER, NEWER_ID, SUGGESTIONS } from '../support/proactive.ts'

const CHIPS = ['Window', 'Aisle'] as const
const EARLIER = { ...BRIEF, date: '2026-10-13', state_hash: 'play-test-brief-earlier' }

/** A message as the SDK hands it to a theme, its parts as given (knownParts is required). */
function message(id: string, knownParts: readonly HostMessagePart[], fields: Partial<HostChatMessage> = {}): HostChatMessage {
  return {
    id,
    role: 'assistant',
    text: '',
    knownParts,
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

const text = (words: string): HostMessagePart => ({ type: 'text' as const, text: words })
const briefPart = (brief = BRIEF): HostMessagePart => ({ type: 'brief@1' as const, brief })
const suggestionPart = (id: string): HostMessagePart => ({ type: 'suggestion@1' as const, suggestion_id: id })
const chipsPart = (replies: readonly string[] = CHIPS): HostMessagePart => ({ type: 'reply_chips@1' as const, replies })

describe('the brief, by its part', () => {
  it("is the message's brief@1 part, whatever its words", () => {
    expect(briefOf(message('b', [text(BRIEF.prose), briefPart()]))).toEqual(BRIEF)
    expect(briefOf(message('b', [briefPart(EARLIER)], { text: 'Anything at all' }))).toEqual(EARLIER)
  })

  it("is never found by its words: a message whose words are the day's prose, with no part, is no brief", () => {
    expect(briefOf(message('b', [text(BRIEF.prose)], { text: BRIEF.prose }))).toBeNull()
  })

  it("counts on Auto's messages only", () => {
    expect(briefOf(message('b', [briefPart()], { role: 'user' }))).toBeNull()
  })

  it('is the held one when it is the day the host holds: the one its Listen reads', () => {
    expect(isHeldBrief(BRIEF, BRIEF)).toBe(true)
    expect(isHeldBrief(EARLIER, BRIEF)).toBe(false)
    expect(isHeldBrief(BRIEF, null)).toBe(false)
  })

  it('on screen: the day\'s brief on an empty chat, every brief@1 message\'s in a conversation, any day\'s', () => {
    expect(briefsOnScreen(BRIEF, [])).toEqual([BRIEF])
    expect(briefsOnScreen(null, [])).toEqual([])
    const thread = [message('e', [briefPart(EARLIER)]), message('t', [text('Hello')]), message('b', [briefPart()])]
    expect(briefsOnScreen(null, thread)).toEqual([EARLIER, BRIEF])
    expect(briefsOnScreen(BRIEF, [message('t', [text(BRIEF.prose)])])).toEqual([])
  })
})

describe('the suggestions a message posts', () => {
  it("are its suggestion@1 parts' ids, in order, each once, on Auto's messages only", () => {
    const posted = message('s', [text('Two ideas'), suggestionPart(NEWER_ID), suggestionPart(LISTED_ID), suggestionPart(NEWER_ID)])
    expect(suggestionIdsOf(posted)).toEqual([NEWER_ID, LISTED_ID])
    expect(suggestionIdsOf(message('u', [suggestionPart(NEWER_ID)], { role: 'user' }))).toEqual([])
  })

  it('draw from the open list by id, a just-started one kept, and none once decided', () => {
    expect(threadSuggestionsOf([NEWER_ID, LISTED_ID], SUGGESTIONS, null)).toEqual([NEWER, LISTED])
    expect(threadSuggestionsOf([NEWER_ID], [LISTED], null)).toEqual([])
    expect(threadSuggestionsOf([NEWER_ID], [{ ...NEWER, status: 'started' as const }], null)).toEqual([])
    const kept = { ...NEWER, status: 'started' as const }
    expect(threadSuggestionsOf([NEWER_ID], [], kept)).toEqual([kept])
    expect(threadSuggestionsOf([NEWER_ID], null, null)).toEqual([])
  })
})

describe('the reply chips', () => {
  it("are the message's reply_chips@1 part, on Auto's messages only", () => {
    expect(replyChipsOf(message('c', [text('Window or aisle?'), chipsPart()]))).toEqual(CHIPS)
    expect(replyChipsOf(message('c', [text('No chips')]))).toEqual([])
    expect(replyChipsOf(message('u', [chipsPart()], { role: 'user' }))).toEqual([])
  })

  it('show under Auto\'s last message only, once he has finished it, and go once a newer message exists', () => {
    const asked = message('c', [text('Window or aisle?'), chipsPart()])
    expect(replyChipsShown(asked, [message('q', [text('Book me a seat')], { role: 'user' }), asked])).toEqual(CHIPS)
    const answered = [asked, message('a', [text('Window')], { role: 'user' })]
    expect(replyChipsShown(asked, answered)).toEqual([])
    const writing = { ...asked, writing: true }
    expect(replyChipsShown(writing, [writing])).toEqual([])
  })
})

describe('what the pinned line leaves to the screen', () => {
  it("is every suggestion a brief on screen lists and every one a message posts, each once", () => {
    const thread = [message('b', [briefPart()]), message('s', [suggestionPart(NEWER_ID), suggestionPart(LISTED_ID)])]
    expect(listedSuggestionIds(null, thread)).toEqual([LISTED_ID, NEWER_ID])
    expect(listedSuggestionIds(BRIEF, [])).toEqual([LISTED_ID])
    expect(listedSuggestionIds(BRIEF, [message('t', [text(BRIEF.prose)])])).toEqual([])
    expect(listedSuggestionIds(null, [message('s', [suggestionPart(NEWER_ID)])])).toEqual([NEWER_ID])
  })
})
