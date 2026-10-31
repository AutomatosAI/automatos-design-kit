// What HUD 1.3.0's tests of a message's parts share (PRD-268, SDK 1.4.0): stored messages carrying the parts core's
// backend keeps (text, brief@1, suggestion@1, reply_chips@1), which the harness reads into each message's knownParts
// as core's chat area does, and HostChatMessage builders for the pure rules (knownParts is required on every one).
// Every value is made up.
import type { HostChatMessage, HostMessagePart } from '@automatos/theme-sdk'
import type { StoredMessage } from '../chat/support.tsx'
import { BRIEF } from './support.ts'

/** The answers Auto offers under his reply. */
export const CHIPS: readonly string[] = ['Window', 'Aisle seat']
export const ANSWER = 'Which seat do you want on the train?'
/** Your question after Auto's brief. */
export const BRIEF_ASK = 'Which one first?'

/** Auto's reply with these parts beside its words. */
export function autoMessage(text: string, parts: readonly unknown[] = []): StoredMessage {
  return { role: 'assistant', text, parts: [{ type: 'text', text }, ...parts] }
}

/** Auto's reply asking you to choose, with its reply chips (and its suggestion, when given). */
export function chipsReply(suggestionId: string | null = null): StoredMessage {
  const suggestion = suggestionId === null ? [] : [{ type: 'suggestion@1', suggestion_id: suggestionId }]
  return autoMessage(ANSWER, [...suggestion, { type: 'reply_chips@1', replies: CHIPS }])
}

/** Auto's brief posted into the conversation: its prose beside its brief@1 part. */
export const BRIEF_POST: StoredMessage = autoMessage(BRIEF.prose, [{ type: 'brief@1', brief: BRIEF }])

/** A question, then Auto's reply with chips: the conversation the chips' tests open. */
export const CHIPS_THREAD: readonly StoredMessage[] = [{ role: 'user', text: 'Book my train seat' }, chipsReply()]

/** A whole HostChatMessage for the pure rules, its knownParts as given. */
export function hostMessage(id: string, role: HostChatMessage['role'], knownParts: readonly HostMessagePart[] = []): HostChatMessage {
  return {
    id, role, text: id, knownParts, activity: [], error: null, writing: false, stopped: false, receipts: null, above: [],
    deliverables: [], approvals: [], taskCards: [], toolCalls: [], provenance: null, savedError: null, limitReached: null,
    reasoningChars: 0, withdrawOffer: null, linkedDeliverables: [],
  }
}
