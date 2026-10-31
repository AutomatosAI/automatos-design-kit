'use client'

import { type ReactNode, type RefObject, useEffect, useRef } from 'react'
import type { Brief, HostChatMessage } from '@automatos/theme-sdk'

import { briefOf, isHeldBrief, replyChipsShown, suggestionIdsOf } from '../../../lib/play/proactive'
import { BriefReply } from '../proactive/play-brief'
import { PlayReplyChips } from '../proactive/reply-chips'
import { ThreadSuggestions } from '../proactive/thread-suggestions'
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
 * the conversation, so it scrolls with it.
 *
 * Play 1.4.0 (SDK 1.4.0, each message's knownParts): a message is the brief's by its `brief@1` part (any day's, its
 * own brief drawn), never by its words. Under an Auto message come the cards of the suggestions it posted
 * (`suggestion@1`, thread-suggestions.tsx), then, under his last message only, the answers he offered
 * (`reply_chips@1`, reply-chips.tsx), which send through the message box's own send (`onReply`).
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
  /** The day's brief the host holds, once it does: its card in the conversation offers Listen. */
  readonly brief?: Brief | null
  /** Sends a reply chip's words as the person's message; false when nothing went out. Without it, no chips. */
  readonly onReply?: (text: string) => boolean
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

/** Your words in a bubble, a brief's message as its card, or Auto's reply. */
function MessageItem({ message, newest, streaming, onRetry, trialBlocked, brief }: MessageItemProps) {
  if (message.role === 'user') return <p className={styles.bubble}>{message.text}</p>
  const own = briefOf(message)
  if (own !== null) return <BriefReply message={message} brief={own} today={isHeldBrief(own, brief)} />
  return (
    <AutoReply
      message={message}
      streaming={streaming && newest}
      onRetry={newest ? onRetry : undefined}
      snagHidden={trialBlocked && newest}
    />
  )
}

/** Under one of Auto's messages: the suggestions it posted, then the answers he offered while it is the last one. */
function UnderReply({ message, messages, onReply }: {
  readonly message: HostChatMessage
  readonly messages: readonly HostChatMessage[]
  readonly onReply?: (text: string) => boolean
}) {
  const ids = suggestionIdsOf(message)
  const chips = onReply ? replyChipsShown(message, messages) : []
  return (
    <>
      {ids.length > 0 ? <ThreadSuggestions ids={ids} /> : null}
      {onReply && chips.length > 0 ? <PlayReplyChips chips={chips} onReply={onReply} /> : null}
    </>
  )
}

export function MessageList({ messages, streaming, onRetry, trialBlocked = false, after, brief = null, onReply }: MessageListProps) {
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
            <UnderReply message={message} messages={messages} onReply={onReply} />
          </li>
        ))}
      </ol>
      {after}
      <div ref={endRef} />
    </div>
  )
}
