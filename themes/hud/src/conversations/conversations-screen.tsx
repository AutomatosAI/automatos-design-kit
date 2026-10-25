import { type ChangeEvent, useEffect, useMemo, useState } from 'react'
import {
  CHAT_HREF,
  type HostConversationListState,
  useConversationList,
  useHostRouter,
  useThemeLayout,
} from '@automatos/theme-sdk'

import { NewChatButton } from '../components/new-chat'
import { THEME_HEADING } from '../theme'
import { ConversationList } from './conversation-list'
import { type ConversationSummary, filterByTitle, summaryOfHostChat } from './conversations'
import styles from './conversations.module.css'
import { statusLine } from './status'

/**
 * HUD's Conversations page, its theme route `conversations` (/x/conversations), on the core's history (the SDK's
 * useConversationList), after Play's (themes/play/src/components/play/conversations/play-conversations.tsx, Play
 * 1.1.1) and drawn in HUD's language: the heading and New chat over a square search box, then every conversation in
 * Today, This week and Earlier panels (conversation-list.tsx). A row opens the conversation in the chat. One status
 * line sits under the search box for the page's life, so a screen reader hears every change to it (status.ts).
 *
 * The host draws a theme route at any width, so where HUD doesn't draw (below its minWidth, or under another style)
 * the page sends the browser to the chat, whose own history is the list there; until the width is known it shows
 * nothing and sends nowhere, so a phone never asks for the list.
 */

export const CONVERSATIONS_TITLE = 'Conversations'
export const SEARCH_LABEL = 'Search conversations'
export const LIST_FAILED = "Your conversations didn't load. Try again in a moment."
export const TRY_AGAIN = 'Try again'

export interface ConversationsProps {
  /** What "today" is; tests pin it. */
  readonly now?: Date
}

/** The page where HUD draws at this width; anywhere else, the chat. */
export function HudConversations({ now }: ConversationsProps) {
  const layout = useThemeLayout()
  const router = useHostRouter()
  const elsewhere = layout === 'fallback'
  useEffect(() => {
    if (elsewhere) router.replace(CHAT_HREF)
  }, [elsewhere, router])
  return layout === 'theme' ? <ConversationsScreen now={now} /> : null
}

export function ConversationsScreen({ now }: ConversationsProps) {
  const list = useConversationList()
  const [query, setQuery] = useState('')
  const onSearch = (event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)
  const chats = useMemo(() => (list.status === 'loaded' ? list.chats.map(summaryOfHostChat) : []), [list])
  const shown = filterByTitle(chats, query)
  const line = statusLine(list, shown.length, query)
  return (
    <div className={styles.screen}>
      <div className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.heading} tabIndex={-1} {...THEME_HEADING}>
            {CONVERSATIONS_TITLE}
          </h1>
          <NewChatButton />
        </div>
        <input
          type="search"
          className={styles.search}
          aria-label={SEARCH_LABEL}
          placeholder={SEARCH_LABEL}
          value={query}
          onChange={onSearch}
        />
        <p className={line.hidden ? styles.srOnly : styles.status} role="status">
          {line.text}
        </p>
        <ListBody list={list} shown={shown} now={now ?? new Date()} />
      </div>
    </div>
  )
}

interface ListBodyProps {
  readonly list: HostConversationListState
  /** The conversations whose titles match the search. */
  readonly shown: readonly ConversationSummary[]
  readonly now: Date
}

/** The failed state's alert, or the matching conversations; the status line says the rest. */
function ListBody({ list, shown, now }: ListBodyProps) {
  if (list.status === 'failed') {
    return (
      <div className={styles.failed} role="alert">
        <p className={styles.error}>
          <span aria-hidden="true">✕</span> {LIST_FAILED}
        </p>
        <button type="button" className={styles.retry} onClick={list.retry}>
          {TRY_AGAIN}
        </button>
      </div>
    )
  }
  return shown.length > 0 ? <ConversationList chats={shown} now={now} /> : null
}
