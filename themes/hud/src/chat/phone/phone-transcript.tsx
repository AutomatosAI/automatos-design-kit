import type { ReactNode } from 'react'
import type { HostChatMessage } from '@automatos/theme-sdk'

import { AutoReply } from '../auto-reply'
import { YOU } from '../transcript'
import styles from './phone.module.css'

/**
 * The phone core screen's transcript (the design's phone: your words in quotes, Auto's reply under them, larger): the
 * last exchange, your newest message and every reply after it. Auto's reply is the desktop's AUTO row (auto-reply.tsx)
 * without its speaker column, so it carries all it does there: his tool lines, the Deliverables, the host's approval
 * and ticket cards, the receipts, the snag box with Try again, the AI-generated mark. What follows the conversation
 * (turn-end.tsx: approvals left over, a turn that failed before its reply, a Mission Auto suggests) comes after it.
 * The earlier conversation is the desktop's and the Conversations page's to show. Before anything is said, `empty`
 * (the empty chat's line and starters) stands in its place. While a voice session has words, `aloud` (what was said
 * aloud, src/voice/voice-words.tsx) takes the last exchange's place: the exchange on screen is the one being spoken,
 * and the turn reaches the conversation once it lands.
 */

export const LAST_EXCHANGE_LABEL = 'Last exchange'

/** Your newest message and the replies after it; every message when you said none (a conversation Auto opened). */
export function lastExchange(messages: readonly HostChatMessage[]): readonly HostChatMessage[] {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === 'user') return messages.slice(index)
  }
  return messages
}

function YourWords({ message }: { readonly message: HostChatMessage }) {
  return (
    <article className={styles.you} aria-label={`${YOU} said`} data-speaker="you">
      <h2 className={styles.srOnly}>{YOU}</h2>
      <p className={styles.quote}>{`“${message.text}”`}</p>
    </article>
  )
}

export interface PhoneTranscriptProps {
  /** The conversation as the SDK hands it out (a reply you stopped kept). */
  readonly messages: readonly HostChatMessage[]
  /** Auto is answering: the newest reply is the one being written. */
  readonly streaming: boolean
  /** Try again, for the newest reply's snag box. */
  readonly onRetry: () => void
  /** Used-up credits blocked the newest turn: its reply shows no snag box. */
  readonly trialBlocked: boolean
  /** What follows the conversation. */
  readonly after: ReactNode
  /** Shown before anything is said. */
  readonly empty: ReactNode
  /** What a voice session has said aloud, shown in the last exchange's place; null while it has nothing. */
  readonly aloud?: ReactNode
}

/** The last exchange's rows: your newest words in quotes, then Auto's replies after them. */
function ExchangeRows({ messages, streaming, onRetry, trialBlocked }: Omit<PhoneTranscriptProps, 'after' | 'empty' | 'aloud'>) {
  const newest = messages[messages.length - 1]?.id
  return (
    <>
      {lastExchange(messages).map((message) =>
        message.role === 'user' ? (
          <YourWords key={message.id} message={message} />
        ) : (
          <AutoReply
            key={message.id}
            message={message}
            streaming={streaming && message.id === newest}
            onRetry={message.id === newest ? onRetry : undefined}
            snagHidden={trialBlocked && message.id === newest}
            recent
            phone
          />
        ),
      )}
    </>
  )
}

export function PhoneTranscript({ messages, streaming, onRetry, trialBlocked, after, empty, aloud = null }: PhoneTranscriptProps) {
  const rows = <ExchangeRows messages={messages} streaming={streaming} onRetry={onRetry} trialBlocked={trialBlocked} />
  const exchange = messages.length === 0 ? empty : rows
  return (
    <section className={styles.exchange} aria-label={LAST_EXCHANGE_LABEL}>
      {aloud ?? exchange}
      {after}
    </section>
  )
}
