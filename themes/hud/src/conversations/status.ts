import type { HostConversationListState } from '@automatos/theme-sdk'

/**
 * The Conversations page's one status line under the search box, as pure data (after Play's, themes/play/src/
 * components/play/conversations/play-conversations.tsx, Play 1.1.1): loading, no conversations yet and no title
 * matching are shown; while titles match, the count is said to screen readers only, since the list shows it. The
 * failure is the page's alert, so the line stays, empty, for the next change.
 */

export const LOADING_LIST = 'Loading your conversations…'
export const NO_CONVERSATIONS = 'No conversations yet. Say hello to Auto and your first one starts.'

export interface StatusLine {
  readonly text: string
  /** Said to screen readers only: the list on the page already shows it. */
  readonly hidden: boolean
}

/** The line while titles match: how many, for screen readers only. */
export function matchLine(count: number, query: string): string {
  const needle = query.trim()
  const one = count === 1
  if (!needle) return one ? '1 conversation.' : `${count} conversations.`
  return one ? `1 conversation matches “${needle}”.` : `${count} conversations match “${needle}”.`
}

/** The line when no title matches the search: shown on the page. */
export function noMatchLine(query: string): string {
  return `No conversation titles match “${query.trim()}”.`
}

/** What the line says for the list and the search, given how many titles match. */
export function statusLine(list: HostConversationListState, shown: number, query: string): StatusLine {
  if (list.status === 'loading') return { text: LOADING_LIST, hidden: false }
  if (list.status === 'failed') return { text: '', hidden: true }
  if (list.chats.length === 0) return { text: NO_CONVERSATIONS, hidden: false }
  if (shown === 0) return { text: noMatchLine(query), hidden: false }
  return { text: matchLine(shown, query), hidden: true }
}
