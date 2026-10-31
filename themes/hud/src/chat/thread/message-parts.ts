import type { Brief, HostChatMessage, HostMessagePart } from '@automatos/theme-sdk'

import { briefSuggestionIds } from '../briefing/brief-rows'

/**
 * HUD 1.3.0 (PRD-268, SDK 1.4.0): what the conversation shows from a message's parts (HostChatMessage.knownParts, which
 * the host has already checked: brief@1, suggestion@1 and reply_chips@1 only ever on Auto's messages). The day's brief
 * posted into the conversation (its brief@1 part, found by its part, never by its prose), the suggestions Auto posted
 * into it (each suggestion@1 part's id), and the reply chips under Auto's last message (its reply_chips@1 part's
 * answers, shown only while no newer message exists). Pure.
 */

const BRIEF_PART: HostMessagePart['type'] = 'brief@1'
const REPLY_CHIPS_PART: HostMessagePart['type'] = 'reply_chips@1'
const NO_IDS: readonly string[] = []
const NO_CHIPS: readonly string[] = []

/** The brief a message carries as its brief@1 part, or null. */
export function briefOfMessage(message: HostChatMessage): Brief | null {
  const part = message.knownParts.find((known) => known.type === BRIEF_PART)
  return part?.type === 'brief@1' ? part.brief : null
}

/** The suggestions a message posted, by their suggestion@1 parts' ids, in its order, each once. */
export function suggestionIdsOf(message: HostChatMessage): readonly string[] {
  const ids = message.knownParts.flatMap((part) => (part.type === 'suggestion@1' ? [part.suggestion_id] : NO_IDS))
  return ids.length === 0 ? NO_IDS : [...new Set(ids)]
}

/** The answers a message's reply_chips@1 part offers (its first such part), or none. */
export function replyChipsOf(message: HostChatMessage): readonly string[] {
  const part = message.knownParts.find((known) => known.type === REPLY_CHIPS_PART)
  return part?.type === 'reply_chips@1' ? part.replies : NO_CHIPS
}

/**
 * The reply chips to show, under the conversation's newest message, while it is Auto's, is not being written and
 * offers some; none otherwise (a newer message, yours or Auto's, takes them away).
 */
export function latestReplyChips(messages: readonly HostChatMessage[]): { readonly id: string; readonly chips: readonly string[] } | null {
  const newest = messages[messages.length - 1]
  if (newest === undefined || newest.role !== 'assistant' || newest.writing) return null
  const chips = replyChipsOf(newest)
  return chips.length === 0 ? null : { id: newest.id, chips }
}

/** The suggestions the conversation shows with their own Start: its suggestion cards' and its briefs' Suggested rows. */
export function threadSuggestionIds(messages: readonly HostChatMessage[]): readonly string[] {
  const ids = messages.flatMap((message) => [...suggestionIdsOf(message), ...briefSuggestionIds(briefOfMessage(message))])
  return ids.length === 0 ? NO_IDS : [...new Set(ids)]
}

/**
 * The suggestions on screen with their own Start, which the `▸ NEXT` line skips: BRIEFING's while it shows (`briefing`,
 * null when it doesn't), and the conversation's while the transcript shows (`thread`, the messages it draws).
 */
export function suggestionsOnScreen(briefing: Brief | null, thread: readonly HostChatMessage[]): readonly string[] {
  return [...new Set([...briefSuggestionIds(briefing), ...threadSuggestionIds(thread)])]
}
