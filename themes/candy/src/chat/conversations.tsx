import { useId } from 'react'
import { HostLink, useConversationList } from '@automatos/theme-sdk'

import { useNow } from '../ui/use-now'
import { conversationRows, type ConversationRow } from './conversation-rows'
import styles from './rail.module.css'
import ui from '../ui/ui.module.css'

/**
 * Conversations (the design's W2 rail window): your chats newest first (the SDK's useConversationList), each a row
 * with a dot in one of the cards' colours, its title and how long ago it moved, linking to the chat; the one on
 * screen sits on the chip colour and is the current page. While the list loads, fails (with Try again) or is empty,
 * a quiet line says so. The phone shows the same window under its stage when you ask for it.
 */

export const CONVERSATIONS = 'Conversations'
export const LOADING = 'Loading your conversations…'
export const FAILED = "Couldn't load your conversations."
export const EMPTY = 'No conversations yet. Your chats with Auto show here.'
export const RETRY = 'Try again'
/** How many the window lists; it scrolls when they don't fit. */
export const SHOWN = 12

function Row({ row }: { readonly row: ConversationRow }) {
  return (
    <li>
      <HostLink href={row.href} className={styles.row} aria-current={row.current ? 'page' : undefined}>
        <span className={ui.dot} data-set={row.set} aria-hidden="true" />
        <span className={styles.rowTitle}>{row.title}</span>
        {row.when !== null && <span className={styles.rowWhen}>{row.when}</span>}
      </HostLink>
    </li>
  )
}

function Rows({ currentId }: { readonly currentId: string | null }) {
  const list = useConversationList(SHOWN)
  const now = useNow()
  if (list.status === 'loading') return <p className={`${ui.note} ${styles.state}`}>{LOADING}</p>
  if (list.status === 'failed') {
    return (
      <div className={styles.state}>
        <p className={ui.note}>{FAILED}</p>
        <button type="button" className={`${ui.quiet} ${ui.small}`} onClick={list.retry}>
          {RETRY}
        </button>
      </div>
    )
  }
  const rows = conversationRows(list.chats, currentId, now)
  if (rows.length === 0) return <p className={`${ui.note} ${styles.state}`}>{EMPTY}</p>
  return (
    <ul className={styles.rows}>
      {rows.map((row) => (
        <Row key={row.id} row={row} />
      ))}
    </ul>
  )
}

export interface ConversationsProps {
  /** The conversation on screen; null for a new chat. */
  readonly currentId: string | null
  readonly id?: string
}

export function Conversations({ currentId, id }: ConversationsProps) {
  const headingId = useId()
  return (
    <section id={id} className={`${ui.window} ${styles.list}`} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.listTitle}>
        {CONVERSATIONS}
      </h2>
      <Rows currentId={currentId} />
    </section>
  )
}
