/**
 * PRD-261 A-14a, A-14b, A-14c — what Play copied from core stays core's. Play reaches the host only
 * through the theme SDK, so a few of core's values and readings are copied into Play's own code: the
 * receipts' closing notes, a Deliverable's id check, its link and its type words, the Mission's context
 * size, the readings of the conversation (the newest reply, the reply being written as Auto reads it, its
 * running tool's input, the recent messages), the untitled name, the "Made by" words, a failed download's
 * words and the one-line text rule.
 *
 * Moved from core's lib/__tests__/prd261-port-{chat,conversations,deliverables}.test.ts, their "copied from
 * the core stays the same" cases, which held each copy to core's own module. Core's modules are not in the
 * kit, so each case holds the copy to test/fixtures/core/copied-values.json instead: core's values at
 * 101a0bf33, and what core's functions answer for the port tests' own inputs (for the conversations, the
 * messages core's SDK hands a theme beside core's readings of its own messages). The one-line rule is held
 * to the theme's src/lib/text/plain-line.ts, which the snapshot holds to core's by its sha256. The ports'
 * import scans (each area reaches the host only through the SDK) are the kit's test/imports.test.ts and the
 * vite-preset's source guard now, and core's A-19f2 guard finds no Play left to scan (the ledger:
 * test/moved-from-core/ported.json).
 */
import { createHash } from 'node:crypto'
import type { HostChatMessage, HostDeliverable, MissionSuggestionMessage } from '@automatos/theme-sdk'
import { describe, expect, it } from 'vitest'

import { deliverableHref, isDeliverableId, KIND_WORDS } from '../src/components/play/chat/deliverable-link.ts'
import { NO_ACTIONS, NOTHING_ON_THE_BOARD } from '../src/components/play/chat/receipts.tsx'
import {
  CONTEXT_MESSAGES_KEPT,
  latestReply,
  liveMessages,
  mergeDeliverables,
  recentMessages,
  replyProgress,
  runningToolInput,
} from '../src/components/play/chat/reply.ts'
import type { ReplyProgress } from '../src/lib/mascot/events.ts'
import { MADE_ELSEWHERE_WORDS, UNTITLED_DELIVERABLE } from '../src/lib/play/detail.ts'
import { cutDraft } from '../src/lib/play/draft.ts'
import * as shelf from '../src/lib/play/shelf.ts'
import { oneLine } from '../src/lib/text/plain-line.ts'
import { readThemeFile } from './source-files.ts'

/** A message as the snapshot lists it: its id and role, and the fields that differ from hostMessage's. */
type MessageFields = Partial<HostChatMessage> & Pick<HostChatMessage, 'id' | 'role'>

interface CoreReadings {
  readonly latestReplyId: string | null
  readonly replyProgress: ReplyProgress
  readonly runningToolInput: unknown
  readonly recentMessages: readonly MissionSuggestionMessage[]
}

interface DeliverablesMerge {
  readonly known: readonly HostDeliverable[]
  readonly found: readonly HostDeliverable[]
  readonly merged: readonly HostDeliverable[]
}

/** test/fixtures/core/copied-values.json (its _comment names each core file). */
interface CoreValues {
  readonly receipts: { readonly NO_ACTIONS: string; readonly NOTHING_ON_THE_BOARD: string }
  readonly deliverables: {
    readonly UNTITLED: string
    readonly KIND_WORDS: Readonly<Record<HostDeliverable['kind'], string>>
    readonly ids: readonly { readonly id: string; readonly valid: boolean }[]
    readonly hrefs: readonly { readonly id: string; readonly href: string }[]
    readonly merges: readonly DeliverablesMerge[]
  }
  readonly download: { readonly DOWNLOAD_FAILED: string }
  readonly madeBy: { readonly MADE_BY_SOURCE: Readonly<Record<string, string>> }
  readonly suggestion: { readonly CONTEXT_MESSAGES_KEPT: number }
  readonly plainLine: { readonly corePath: string; readonly sha256: string }
  readonly hostMessage: HostChatMessage
  readonly conversations: readonly { readonly messages: readonly MessageFields[]; readonly core: CoreReadings }[]
  readonly stopConversation: readonly MessageFields[]
}

const SNAPSHOT = 'test/fixtures/core/copied-values.json'
const PLAIN_LINE = 'src/lib/text/plain-line.ts'
const CORE = JSON.parse(readThemeFile(SNAPSHOT)) as CoreValues
/** The ids the port tests check: the first two are all the Deliverables area's link case uses. */
const SHELF_LINKED_IDS = 2
/** Code points the one-line rule is compared on: the BMP without surrogates, and the astral ranges it names. */
const ASTRAL_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x1f000, 0x1faff],
  [0x2fff0, 0x30010],
  [0xe0000, 0xe01ff],
  [0xf0000, 0xf00ff],
  [0x10fff0, 0x10ffff],
]
const BMP_END = 0xffff
const SURROGATES: readonly [number, number] = [0xd800, 0xdfff]

/** The conversation as the SDK hands it to a theme. */
function shown(messages: readonly MessageFields[]): readonly HostChatMessage[] {
  return messages.map((fields) => ({ ...CORE.hostMessage, ...fields }))
}

function comparedCharacters(): string[] {
  const chars: string[] = []
  for (let code = 0; code <= BMP_END; code += 1) {
    if (code < SURROGATES[0] || code > SURROGATES[1]) chars.push(String.fromCodePoint(code))
  }
  for (const [low, high] of ASTRAL_RANGES) {
    for (let code = low; code <= high; code += 1) chars.push(String.fromCodePoint(code))
  }
  return chars
}

describe('PRD-261 A-14a — what the chat area copied from the core stays the same (prd261-port-chat)', () => {
  it("closes the receipts in the core's words", () => {
    expect(NO_ACTIONS).toBe(CORE.receipts.NO_ACTIONS)
    expect(NOTHING_ON_THE_BOARD).toBe(CORE.receipts.NOTHING_ON_THE_BOARD)
  })

  it("checks a Deliverable id with the core's pattern, links it to the core's page and names its type in the core's words", () => {
    const { ids, hrefs } = CORE.deliverables
    expect(ids.map(({ id }) => isDeliverableId(id))).toEqual(ids.map(({ valid }) => valid))
    for (const { id, href } of hrefs) expect(deliverableHref(id)).toBe(href)
    expect(KIND_WORDS).toEqual(CORE.deliverables.KIND_WORDS)
  })

  it("merges a reply's Deliverables as the core does: one per id, the first seen wins, the same list when nothing is new", () => {
    for (const { known, found, merged } of CORE.deliverables.merges) {
      expect(mergeDeliverables(known, found)).toEqual(merged)
    }
    const shelfCard: HostDeliverable = { id: 'd-1', title: 'Shortlist', kind: 'document' }
    const known = [shelfCard]
    expect(mergeDeliverables(known, [shelfCard])).toBe(known)
  })

  it("plans a Mission from the core's number of recent messages, in the core's shape", () => {
    expect(CONTEXT_MESSAGES_KEPT).toBe(CORE.suggestion.CONTEXT_MESSAGES_KEPT)
    for (const { messages, core } of CORE.conversations) {
      expect(recentMessages(shown(messages))).toEqual(core.recentMessages)
    }
  })

  it('reads the newest reply, the reply being written and its running tool as the core reads them', () => {
    for (const { messages, core } of CORE.conversations) {
      const host = shown(messages)
      expect(latestReply(host)?.id ?? null).toBe(core.latestReplyId)
      expect(replyProgress(host)).toEqual(core.replyProgress)
      expect(runningToolInput(latestReply(host)) ?? null).toEqual(core.runningToolInput)
    }
  })

  it('reads the conversation as the chat hook holds it: without the replies Stop kept, the same list when none is', () => {
    const all = shown(CORE.stopConversation)
    expect(liveMessages(all)).toBe(all)
    const kept = all.map((message) => (message.id === 'r2' ? { ...message, stopped: true } : message))
    expect(liveMessages(kept).map((reply) => reply.id)).toEqual(['u1', 'r1', 'u2'])
  })
})

describe("PRD-261 A-14c — Play's copies of the core stay the core's (prd261-port-conversations)", () => {
  it('names an untitled Deliverable and the three "Made by" sources in the core\'s words', () => {
    expect(UNTITLED_DELIVERABLE).toBe(CORE.deliverables.UNTITLED)
    for (const [source, word] of Object.entries(MADE_ELSEWHERE_WORDS)) {
      expect(word, source).toBe(CORE.madeBy.MADE_BY_SOURCE[source])
    }
  })

  it("folds every character into one line exactly as the core's lib/text/plain-line.ts does", () => {
    const rule = createHash('sha256').update(readThemeFile(PLAIN_LINE)).digest('hex')
    expect({ file: PLAIN_LINE, sha256: rule }).toEqual({ file: PLAIN_LINE, sha256: CORE.plainLine.sha256 })
    const differ = comparedCharacters().filter((char) => {
      const text = `a${char}b`
      return cutDraft(text) !== oneLine(text)
    })
    expect(differ.map((char) => char.codePointAt(0)?.toString(16))).toEqual([])
  })
})

describe('PRD-261 A-14b — what the deliverables area copied from the core stays the same (prd261-port-deliverables)', () => {
  const { ids } = CORE.deliverables

  it("checks a Deliverable id with the core's pattern", () => {
    expect(ids.map(({ id }) => shelf.isDeliverableId(id))).toEqual(ids.map(({ valid }) => valid))
  })

  it("links a Deliverable to the core's page for it", () => {
    for (const { id, href } of CORE.deliverables.hrefs.slice(0, SHELF_LINKED_IDS)) expect(shelf.deliverableHref(id)).toBe(href)
  })

  it("names an untitled Deliverable and a failed download in the core's words", () => {
    expect(shelf.UNTITLED).toBe(CORE.deliverables.UNTITLED)
    expect(shelf.DOWNLOAD_FAILED).toBe(CORE.download.DOWNLOAD_FAILED)
  })
})
