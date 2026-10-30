import { chatHref, type HostChatSummary } from '@automatos/theme-sdk'

import { cardSetOf, type CardSet } from '../ui/sets'
import { shortWhen } from '../ui/when'

/**
 * The rail's Conversations (the design's W2 list) as rows: newest first, as the host lists them, each with its
 * dot's gradient (cycling the three in screen order), its title, how long ago it moved ("Now", "2 h", "Yesterday")
 * and its link; the one on screen marked current. Pure: `now` is passed in.
 */

export const UNTITLED = 'New chat'

export interface ConversationRow {
  readonly id: string
  readonly title: string
  readonly when: string | null
  readonly href: string
  readonly set: CardSet
  readonly current: boolean
}

function timeOf(chat: HostChatSummary): number {
  const time = Date.parse(chat.updatedAt)
  return Number.isFinite(time) ? time : 0
}

/** Newest first, whatever order they came in; never mutates the list it is given. */
export function newestFirst(chats: readonly HostChatSummary[]): readonly HostChatSummary[] {
  return [...chats].sort((a, b) => timeOf(b) - timeOf(a))
}

export function conversationRows(chats: readonly HostChatSummary[], currentId: string | null, now: number): readonly ConversationRow[] {
  return newestFirst(chats).map((chat, index) => ({
    id: chat.id,
    title: chat.title.trim() || UNTITLED,
    when: shortWhen(chat.updatedAt, now),
    href: chatHref(chat.id),
    set: cardSetOf(index),
    current: currentId !== null && chat.id === currentId,
  }))
}
