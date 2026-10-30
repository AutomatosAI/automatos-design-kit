// After themes/arcade/src/chat/story.tsx (Arcade 1.0.0), itself after HUD 1.1.2's transcript: the conversation that
// follows its newest line, and what comes after it.
import { type RefObject, useEffect, useRef } from 'react'
import type { HostChatController, HostChatMessage, HostChatStatus } from '@automatos/theme-sdk'
import type { MascotName } from '@automatos/mascot/types'

import { LooseChoices, MissionCards } from './cards'
import { AutoEntry, AutoFace, TRY_AGAIN, UserBubble, WritingChip } from './entries'
import styles from './thread.module.css'
import ui from '../ui/ui.module.css'

/**
 * The thread (the design's W2 window and P2 page): the conversation as your bubbles and Auto's replies, newest at the
 * foot. It follows the newest line while Auto answers unless you scrolled up to read, and a new message follows
 * again. While Auto has been asked and his reply hasn't begun, his face and "Auto is writing" stand at the foot.
 * Under the conversation: approvals whose reply left it, a turn that failed before a reply began, and a Mission
 * Auto suggests once his answer is complete.
 */

export const THREAD_LABEL = 'Conversation with Auto'
export const EMPTY_THREAD = 'Tell Auto what you need: a post, a report, a plan. He takes it from there.'
export const TURN_FAILED = "That didn't go through."
const FOLLOW_SLACK_PX = 120

function nearBottom(scroller: HTMLElement): boolean {
  return scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <= FOLLOW_SLACK_PX
}

/** jsdom has no scrollIntoView, hence the check. */
function useFollow(messages: readonly HostChatMessage[]): { scroller: RefObject<HTMLDivElement | null>; end: RefObject<HTMLDivElement | null> } {
  const scroller = useRef<HTMLDivElement>(null)
  const end = useRef<HTMLDivElement>(null)
  const following = useRef(true)
  const count = messages.length
  useEffect(() => {
    const element = scroller.current
    if (!element) return undefined
    const onScroll = () => {
      following.current = nearBottom(element)
    }
    element.addEventListener('scroll', onScroll, { passive: true })
    return () => element.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => {
    following.current = true
  }, [count])
  useEffect(() => {
    const target = end.current
    if (following.current && target && typeof target.scrollIntoView === 'function') target.scrollIntoView({ block: 'end' })
  }, [messages])
  return { scroller, end }
}

/** The chat failed and no reply holds the failure. */
export function failedBeforeReply(status: HostChatStatus, messages: readonly HostChatMessage[], trialExhausted: boolean): boolean {
  if (status !== 'error' || trialExhausted) return false
  const last = messages[messages.length - 1]
  return !(last?.role === 'assistant' && last.error)
}

/** Auto was asked and his reply hasn't begun: the newest message is still yours while the turn runs. */
export function awaitingReply(messages: readonly HostChatMessage[], streaming: boolean): boolean {
  return streaming && messages[messages.length - 1]?.role === 'user'
}

interface TurnEndProps {
  readonly chat: HostChatController
  readonly live: readonly HostChatMessage[]
  readonly onRetry: () => void
}

function TurnEnd({ chat, live, onRetry }: TurnEndProps) {
  const { status, trialExhausted, suggestion, planningMissionId, looseApprovals } = chat
  return (
    <div className={styles.turnEnd}>
      <LooseChoices approvals={looseApprovals} />
      {failedBeforeReply(status, live, trialExhausted) && (
        <div className={styles.failure}>
          <span className={styles.chip} data-tone="failed">
            <span aria-hidden="true">✕</span> {TURN_FAILED}
          </span>
          <button type="button" className={`${ui.quiet} ${ui.small}`} onClick={onRetry}>
            {TRY_AGAIN}
          </button>
        </div>
      )}
      {status !== 'streaming' && (
        <MissionCards suggestion={suggestion} planningMissionId={planningMissionId} chatId={chat.conversation.chatId ?? ''} messages={live} />
      )}
    </div>
  )
}

export interface ThreadProps {
  readonly chat: HostChatController
  /** The conversation as the chat hook holds it (stopped replies left out). */
  readonly live: readonly HostChatMessage[]
  /** Auto's state now, for the newest reply's face. */
  readonly face: MascotName
  readonly moving: boolean
  /** The phone's layout (P2): no faces, Auto's words on the window colour. */
  readonly phone: boolean
  readonly onRetry: () => void
}

function Entry({ message, newest, props }: { readonly message: HostChatMessage; readonly newest: boolean; readonly props: ThreadProps }) {
  if (message.role === 'user') return <UserBubble message={message} />
  return (
    <AutoEntry
      message={message}
      face={newest ? props.face : null}
      moving={props.moving}
      onRetry={newest ? props.onRetry : undefined}
      failureHidden={newest && props.chat.trialExhausted}
    />
  )
}

function Writing({ face, moving }: { readonly face: MascotName; readonly moving: boolean }) {
  return (
    <div className={styles.auto}>
      <AutoFace state={face} />
      <div className={styles.autoColumn}>
        <WritingChip moving={moving} />
      </div>
    </div>
  )
}

export function Thread(props: ThreadProps) {
  const { chat, live, face, moving, phone, onRetry } = props
  const { messages } = chat
  const { scroller, end } = useFollow(messages)
  const newest = messages[messages.length - 1]?.id
  return (
    <div
      ref={scroller}
      className={styles.scroller}
      data-layout={phone ? 'phone' : 'desktop'}
      role="region"
      aria-label={THREAD_LABEL}
      tabIndex={0}
    >
      {messages.length === 0 ? (
        <p className={`${ui.note} ${styles.empty}`}>{EMPTY_THREAD}</p>
      ) : (
        <ol className={styles.entries}>
          {messages.map((message) => (
            <li key={message.id} className={styles.item}>
              <Entry message={message} newest={message.id === newest} props={props} />
            </li>
          ))}
        </ol>
      )}
      {awaitingReply(messages, chat.streaming) && <Writing face={face} moving={moving} />}
      <TurnEnd chat={chat} live={live} onRetry={onRetry} />
      <div ref={end} />
    </div>
  )
}
