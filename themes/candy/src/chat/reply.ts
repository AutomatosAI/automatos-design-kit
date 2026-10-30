// Copied from themes/arcade/src/chat/reply.ts (Arcade 1.0.0), itself from HUD 1.1.2 and Play 1.1.1, as it is but for this line.
import type { HostChatMessage, HostDeliverable, MissionSuggestionMessage } from '@automatos/theme-sdk'

import { NO_REPLY, type ReplyProgress } from '@automatos/mascot/events'

/**
 * The conversation as the chat reads it, on the SDK's messages (useChatController's view): the newest reply, the
 * reply being written as Auto reads it, the input of its running tool call, the Deliverables a reply shows, and
 * the recent messages a Mission is planned from. Pure. (ES2022: no findLast.)
 */

/** The Studio chat sends the newest five messages as a Mission's context. */
export const CONTEXT_MESSAGES_KEPT = 5

function newest<T>(items: readonly T[], keep: (item: T) => boolean): T | undefined {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (keep(items[index])) return items[index]
  }
  return undefined
}

/**
 * The conversation as the chat hook holds it: the SDK's messages keep a reply you stopped, which the hook itself
 * dropped. Auto, the state chip and what follows the conversation read this one.
 */
export function liveMessages(messages: readonly HostChatMessage[]): readonly HostChatMessage[] {
  return messages.some((message) => message.stopped) ? messages.filter((message) => !message.stopped) : messages
}

/** The newest reply from Auto. */
export function latestReply(messages: readonly HostChatMessage[]): HostChatMessage | undefined {
  return newest(messages, (message) => message.role === 'assistant')
}

/** The input of the newest tool call still running on the reply (its query, page or title). */
export function runningToolInput(reply: HostChatMessage | undefined): unknown {
  return newest(reply?.toolCalls ?? [], (call) => call.state === 'running')?.input
}

/**
 * The reply being written, for Auto (@automatos/mascot's events): the newest message when it is a reply, whether
 * its words have started, whether one of its tool calls still runs, how long the model's reasoning on it is and
 * whether a cap ended its turn. A turn still awaiting its reply has none.
 */
export function replyProgress(messages: readonly HostChatMessage[]): ReplyProgress {
  const last = messages[messages.length - 1]
  if (last?.role !== 'assistant') return NO_REPLY
  return {
    id: last.id,
    hasText: last.text.trim().length > 0,
    toolRunning: last.toolCalls.some((call) => call.state === 'running'),
    reasoningChars: last.reasoningChars,
    limitReached: Boolean(last.limitReached),
  }
}

/** The newest messages as {role, content}, as the Studio chat builds a Mission suggestion's recentMessages. */
export function recentMessages(messages: readonly HostChatMessage[]): MissionSuggestionMessage[] {
  return messages.slice(-CONTEXT_MESSAGES_KEPT).map((message) => ({ role: message.role, content: message.text }))
}

/** `known` with the new ones from `found` after it; one per id, the first one seen wins. Never mutates. */
export function mergeDeliverables(
  known: readonly HostDeliverable[],
  found: readonly HostDeliverable[],
): readonly HostDeliverable[] {
  const fresh = found.filter(
    (ref, index) => !known.some((seen) => seen.id === ref.id) && found.findIndex((other) => other.id === ref.id) === index,
  )
  return fresh.length > 0 ? [...known, ...fresh] : known
}

/** The Deliverables a reply shows: the ones it made live, then the ones its done receipts link to. */
export function replyDeliverables(message: HostChatMessage): readonly HostDeliverable[] {
  return mergeDeliverables(message.deliverables, message.linkedDeliverables)
}
