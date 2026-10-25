import { type ReactNode, type RefObject, useEffect, useRef } from 'react'
import type { HostChatMessage } from '@automatos/theme-sdk'

import { AutoReply } from './auto-reply'
import { EmptyChat } from './empty-chat'
import styles from './transcript.module.css'

/**
 * The transcript under the core (the Command design's YOU and AUTO rows): each message a row with its speaker in
 * mono capitals on the left, your words in the secondary text, Auto's in the text, the newest exchange at the
 * design's large sizes and the earlier ones smaller. It scrolls inside the column, keeping the newest line in view
 * while Auto answers unless you scrolled up to read; a new message follows again (after Play's message list,
 * themes/play/src/components/play/chat/message-list.tsx, Play 1.1.1). What follows the conversation (a turn that
 * failed before a reply began, a Mission Auto suggests) sits under the list, inside the scroll. Before anything is
 * said there is no list: the empty chat (empty-chat.tsx) stands in its place.
 */

export const CONVERSATION_LABEL = 'Conversation'
export const YOU = 'You'
/** How close to the bottom counts as reading the newest line. */
export const FOLLOW_SLACK_PX = 120

/** The scroller shows its newest line, or near enough (the phone's screen follows the same way). */
export function nearBottom(scroller: HTMLElement): boolean {
  return scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <= FOLLOW_SLACK_PX
}

interface Follow {
  readonly scrollerRef: RefObject<HTMLDivElement | null>
  readonly endRef: RefObject<HTMLDivElement | null>
}

/** jsdom has no scrollIntoView, hence the check. */
function useFollow(messages: readonly HostChatMessage[]): Follow {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const following = useRef(true)
  const count = messages.length
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return undefined
    const onScroll = () => {
      following.current = nearBottom(scroller)
    }
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => scroller.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => {
    following.current = true
  }, [count])
  useEffect(() => {
    const end = endRef.current
    if (following.current && end && typeof end.scrollIntoView === 'function') end.scrollIntoView({ block: 'end' })
  }, [messages])
  return { scrollerRef, endRef }
}

/** The ids of the newest exchange: your last message and Auto's last reply. */
function recentIds(messages: readonly HostChatMessage[]): ReadonlySet<string> {
  const lastOf = (role: HostChatMessage['role']) => [...messages].reverse().find((message) => message.role === role)?.id
  return new Set([lastOf('user'), lastOf('assistant')].filter((id): id is string => id !== undefined))
}

function YouRow({ message, recent }: { readonly message: HostChatMessage; readonly recent: boolean }) {
  return (
    <article className={styles.row} aria-label={`${YOU} said`} data-speaker="you" data-recent={recent ? 'true' : undefined}>
      <h2 className={styles.speaker}>{YOU}</h2>
      <p className={styles.you}>{message.text}</p>
    </article>
  )
}

export interface TranscriptProps {
  readonly messages: readonly HostChatMessage[]
  /** Auto is answering: the newest reply is the one being written. */
  readonly streaming: boolean
  /** Try again, for the newest reply's snag box. */
  readonly onRetry?: () => void
  /** Used-up credits blocked the newest turn: its reply shows no snag box. */
  readonly trialBlocked?: boolean
  /** Shown under the conversation, inside the scroll. */
  readonly after?: ReactNode
  /** Shown in the list's place before anything is said: the empty chat's line by default. */
  readonly empty?: ReactNode
}

type ListProps = Pick<TranscriptProps, 'messages' | 'streaming' | 'onRetry' | 'trialBlocked'>

function MessageList({ messages, streaming, onRetry, trialBlocked = false }: ListProps) {
  const newest = messages[messages.length - 1]?.id
  const recent = recentIds(messages)
  return (
    <ol className={styles.list} aria-label={CONVERSATION_LABEL}>
      {messages.map((message) => (
        <li key={message.id} className={styles.item}>
          {message.role === 'user' ? (
            <YouRow message={message} recent={recent.has(message.id)} />
          ) : (
            <AutoReply
              message={message}
              streaming={streaming && message.id === newest}
              onRetry={message.id === newest ? onRetry : undefined}
              snagHidden={trialBlocked && message.id === newest}
              recent={recent.has(message.id)}
            />
          )}
        </li>
      ))}
    </ol>
  )
}

export function Transcript(props: TranscriptProps) {
  const { messages, streaming, onRetry, trialBlocked = false, after, empty = <EmptyChat /> } = props
  const { scrollerRef, endRef } = useFollow(messages)
  return (
    <div ref={scrollerRef} className={styles.scroller}>
      {messages.length === 0 ? (
        empty
      ) : (
        <MessageList messages={messages} streaming={streaming} onRetry={onRetry} trialBlocked={trialBlocked} />
      )}
      {after}
      <div ref={endRef} />
    </div>
  )
}
