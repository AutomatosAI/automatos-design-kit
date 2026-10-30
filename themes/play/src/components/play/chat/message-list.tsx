'use client'

import { type ReactNode, type RefObject, useEffect, useRef } from 'react'
import type { Brief, HostChatMessage } from '@automatos/theme-sdk'

import { isBriefMessage } from '../../../lib/play/proactive'
import { BriefReply } from '../proactive/play-brief'
import { AutoReply } from './auto-reply'
import styles from './chat.module.css'

/**
 * PRD-260 §4 — the conversation (mock 01), ported from Automatos Play's
 * components/chat/MessageList.tsx: your messages outlined on the right, Auto's
 * replies on the left. It scrolls inside Play's frame (the frame is
 * viewport-bound), keeping the newest line in view while Auto answers unless
 * you scrolled up to read; a new message follows again. What follows the
 * conversation (a turn that failed before a reply began, a Mission Auto
 * suggests) sits under the list, inside the scroll. A reply you stopped says
 * so (P260-FX-30). The messages are the SDK's (useChatController's view model,
 * PRD-261 A-14a): each reply carries its Deliverables, its approval cards and
 * whether Stop ended it.
 *
 * Play 1.3.0 (PRD-268 §6.12.4): the day's brief's own message draws as the brief's card (BriefReply), in its place in
 * the conversation, so it scrolls with it; lib/play/proactive.ts isBriefMessage says which message that is.
 */

/** How close to the bottom counts as "reading the newest line". */
export const FOLLOW_SLACK_PX = 120

function nearBottom(scroller: HTMLElement): boolean {
  return scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <= FOLLOW_SLACK_PX
}

/** jsdom has no scrollIntoView, hence the check. */
function useFollow(messages: readonly HostChatMessage[]): {
  scrollerRef: RefObject<HTMLDivElement | null>
  endRef: RefObject<HTMLDivElement | null>
} {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const following = useRef(true)
  const count = messages.length

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
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

export interface MessageListProps {
  readonly messages: readonly HostChatMessage[]
  /** Auto is answering: the newest reply is the one being written. */
  readonly streaming: boolean
  /** Try again, for the newest reply's snag box. */
  readonly onRetry?: () => void
  /** A spent trial blocked the newest turn: its reply shows no snag box. */
  readonly trialBlocked?: boolean
  /** Shown under the conversation, inside the scroll. */
  readonly after?: ReactNode
  /** The day's brief, once the host holds one: its message draws as the card. */
  readonly brief?: Brief | null
}

interface MessageItemProps {
  readonly message: HostChatMessage
  /** This message is the newest: it streams, and has Try again and the snag box. */
  readonly newest: boolean
  readonly streaming: boolean
  readonly onRetry?: () => void
  readonly trialBlocked: boolean
  readonly brief: Brief | null
}

/** Your words in a bubble, the day's brief as its card, or Auto's reply. */
function MessageItem({ message, newest, streaming, onRetry, trialBlocked, brief }: MessageItemProps) {
  if (message.role === 'user') return <p className={styles.bubble}>{message.text}</p>
  if (isBriefMessage(message, brief)) return <BriefReply message={message} brief={brief} />
  return (
    <AutoReply
      message={message}
      streaming={streaming && newest}
      onRetry={newest ? onRetry : undefined}
      snagHidden={trialBlocked && newest}
    />
  )
}

export function MessageList({ messages, streaming, onRetry, trialBlocked = false, after, brief = null }: MessageListProps) {
  const { scrollerRef, endRef } = useFollow(messages)
  const newest = messages[messages.length - 1]?.id
  return (
    <div ref={scrollerRef} className={styles.messages}>
      <ol className={styles.messageList} aria-label="Conversation">
        {messages.map((message) => (
          <li key={message.id} className={message.role === 'user' ? styles.userItem : styles.replyItem}>
            <MessageItem
              message={message}
              newest={message.id === newest}
              streaming={streaming}
              onRetry={onRetry}
              trialBlocked={trialBlocked}
              brief={brief}
            />
          </li>
        ))}
      </ol>
      {after}
      <div ref={endRef} />
    </div>
  )
}
