import { type RefObject, useEffect, useRef } from 'react'
import { type HostChatController, type HostChatMessage, type HostChatStatus, useStartChat } from '@automatos/theme-sdk'

import { LooseChoices, MissionCards } from './cards'
import { AutoEntry, Line, YouLine } from './entries'
import styles from './chat.module.css'
import ui from '../ui/ui.module.css'

/**
 * The story window (the design's STORY): the conversation as the player's and Auto's lines, newest at the foot. It
 * follows the newest line while Auto answers unless you scrolled up to read (after HUD's transcript), and a new
 * message follows again. Under the conversation: approvals whose reply left it, a turn that failed before a reply
 * began, and a Mission Auto suggests once his answer is complete. New chat starts a fresh conversation (the SDK's
 * useStartChat); the design has no conversation list, so the host's search finds an older one.
 */

export const STORY_LABEL = 'Story so far'
export const STORY = 'Story'
export const NEW_CHAT = 'New chat'
export const EMPTY_STORY = 'Your story starts here. Tell Auto what you need in the box below.'
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

function TurnEnd({ chat, live, onRetry }: { readonly chat: HostChatController; readonly live: readonly HostChatMessage[]; readonly onRetry: () => void }) {
  const { status, trialExhausted, suggestion, planningMissionId, looseApprovals } = chat
  return (
    <div className={styles.turnEnd}>
      <LooseChoices approvals={looseApprovals} />
      {failedBeforeReply(status, live, trialExhausted) && (
        <Line mark="✕" tone="failed">
          <p className={styles.plain}>{TURN_FAILED}</p>
          <button type="button" className={ui.secondary} onClick={onRetry}>
            Try again
          </button>
        </Line>
      )}
      {status !== 'streaming' && (
        <MissionCards suggestion={suggestion} planningMissionId={planningMissionId} chatId={chat.conversation.chatId ?? ''} messages={live} />
      )}
    </div>
  )
}

export interface StoryProps {
  readonly chat: HostChatController
  /** The conversation as the chat hook holds it (stopped replies left out). */
  readonly live: readonly HostChatMessage[]
  /** The reply the dialogue box is saying: its words stay out of the story. */
  readonly sayingId: string | null
  readonly onRetry: () => void
}

function Entry({ message, sayingId, newest, chat, onRetry }: { readonly message: HostChatMessage; readonly sayingId: string | null; readonly newest: boolean } & Pick<StoryProps, 'chat' | 'onRetry'>) {
  if (message.role === 'user') return <YouLine message={message} />
  return (
    <AutoEntry
      message={message}
      words={message.id !== sayingId}
      onRetry={newest ? onRetry : undefined}
      failureHidden={newest && chat.trialExhausted}
    />
  )
}

export function Story({ chat, live, sayingId, onRetry }: StoryProps) {
  const { messages } = chat
  const { scroller, end } = useFollow(messages)
  const { startChat, ready } = useStartChat()
  const newest = messages[messages.length - 1]?.id
  return (
    <section className={`${ui.window} ${styles.story}`} aria-label={STORY_LABEL}>
      <div className={ui.windowHead}>
        <h2 className={ui.label}>{STORY}</h2>
        <span className={ui.aside}>{chat.title}</span>
        <button type="button" className={`${ui.secondary} ${styles.newChat}`} onClick={startChat} disabled={!ready}>
          {NEW_CHAT}
        </button>
      </div>
      <div ref={scroller} className={styles.scroller}>
        {messages.length === 0 ? (
          <p className={ui.note}>{EMPTY_STORY}</p>
        ) : (
          <ol className={styles.entries}>
            {messages.map((message) => (
              <li key={message.id}>
                <Entry message={message} sayingId={sayingId} newest={message.id === newest} chat={chat} onRetry={onRetry} />
              </li>
            ))}
          </ol>
        )}
        <TurnEnd chat={chat} live={live} onRetry={onRetry} />
        <div ref={end} />
      </div>
    </section>
  )
}
