import type { HostChatController, HostChatMessage, HostChatStatus } from '@automatos/theme-sdk'

import { LooseApprovalCards } from './approval-cards'
import styles from './cards.module.css'
import { MissionCards } from './mission-cards'
import { SnagBox, TURN_FAILED } from './snag-box'

/**
 * What follows the conversation, inside the transcript's scroll (after Play's turn end, themes/play/src/components/
 * play/chat/turn-end.tsx, Play 1.1.1): the approval cards whose reply left it, the snag box for a turn that failed
 * before Auto's reply began (the chat drops the empty reply when the request itself fails, so no reply holds it),
 * and the Mission Auto suggests, once his answer is complete.
 */

export const TURN_END_LABEL = 'After the conversation'

/** The chat failed and no reply holds the failure: the newest message is not a reply with an error. */
export function failedBeforeReply(status: HostChatStatus, messages: readonly HostChatMessage[], trialExhausted: boolean): boolean {
  if (status !== 'error' || trialExhausted) return false
  const last = messages[messages.length - 1]
  return !(last?.role === 'assistant' && last.error)
}

export interface TurnEndProps {
  readonly chat: HostChatController
  /** The conversation as the chat hook holds it (reply.ts liveMessages). */
  readonly messages: readonly HostChatMessage[]
  readonly onRetry: () => void
}

export function TurnEnd({ chat, messages, onRetry }: TurnEndProps) {
  const { status, trialExhausted, suggestion, planningMissionId, looseApprovals } = chat
  return (
    <div className={styles.after} role="group" aria-label={TURN_END_LABEL}>
      <LooseApprovalCards approvals={looseApprovals} />
      {failedBeforeReply(status, messages, trialExhausted) && <SnagBox lines={[TURN_FAILED]} onRetry={onRetry} />}
      {status !== 'streaming' && (
        <MissionCards
          suggestion={suggestion}
          planningMissionId={planningMissionId}
          chatId={chat.conversation.chatId ?? ''}
          messages={messages}
        />
      )}
    </div>
  )
}
