import type { Brief, HostChatMessage, HostMissionSuggestion, Suggestion } from '@automatos/theme-sdk'

/**
 * Play 1.3.0 (PRD-268 §6.12.4) — what Play's chat decides about the proactive surfaces, from the SDK's data. Pure.
 *
 * - One suggestion surface: while the turn's own Mission suggestion is unanswered (PlayMissionSuggestion shows it, and
 *   no Mission is being planned yet), the suggestion pinned above the message box steps aside.
 * - The pinned suggestion is the newest open one (useSuggestions lists them newest first) that nothing on screen already
 *   shows with its own Start: a brief's Suggested rows, or (1.4.0) a suggestion card in the conversation. So each
 *   suggestion's Start is on screen once beside the pinned line.
 *
 * Play 1.4.0 (SDK 1.4.0) reads each message's parts (HostChatMessage.knownParts, which the host has checked: brief@1,
 * suggestion@1 and reply_chips@1 only on Auto's messages):
 * - A brief is found by its `brief@1` part, never by its words: any day's brief in the Auto thread draws as its card,
 *   not only the one useBrief holds today. The host's Listen reads the brief the host holds, so only that day's card
 *   offers it (isHeldBrief).
 * - A `suggestion@1` part names a suggestion Auto posted into the thread: its card is drawn under the message from the
 *   open list (threadSuggestionsOf), so its state is the live one.
 * - A `reply_chips@1` part is the answers Auto offered: drawn under his last message only, gone once a newer message
 *   exists (replyChipsShown).
 */

const ASSISTANT: HostChatMessage['role'] = 'assistant'
const NONE: readonly string[] = Object.freeze([])

/** True while the turn's Mission suggestion waits for an answer: one is offered and no Mission is planned from it. */
export function missionSuggestionOpen(suggestion: HostMissionSuggestion | null, planningMissionId: string | null): boolean {
  return suggestion !== null && !planningMissionId
}

/** The newest open suggestion not `listed` already (shown on screen with its own Start), or null. */
export function newestOpenSuggestion(
  list: readonly Suggestion[] | null | undefined,
  listed: readonly string[] = [],
): Suggestion | null {
  return (list ?? []).find((suggestion) => suggestion.status === 'open' && !listed.includes(suggestion.id)) ?? null
}

/** The suggestions a brief lists in its Suggested section, by id: their rows carry Start and Hide. */
export function briefSuggestionIds(brief: Brief | null | undefined): readonly string[] {
  return (brief?.sections.suggestions ?? []).flatMap((row) => (row.opens?.type === 'suggestion' ? [row.opens.id] : []))
}

/** The day's brief a message carries as its `brief@1` part, or null: Auto's messages only. */
export function briefOf(message: HostChatMessage): Brief | null {
  if (message.role !== ASSISTANT) return null
  for (const part of message.knownParts) {
    if (part.type === 'brief@1') return part.brief
  }
  return null
}

/** True when `brief` is the day's brief the host holds (useBrief's), the one the host's Listen reads. */
export function isHeldBrief(brief: Brief, held: Brief | null | undefined): boolean {
  return held !== null && held !== undefined && held.date === brief.date
}

/** The suggestions a message's `suggestion@1` parts name, in order, each once: Auto's messages only. */
export function suggestionIdsOf(message: HostChatMessage): readonly string[] {
  if (message.role !== ASSISTANT) return NONE
  const ids = message.knownParts.flatMap((part) => (part.type === 'suggestion@1' ? [part.suggestion_id] : []))
  return ids.filter((id, index) => ids.indexOf(id) === index)
}

/**
 * The suggestion cards a message draws: each one its parts name that is open (or `kept`, just started here and still
 * saying so), in the parts' order. A suggestion no longer open has no card; the message's words stay.
 */
export function threadSuggestionsOf(
  ids: readonly string[],
  open: readonly Suggestion[] | null | undefined,
  kept: Suggestion | null,
): readonly Suggestion[] {
  return ids.flatMap((id) => {
    if (kept?.id === id) return [kept]
    const found = (open ?? []).find((suggestion) => suggestion.id === id && suggestion.status === 'open')
    return found ? [found] : []
  })
}

/** The answers Auto offered with a message (its `reply_chips@1` part), or none. */
export function replyChipsOf(message: HostChatMessage): readonly string[] {
  if (message.role !== ASSISTANT) return NONE
  for (const part of message.knownParts) {
    if (part.type === 'reply_chips@1') return part.replies
  }
  return NONE
}

/** The chips under `message`: only while it is the conversation's last message and Auto has finished it. */
export function replyChipsShown(message: HostChatMessage, messages: readonly HostChatMessage[]): readonly string[] {
  const last = messages[messages.length - 1]
  if (last?.id !== message.id || message.writing) return NONE
  return replyChipsOf(message)
}

/** The briefs the chat has on screen: on an empty chat the day's brief, in a conversation every `brief@1` message's. */
export function briefsOnScreen(brief: Brief | null | undefined, messages: readonly HostChatMessage[]): readonly Brief[] {
  if (messages.length === 0) return brief ? [brief] : []
  return messages.flatMap((message) => {
    const own = briefOf(message)
    return own === null ? [] : [own]
  })
}

/**
 * The suggestions already on screen with their own Start, which the pinned line never repeats: the ones the briefs on
 * screen list, and the ones the conversation's messages post as cards. Each once.
 */
export function listedSuggestionIds(brief: Brief | null | undefined, messages: readonly HostChatMessage[]): readonly string[] {
  const ids = [
    ...briefsOnScreen(brief, messages).flatMap(briefSuggestionIds),
    ...messages.flatMap(suggestionIdsOf),
  ]
  return ids.filter((id, index) => ids.indexOf(id) === index)
}
