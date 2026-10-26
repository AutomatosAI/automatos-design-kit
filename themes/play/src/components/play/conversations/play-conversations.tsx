'use client'

import { type ChangeEvent, useEffect, useMemo, useState } from 'react'
import {
  CHAT_HREF,
  type HostConversationListState,
  useConversationList,
  useHostRouter,
  useStartChat,
  useThemeLayout,
} from '@automatos/theme-sdk'

import { type ConversationSummary, filterByTitle, summaryOfHostChat } from '../../../lib/play/conversations'
import { usePhoneLayout } from '../../../lib/play/phone-layout'
import { AutoMascot } from '../../mascot/auto-mascot'
import { MascotColumn, PageColumns } from '../shell/page-columns'
import { ConversationList } from './conversation-list'
import styles from './conversations.module.css'

/**
 * PRD-260 §4 — Play's Conversations page (Ember mock 03), ported from Automatos
 * Play's components/conversations/ConversationsScreen.tsx onto the core's
 * history (the SDK's useConversationList: getChatHistory): every conversation grouped
 * into Today, This week and Earlier, a search on the title, and New chat. A row
 * opens the conversation in the chat (/chat?chatId=<id>). The title and New
 * chat head the list's own column, over the search box, as in the Play app
 * (P260-FX-14). Auto idles in the mascot column, in the same spot as in the
 * chat so nothing jumps. With no conversations yet there is no mascot column:
 * Auto stands in the middle of the list's column at his regular size, the empty
 * message his caption, then Start a chat, as on an empty shelf (Play 1.1.1).
 *
 * One status line sits under the search box for the page's life, so a screen
 * reader hears every change to it (P260-FX-24, M22): loading and no title
 * matching are shown; no conversations yet, and while titles match the count,
 * are said to screen readers only, since Auto's caption or the list shows them.
 *
 * app/conversations/page.tsx sends Classic and Studio to /chat on the server
 * (K10); PlayConversations does the same in the browser when the style leaves
 * Play on this page, and below Play's minWidth, where Play's pages don't render (D7)
 * and the core chat's own history is the list. Until the width is known (the
 * server, hydration) it shows nothing and sends nowhere, so a phone never asks
 * for the list (P260-FX-25, M69). The width is the SDK's useThemeLayout (the host's own value):
 * ThemeSlotRoute renders a theme route at any width and leaves the phone to the route.
 *
 * Play 1.2.0: Play draws from a phone's width up (theme.json's minWidth, 360), so on a phone this is the Ember
 * design's 390 Chats: the same list, titled Chats as the design and the phone's top bar name it, with no mascot
 * column (page-columns.tsx), a utility screen. Below the minWidth it still sends the browser to the chat.
 */

export const CONVERSATIONS_TITLE = 'Conversations'
/** The list's title on a phone, as the Ember design's 390 screen and the phone's top bar name it. */
export const PHONE_CONVERSATIONS_TITLE = 'Chats'
export const NEW_CHAT = 'New chat'
export const SEARCH_LABEL = 'Search conversations'
export const LOADING_LIST = 'Loading your conversations…'
export const NO_CONVERSATIONS = 'No conversations yet. Say hello to Auto and your first one starts.'
export const LIST_FAILED = "Your conversations didn't load. Try again in a moment."
export const START_A_CHAT = 'Start a chat'
/** sr-only: the Tailwind utility the core uses for words that are only for screen readers. */
const SCREEN_READER_ONLY = 'sr-only'

/** The status line while titles match: how many, for screen readers only. */
export function matchLine(count: number, query: string): string {
  const needle = query.trim()
  const one = count === 1
  if (!needle) return one ? '1 conversation.' : `${count} conversations.`
  return one ? `1 conversation matches “${needle}”.` : `${count} conversations match “${needle}”.`
}

/** The status line when no title matches the search: shown on the page. */
export function noMatchLine(query: string): string {
  return `No conversation titles match “${query.trim()}”.`
}

export interface PlayConversationsProps {
  /** What "today" is; tests pin it. */
  readonly now?: Date
}

/** The page where Play draws (from its minWidth up, under Play); anywhere else, the chat. */
export function PlayConversations({ now }: PlayConversationsProps) {
  const layout = useThemeLayout()
  const router = useHostRouter()
  const elsewhere = layout === 'fallback'
  useEffect(() => {
    if (elsewhere) router.replace(CHAT_HREF)
  }, [elsewhere, router])
  return layout === 'theme' ? <ConversationsScreen now={now} /> : null
}

export function ConversationsScreen({ now }: PlayConversationsProps) {
  const list = useConversationList()
  const { startChat, ready } = useStartChat()
  const [query, setQuery] = useState('')
  const onSearch = (event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)
  const chats = useMemo(() => (list.status === 'loaded' ? list.chats.map(summaryOfHostChat) : []), [list])
  const shown = filterByTitle(chats, query)
  const line = statusLine(list, shown.length, query)
  const empty = list.status === 'loaded' && list.chats.length === 0
  const title = usePhoneLayout() ? PHONE_CONVERSATIONS_TITLE : CONVERSATIONS_TITLE
  return (
    <PageColumns
      mascot={
        empty ? undefined : (
          <MascotColumn>
            <AutoMascot state="idle" />
          </MascotColumn>
        )
      }
    >
      <div className={styles.body}>
        <div className={styles.page}>
          <div className={styles.header}>
            <h1 className={styles.title}>{title}</h1>
            <button type="button" className={styles.newChat} onClick={startChat} disabled={!ready}>
              {NEW_CHAT}
            </button>
          </div>
          <input
            type="search"
            className={styles.search}
            aria-label={SEARCH_LABEL}
            placeholder={SEARCH_LABEL}
            value={query}
            onChange={onSearch}
          />
          <p className={line.hidden ? SCREEN_READER_ONLY : styles.status} role="status">
            {line.text}
          </p>
          <ListBody list={list} shown={shown} now={now ?? new Date()} />
        </div>
      </div>
    </PageColumns>
  )
}

interface StatusLine {
  readonly text: string
  /** Said to screen readers only: the list on the page already shows it. */
  readonly hidden: boolean
}

/** What the one status line under the search box says for the list and the search. */
function statusLine(list: HostConversationListState, shown: number, query: string): StatusLine {
  if (list.status === 'loading') return { text: LOADING_LIST, hidden: false }
  // The failure is the alert below; the line stays, empty, for the next change.
  if (list.status === 'failed') return { text: '', hidden: true }
  // Auto's caption says it on the page (EmptyList).
  if (list.chats.length === 0) return { text: NO_CONVERSATIONS, hidden: true }
  if (shown === 0) return { text: noMatchLine(query), hidden: false }
  return { text: matchLine(shown, query), hidden: true }
}

interface ListBodyProps {
  readonly list: HostConversationListState
  /** The conversations whose titles match the search. */
  readonly shown: readonly ConversationSummary[]
  readonly now: Date
}

/** No conversations yet: Auto at his regular size, the message his caption, then Start a chat, centred. */
function EmptyList() {
  const { startChat, ready } = useStartChat()
  return (
    <div className={styles.empty}>
      <AutoMascot state="idle" caption={NO_CONVERSATIONS} />
      <button type="button" className={styles.start} onClick={startChat} disabled={!ready}>
        {START_A_CHAT}
      </button>
    </div>
  )
}

/** The failed state's alert, no conversations yet, or the matching conversations; the status line says the rest. */
function ListBody({ list, shown, now }: ListBodyProps) {
  if (list.status === 'failed') {
    return (
      <div className={styles.failed} role="alert">
        <p className={styles.error}>
          <span aria-hidden="true">✕</span> {LIST_FAILED}
        </p>
        <button type="button" className={styles.retry} onClick={list.retry}>
          Try again
        </button>
      </div>
    )
  }
  if (list.status === 'loaded' && list.chats.length === 0) return <EmptyList />
  return shown.length > 0 ? <ConversationList chats={shown} now={now} /> : null
}
